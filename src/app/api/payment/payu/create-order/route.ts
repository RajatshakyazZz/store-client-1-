import { NextResponse } from 'next/server';
import { createPayUPaymentPayload } from '@/lib/payu';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendAbandonedOrPendingTelegramAlert } from '@/lib/telegram';
import { generateOrderToken } from '@/lib/orderToken';
import { getResellerListingBySlug } from '@/lib/resellerService';
import { BUNDLE_PRODUCTS, ORDER_BUMP } from '@/data/bundles';
import { calculateCouponDiscount } from '@/lib/coupon';
import { fetchCustomProductBySlug } from '@/lib/customProducts';
import { fetchFreeBundleOffer, isMegaAllAccessBundle } from '@/lib/freeBundleOffer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderNumber, customer, items, orderBump, totalAmount, resellerSlug, couponCode } = body;

    // Maintenance mode enforcement
    if (db) {
      try {
        const modeSnap = await getDoc(doc(db, 'store_settings', 'site_mode'));
        if (modeSnap.exists() && modeSnap.data()?.mode === 'MAINTENANCE') {
          return NextResponse.json(
            {
              success: false,
              error:
                modeSnap.data()?.maintenance_message ||
                'Store is currently under scheduled maintenance. Orders are temporarily paused. Please check back shortly.',
            },
            { status: 503 }
          );
        }
      } catch (err) {
        console.warn('Site mode check error:', err);
      }
    }

    const cleanEmail = String(customer?.email || '').trim().toLowerCase();
    const cleanPhone = String(customer?.phone || '').replace(/\D/g, '');
    const cleanName = String(customer?.fullName || '').trim();

    if (!orderNumber || !cleanEmail || !totalAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required order details' },
        { status: 400 }
      );
    }

    if (!cleanEmail.endsWith('@gmail.com') || cleanEmail.slice(0, -10).length < 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid Email! Only a valid @gmail.com address is accepted for Google Drive access.' },
        { status: 400 }
      );
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone) || /^(\d)\1{9}$/.test(cleanPhone) || cleanPhone === '9876543210') {
      return NextResponse.json(
        { success: false, error: 'Invalid Phone! Please enter a valid 10-digit WhatsApp / mobile number.' },
        { status: 400 }
      );
    }

    if (cleanName.length < 3 || !/^[a-zA-Z\s.]+$/.test(cleanName)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid full name (minimum 3 letters).' },
        { status: 400 }
      );
    }

    // Server-authoritative price calculation and anti-tampering enforcement
    let finalTotalAmount = Number(totalAmount);
    let resellerAttribution: Record<string, any> = {};
    let appliedCouponDetails: any = null;

    if (resellerSlug) {
      const cleanSlug = String(resellerSlug).trim();
      let listing: any = null;
      try {
        listing = await getResellerListingBySlug(cleanSlug, true);
      } catch (rErr: any) {
        console.warn('Error resolving reseller listing during order creation:', rErr);
      }

      if (!listing) {
        return NextResponse.json(
          {
            success: false,
            error: 'Reseller listing not found or expired. Please verify the URL.',
          },
          { status: 400 }
        );
      }

      if (listing.status !== 'active') {
        return NextResponse.json(
          {
            success: false,
            error: `This reseller listing is currently ${listing.status}. Purchases cannot be completed.`,
          },
          { status: 400 }
        );
      }

      let originalProd = await fetchCustomProductBySlug(listing.originalProductId || listing.originalProductSlug || '');
      if (!originalProd) {
        originalProd = BUNDLE_PRODUCTS.find(
          (p) => p.id === listing.originalProductId || p.slug === listing.originalProductSlug
        ) || null;
      }
      const basePrice = originalProd ? Number(originalProd.personalPrice) : Number(listing.basePrice || 0);
      const approvedResalePrice = Number(listing.resalePrice || 0);

      if (approvedResalePrice < basePrice || approvedResalePrice <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid listing price configuration. Purchase cannot proceed.',
          },
          { status: 400 }
        );
      }

      const calculatedProfit = Math.max(0, approvedResalePrice - basePrice);
      const bumpPrice = orderBump ? Number(orderBump.price != null && orderBump.price > 0 ? orderBump.price : 99) : 0;
      finalTotalAmount = approvedResalePrice + bumpPrice;

      resellerAttribution = {
        reseller_slug: cleanSlug,
        reseller_id: listing.resellerId || '',
        reseller_listing_id: listing.id || '',
        reseller_profit: calculatedProfit,
        reseller_base_price: basePrice,
        reseller_sale_price: approvedResalePrice,
      };
    } else {
      let expectedCatalogTotal = 0;
      let freeBonusCount = 0;

      if (Array.isArray(items) && items.length > 0) {
        // Pass 1: compute paid items total
        for (const it of items) {
          if (it.isFreeBonus || it.price === 0) {
            continue;
          }
          const itId = String(it.id || it.slug || '');
          let catalogProd = await fetchCustomProductBySlug(itId);
          if (!catalogProd) {
            catalogProd = BUNDLE_PRODUCTS.find((p) => p.id === itId || p.slug === itId) || null;
          }

          if (catalogProd) {
            const isResellerLicense = it.license === 'reseller';
            const itemPrice = isResellerLicense
              ? Number(catalogProd.resellerPrice)
              : Number(catalogProd.personalPrice);
            expectedCatalogTotal += itemPrice * (Number(it.quantity) || 1);
          } else {
            expectedCatalogTotal += Number(it.price || 0) * (Number(it.quantity) || 1);
          }
        }

        // Pass 2: check free bonus items against dynamic free bundle offer
        const freeOfferConfig = await fetchFreeBundleOffer().catch(() => null);
        const isOfferActive = freeOfferConfig ? freeOfferConfig.enabled !== false : true;
        const offerThreshold = isOfferActive ? (freeOfferConfig?.minCartValue || 149) : 999999999;
        const maxFreeBundles = isOfferActive ? (freeOfferConfig?.freeBundleQuantity || 2) : 0;

        for (const it of items) {
          if (it.isFreeBonus || it.price === 0) {
            const isMega = isMegaAllAccessBundle(it);
            if (!isMega && isOfferActive && expectedCatalogTotal >= offerThreshold && freeBonusCount < maxFreeBundles) {
              freeBonusCount++;
              // Qualified promotional free gift, charges ₹0
              continue;
            } else {
              const itId = String(it.id || it.slug || '');
              let catalogProd = await fetchCustomProductBySlug(itId);
              if (!catalogProd) {
                catalogProd = BUNDLE_PRODUCTS.find((p) => p.id === itId || p.slug === itId) || null;
              }
              const itemPrice = catalogProd ? Number(catalogProd.personalPrice) : Number(it.price || 0);
              expectedCatalogTotal += itemPrice * (Number(it.quantity) || 1);
            }
          }
        }
      }

      if (orderBump) {
        const bumpPrice = Number(orderBump.price != null && orderBump.price > 0 ? orderBump.price : (ORDER_BUMP.discountPrice || 99));
        expectedCatalogTotal += bumpPrice;
      }

      if (couponCode && String(couponCode).trim()) {
        const couponResult = await calculateCouponDiscount(couponCode, expectedCatalogTotal);
        if (couponResult.valid && typeof couponResult.discountAmount === 'number' && couponResult.discountAmount > 0) {
          expectedCatalogTotal = Math.max(1, couponResult.newTotal ?? (expectedCatalogTotal - couponResult.discountAmount));
          appliedCouponDetails = {
            code: couponResult.code,
            discount_type: couponResult.discountType,
            discount_amount: couponResult.discountAmount,
            discount_percent: couponResult.discountPercent || null,
          };
        }
      }

      if (expectedCatalogTotal > 0) {
        if (Math.abs(expectedCatalogTotal - finalTotalAmount) > 5) {
          console.warn(
            `Price mismatch on order #${orderNumber}! Client requested ₹${finalTotalAmount}, Server calculated ₹${expectedCatalogTotal}. Enforcing server calculated amount.`
          );
        }
        finalTotalAmount = expectedCatalogTotal;
      }
    }

    if (finalTotalAmount < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid order amount (minimum ₹1 required).' },
        { status: 400 }
      );
    }

    const hostHeader = request.headers.get('host') || '';
    const isLocalhost = hostHeader.includes('localhost');
    const siteBase = isLocalhost
      ? `http://${hostHeader}`
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vaultworld.shop').replace(/\/+$/, '');

    const orderToken = generateOrderToken(orderNumber);

    const firstItemTitle = items && items[0]?.title
      ? String(items[0].title).replace(/[^a-zA-Z0-9\s_-]/g, ' ')
      : 'VaultWorld Reels Bundle';

    // 1. Generate PayU Checkout Payload
    const payuPayload = await createPayUPaymentPayload({
      orderId: orderNumber,
      orderAmount: Number(finalTotalAmount),
      customer: {
        fullName: cleanName || 'Customer',
        email: cleanEmail,
        phone: cleanPhone || '9999999999',
      },
      productInfo: firstItemTitle.slice(0, 100),
      returnUrl: `${siteBase}/api/payment/payu/return`,
      udf1: orderNumber,
      udf2: orderToken,
      udf3: resellerSlug ? String(resellerSlug).slice(0, 50) : '',
      udf4: couponCode ? String(couponCode).slice(0, 30) : '',
      udf5: (items?.[0]?.slug || 'reels-bundle').slice(0, 50),
    });

    // 2. Persist Pending Order to Firestore
    if (db) {
      try {
        const orderRef = doc(db, 'orders', orderNumber);
        await setDoc(orderRef, {
          orderNumber,
          customer: {
            fullName: cleanName || 'Customer',
            email: cleanEmail,
            phone: cleanPhone || '',
          },
          items: items && items.length > 0 ? items : [{ id: 'bundle', title: 'Viral Reels Bundle', price: Number(finalTotalAmount), license: 'personal' }],
          orderBump: orderBump || null,
          totalAmount: Number(finalTotalAmount),
          paymentMethod: 'PayU Payment Gateway',
          transactionId: String(orderNumber).slice(0, 95),
          status: 'pending',
          createdAt: serverTimestamp(),
          timestampIso: new Date().toISOString(),
          purchase_event_id: `purchase_${orderNumber}`,
          purchase_event_status: 'pending',
          purchase_event_attempts: 0,
          purchase_client_fired: false,
          order_token: orderToken,
          applied_coupon: appliedCouponDetails || null,
          discount_amount: appliedCouponDetails?.discount_amount || 0,
          ...resellerAttribution,
        });
      } catch (firestoreErr) {
        console.warn('Could not save pending order to Firestore:', firestoreErr);
      }
    }

    // 3. Dispatch Instant Telegram Alert for Checkout Started (Awaited to ensure delivery in serverless environment)
    try {
      await sendAbandonedOrPendingTelegramAlert(
        {
          orderNumber,
          customer: {
            fullName: cleanName || 'Customer',
            email: cleanEmail,
            phone: cleanPhone || '',
          },
          items: items || [],
          orderBump: orderBump || null,
          totalAmount: Number(finalTotalAmount),
          paymentStatus: 'CHECKOUT_STARTED',
          paymentMethod: 'PayU India (UPI / Card / NetBanking)',
        },
        'checkout_initiated'
      );
    } catch (tErr) {
      console.warn('[PayU Create Order] Non-blocking Telegram alert warning:', tErr);
    }

    return NextResponse.json({
      success: true,
      gateway: 'payu',
      action: payuPayload.action,
      params: payuPayload.params,
      order_id: orderNumber,
      order_token: orderToken,
      environment: payuPayload.environment,
    });
  } catch (error: any) {
    console.error('Error creating PayU order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Payment initiation failed. Please check PayU API credentials in the Admin Portal.',
      },
      { status: 500 }
    );
  }
}
