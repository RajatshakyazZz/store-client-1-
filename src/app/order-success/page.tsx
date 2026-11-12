'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  FolderOpen,
  ArrowRight,
  ArrowUpRight,
  Download,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Send,
  Calendar,
  Mail,
  Zap,
  Play,
  Star,
  Flame,
  Award,
} from 'lucide-react';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useCart } from '@/context/CartContext';
import { ALL_ACCESS_PLANS, BUNDLE_PRODUCTS } from '@/data/bundles';
import { BundleProduct } from '@/types';
import { track } from '@/lib/analytics';
import { buildSupportWhatsAppUrl } from '@/lib/whatsappSupport';

function resolveItemImage(item: any): string {
  if (item?.thumbnail && !item.thumbnail.includes('photo-1618005182384-a83a8bd57fbe')) {
    return item.thumbnail;
  }
  if (item?.featured_image && !item.featured_image.includes('photo-1618005182384-a83a8bd57fbe')) {
    return item.featured_image;
  }
  if (item?.image && !item.image.includes('photo-1618005182384-a83a8bd57fbe')) {
    return item.image;
  }
  if (item?.coverImage && !item.coverImage.includes('photo-1618005182384-a83a8bd57fbe')) {
    return item.coverImage;
  }

  const cleanId = String(item?.id || '').toLowerCase().trim();
  const cleanSlug = String(item?.slug || '').toLowerCase().trim();
  const cleanTitle = String(item?.title || item?.name || '').toLowerCase().trim();
  const normTitle = cleanTitle.replace(/[+_\-\/\\:.,()]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Local custom products cache in browser
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('vaultzet_custom_products');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((p: any) => {
            const pId = String(p.id || '').toLowerCase().trim();
            const pSlug = String(p.slug || '').toLowerCase().trim();
            const pName = String(p.name || p.title || '').toLowerCase().trim();
            const normPName = pName.replace(/[+_\-\/\\:.,()]/g, ' ').replace(/\s+/g, ' ').trim();
            const normPSlug = pSlug.replace(/[+_\-\/\\:.,()]/g, ' ').replace(/\s+/g, ' ').trim();
            return (
              (cleanId && (pId === cleanId || pSlug === cleanId)) ||
              (cleanSlug && (pSlug === cleanSlug || pId === cleanSlug)) ||
              (normPSlug && (normTitle.includes(normPSlug) || normPSlug.includes(normTitle))) ||
              (normPName && (normTitle.includes(normPName) || normPName.includes(normTitle)))
            );
          });
          const found = match?.featured_image || match?.thumbnail || match?.image;
          if (found && !found.includes('photo-1618005182384-a83a8bd57fbe')) {
            return found;
          }
        }
      }
    } catch {}
  }

  // 2. Catalog BUNDLE_PRODUCTS
  const catalogMatch = BUNDLE_PRODUCTS.find((b) => {
    const bId = b.id.toLowerCase().trim();
    const bSlug = b.slug.toLowerCase().trim();
    const bTitle = b.title.toLowerCase().trim();
    const normBTitle = bTitle.replace(/[+_\-\/\\:.,()]/g, ' ').replace(/\s+/g, ' ').trim();
    const normBSlug = bSlug.replace(/[+_\-\/\\:.,()]/g, ' ').replace(/\s+/g, ' ').trim();
    return (
      (cleanId && (bId === cleanId || bSlug === cleanId)) ||
      (cleanSlug && (bSlug === cleanSlug || bId === cleanSlug)) ||
      (normBSlug && (normTitle.includes(normBSlug) || normBSlug.includes(normTitle))) ||
      (normBTitle && (normTitle.includes(normBTitle) || normBTitle.includes(normTitle)))
    );
  });

  if (catalogMatch?.thumbnail && !catalogMatch.thumbnail.includes('photo-1618005182384-a83a8bd57fbe')) {
    return catalogMatch.thumbnail;
  }

  return item?.thumbnail || item?.featured_image || item?.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const rawOrderId =
    searchParams.get('order_id') || searchParams.get('orderId') || '';

  const { settings } = useStoreSettings();
  const { buyNow } = useCart();

  const [orderId, setOrderId] = useState<string>(rawOrderId);
  const [status, setStatus] = useState<'verifying' | 'paid' | 'unpaid'>('verifying');
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [upsellTab, setUpsellTab] = useState<'personal' | 'reseller'>('reseller');

  const isResellerOrder = Boolean(
    searchParams.get('r') ||
    searchParams.get('reseller_slug') ||
    verifiedData?.reseller_id ||
    verifiedData?.reseller_slug ||
    (typeof window !== 'undefined' && (() => {
      try {
        return sessionStorage.getItem('vaultzet_reseller_slug') || localStorage.getItem('vaultzet_reseller_slug');
      } catch {
        return null;
      }
    })())
  );

  useEffect(() => {
    let targetId = rawOrderId;
    if (!targetId && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vaultzet_latest_order');
        if (saved) {
          const parsed = JSON.parse(saved);
          targetId = parsed.orderId || parsed.orderNumber || '';
        }
      } catch {}
    }

    if (!targetId) {
      targetId = 'VZ-DEMO';
    }
    setOrderId(targetId);

    const rawToken = searchParams.get('token') || '';

    // Call server-side payment verification endpoint
    let isCancelled = false;
    setStatus('verifying');

    const verifyUrl = `/api/payment/payu/verify-order?order_id=${encodeURIComponent(targetId)}${rawToken ? `&token=${encodeURIComponent(rawToken)}` : ''}`;

    fetch(verifyUrl)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data.success && data.paid) {
          setVerifiedData(data);
          setStatus('paid');
          const orderNum = data.orderNumber || targetId;

          try {
            localStorage.removeItem('vaultzet_latest_order');
            const existingRaw = localStorage.getItem('vaultzet_purchased_orders');
            const list = existingRaw ? JSON.parse(existingRaw) : [];
            const alreadyInLocal = list.some((o: any) => (o.orderNumber || o.order_id || o.orderId) === orderNum);
            if (!alreadyInLocal) {
              list.unshift({
                orderNumber: orderNum,
                order_id: targetId,
                order_amount: data.order_amount,
                date_created: new Date().toISOString(),
                customer: data.customer,
                items: data.items,
                hasBump: data.hasBump,
              });
              localStorage.setItem('vaultzet_purchased_orders', JSON.stringify(list));
            }
          } catch (e) {
            console.warn('Could not store order locally:', e);
          }

          // Strict server-side gatekeeper: ONLY fire browser event if backend confirms this order hasn't fired yet
          if (data.eligible_for_browser_event) {
            // 1. Immediately notify server to mark client fired, preventing any future fires across reloads/devices
            fetch('/api/payment/payu/verify-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'mark_client_fired',
                orderId: orderNum,
                token: data.order_token || rawToken,
              }),
            }).catch(() => {});

            // 2. Build commerce items
            const purchaseItems = Array.isArray(data.items) && data.items.length > 0
              ? data.items.map((item: any, idx: number) => ({
                  item_id: String(item.id || item.slug || `bundle-${idx + 1}`),
                  item_name: String(item.title || item.name || 'Reels Bundle'),
                  item_category: item.category || 'Reels Bundle',
                  price: Number(item.price || data.order_amount || 0),
                  quantity: Number(item.quantity || 1),
                  item_variant: item.license || 'personal',
                  index: idx,
                }))
              : [
                  {
                    item_id: String(orderNum),
                    item_name: 'Reels Bundle Order',
                    item_category: 'Reels Bundle',
                    price: Number(data.order_amount || 0),
                    quantity: 1,
                  },
                ];

            if (data.hasBump) {
              purchaseItems.push({
                item_id: String(data.orderBump?.id || 'order-bump'),
                item_name: String(data.orderBump?.title || 'Bonus Bump Offer'),
                item_category: 'Order Bump',
                price: Number(data.orderBump?.price || 99),
                quantity: 1,
                item_variant: 'bump',
                index: purchaseItems.length,
              });
            }

            // 3. Fire GA4 and Meta Pixel with deterministic event ID identical to CAPI
            track('purchase', {
              transaction_id: String(orderNum),
              event_id: data.purchase_event_id || `purchase_${orderNum}`,
              value: Number(data.order_amount || 0),
              currency: 'INR',
              tax: 0,
              shipping: 0,
              items: purchaseItems,
            });
          }
        } else {
          setStatus('unpaid');
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('Order verification failed:', err);
        setStatus('unpaid');
      });

    return () => {
      isCancelled = true;
    };
  }, [rawOrderId, retryCount]);

  const handleCopyLink = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleBuyUpsell = (planType: 'personal' | 'reseller') => {
    const plan = planType === 'reseller' ? ALL_ACCESS_PLANS[1] : ALL_ACCESS_PLANS[0];
    const masterProduct: BundleProduct = {
      id: plan.id,
      slug: plan.id,
      title: plan.name,
      shortDescription: plan.subtitle,
      category: 'All Access Membership',
      categorySlug: 'all-access',
      reelCount: 222000,
      personalPrice: plan.price,
      personalOriginalPrice: plan.originalPrice,
      resellerPrice: plan.price,
      resellerOriginalPrice: plan.originalPrice,
      thumbnail:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      galleryImages: [],
      tags: ['ALL ACCESS', plan.badge],
      rating: 5.0,
      reviewCount: 310,
      resolution: '1080p Full HD',
      aspectRatio: '9:16 Vertical',
      format: 'MP4 Video',
      audioIncluded: true,
      googleDriveLink: 'https://drive.google.com/drive/folders/master-all-access-vaultzet',
      features: plan.features,
      faqs: [],
    };
    buyNow(masterProduct, plan.licenseType);
  };

  const hasAllAccessPurchased =
    Array.isArray(verifiedData?.items) &&
    verifiedData.items.some(
      (it: any) =>
        Boolean(it?.isAllAccess) ||
        (typeof it?.id === 'string' && it.id.includes('plan-')) ||
        (typeof it?.title === 'string' && it.title.toLowerCase().includes('all bundles'))
    );

  return (
    <div className="rbt-page py-6 sm:py-12 bg-gradient-to-b from-white via-[#faf9f6] to-[#f8fafc] min-h-screen text-[#17214a]">
      <div className="rbt-container max-w-[1180px] mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">

        {/* 1. STATE: VERIFYING PAYMENT */}
        {status === 'verifying' && (
          <div className="bg-white rounded-3xl p-8 sm:p-14 border border-purple-100 shadow-[0_12px_36px_rgba(95,57,220,0.08)] text-center space-y-6 max-w-2xl mx-auto my-12">
            <div className="w-20 h-20 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Lock className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Security Verification
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#17214a]">
                Verifying Payment &amp; Unlocking Files...
              </h1>
              <p className="text-sm text-[#5e6888] font-medium max-w-md mx-auto leading-relaxed">
                We are securely confirming your transaction status with the PayU gateway.
                Your Google Drive access links will appear immediately upon verification.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 inline-flex items-center gap-2 text-xs font-mono font-bold text-purple-700">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
              <span>Verifying Order: {orderId}</span>
            </div>
          </div>
        )}

        {/* 2. STATE: UNPAID OR PENDING */}
        {status === 'unpaid' && (
          <div className="bg-white rounded-3xl p-8 sm:p-14 border border-rose-100 shadow-[0_12px_36px_rgba(225,29,72,0.08)] text-center space-y-6 max-w-2xl mx-auto my-12">
            <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                Access Protected
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#17214a]">
                Payment Not Confirmed Yet
              </h1>
              <p className="text-sm text-[#5e6888] font-medium max-w-md mx-auto leading-relaxed">
                Google Drive files are locked and only accessible after a confirmed payment.
                If you already paid via UPI or Card, click below to re-check your payment status.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 inline-flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-700">
              <span>Order Reference: <strong className="text-slate-900">{orderId}</strong></span>
              <span>•</span>
              <span className="text-rose-600 font-semibold">Payment Status: Unconfirmed</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="w-full sm:w-auto px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-transform hover:scale-[1.02]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-Check Payment Status</span>
              </button>

              <Link
                href="/checkout"
                className="w-full sm:w-auto px-7 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Complete Payment at Checkout
              </Link>
            </div>

            <p className="text-[12px] text-slate-400 font-medium pt-2">
              Need assistance? WhatsApp Support is available 24/7 for instant order verification.
            </p>
          </div>
        )}

        {/* 3. STATE: VERIFIED & PAID (RESELLER DEDICATED CLEAN & MINIMAL SUCCESS UI) */}
        {status === 'paid' && isResellerOrder && (
          <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
            {/* Top Minimal Brand Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-purple-100 text-xs text-slate-500">
              <span className="font-bold text-slate-700">VaultWorld Order Confirmation</span>
              <span className="font-mono text-[11px] bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-bold">
                Order #{verifiedData?.orderNumber || orderId}
              </span>
            </div>

            {/* Celebratory Hero Card */}
            <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-50 via-white to-purple-50/40 border border-emerald-200/80 shadow-lg text-center space-y-4">
              <div className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                <Check className="w-10 h-10 stroke-[3.5]" />
                <div className="absolute -inset-1 rounded-full border-2 border-emerald-400/50 animate-ping pointer-events-none" />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-100/80 px-3 py-1 rounded-full">
                  Payment Verified & Completed
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#17214a] pt-1">
                  Thank You for Your Order!
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md mx-auto leading-relaxed">
                  Your payment was confirmed. Your reels bundle is ready for instant access below
                  {verifiedData?.customer?.email && (
                    <> and has been sent to <strong className="text-slate-900">{verifiedData.customer.email}</strong></>
                  )}.
                </p>
              </div>

              {/* Direct Instant Download / Open Drive CTA */}
              <div className="pt-2 space-y-2.5">
                <a
                  href={verifiedData?.items?.[0]?.googleDriveLink || 'https://drive.google.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-emerald-600/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="w-5 h-5 stroke-[2.5]" />
                  <span>Open Google Drive & Access Reels Now</span>
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </a>

                {verifiedData?.items?.[0]?.googleDriveLink && (
                  <div>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(verifiedData.items[0].googleDriveLink, 'reseller-drive-link')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1"
                    >
                      {copiedKey === 'reseller-drive-link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Google Drive Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Google Drive Link</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Purchased Items Card */}
            <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>Purchased Bundle</span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  Instant Access Unlocked
                </span>
              </h2>

              <div className="space-y-3">
                {verifiedData?.items?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 items-start sm:items-center justify-between"
                  >
                    <div className="flex gap-3 items-center min-w-0">
                      {resolveItemImage(item) && (
                        <img
                          src={resolveItemImage(item)}
                          alt={item.title}
                          className="w-14 h-16 object-cover rounded-xl shrink-0 border border-slate-200"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-xs sm:text-sm text-[#17214a] leading-snug">
                          {item.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded">
                            1080x1920 HD
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                            Zero Watermarks
                          </span>
                          {item.isFreeBonus && (
                            <span className="bg-emerald-100 text-[#076647] font-black px-2 py-0.5 rounded">
                              🎁 Free Bonus Gift
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <a
                      href={item.googleDriveLink || 'https://drive.google.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Open Folder</span>
                    </a>
                  </div>
                ))}
              </div>

              {/* Order Meta details */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[11px] text-slate-400 font-bold block">Total Amount</span>
                  <strong className="text-sm font-black text-slate-800">
                    ₹{verifiedData?.order_amount || verifiedData?.totalAmount || 0}.00
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[11px] text-slate-400 font-bold block">Payment Gateway</span>
                  <strong className="text-xs font-bold text-slate-800">
                    PayU Verified
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-slate-400 font-bold block">License Type</span>
                  <strong className="text-xs font-bold text-purple-700">
                    Lifetime Commercial
                  </strong>
                </div>
              </div>
            </div>

            {/* Simple Step-by-Step Instructions */}
            <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                How to use your reels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-purple-700 font-black block">1. Open Google Drive</span>
                  <p className="text-slate-600 text-[11px]">Click the button above to view your folder of high quality vertical videos.</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-purple-700 font-black block">2. Save to Phone/PC</span>
                  <p className="text-slate-600 text-[11px]">Download individual reels or entire folders with 1 click without watermarks.</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1">
                  <span className="text-purple-700 font-black block">3. Post & Grow</span>
                  <p className="text-slate-600 text-[11px]">Upload to Instagram, YouTube Shorts, or Facebook. Edit or add trending audio as desired.</p>
                </div>
              </div>
            </div>

            {/* Quick WhatsApp Support */}
            <div className="p-5 rounded-2xl bg-slate-100 text-center space-y-2">
              <p className="text-xs text-slate-600 font-medium">
                Need any help with your download? Our support team is here to assist you.
              </p>
              <a
                href={buildSupportWhatsAppUrl(
                  `Hi ${settings.storeName || 'VaultWorld'}, I purchased order #${verifiedData?.orderNumber || orderId} and need assistance.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat with WhatsApp Support</span>
              </a>
            </div>
          </div>
        )}

        {/* 4. STATE: VERIFIED & PAID (REELSUNDLES FULL BRANDING) */}
        {status === 'paid' && !isResellerOrder && (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            
            {/* Top Breadcrumb Kicker */}
            <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Payment Confirmed • Instant Google Drive Access Granted</span>
              </div>
              <div className="hidden sm:block text-slate-400 font-mono text-[11.5px]">
                Ref: {verifiedData?.orderNumber || orderId}
              </div>
            </div>

            {/* The ReelsBundles Signature Hero Card (.rbt-success) */}
            <section className="relative rounded-[26px] p-6 sm:p-9 border border-[#e7e4f3] bg-gradient-to-r from-[#f0fff8] via-[#f7f7ff] to-[#fff3fb] shadow-[0_12px_36px_rgba(39,35,92,0.06)] overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* Big Green Check Circle Icon */}
                <div className="md:col-span-2 flex justify-center md:justify-start">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#12b763] text-white flex items-center justify-center shadow-[0_16px_32px_rgba(18,183,99,0.25)] shrink-0">
                    <Check className="w-10 h-10 sm:w-12 sm:h-12 stroke-[3.5]" />
                    <div className="absolute -inset-1 rounded-full border-2 border-emerald-400/50 animate-ping pointer-events-none" />
                  </div>
                </div>

                {/* Hero Headline & Explanation */}
                <div className="md:col-span-7 text-center md:text-left space-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#12a458] tracking-wide uppercase">
                    <Sparkles className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                    Verified &amp; Payment Successful
                  </span>
                  <h1 className="text-2xl sm:text-4xl font-black text-[#17214a] tracking-tight leading-tight">
                    Order Completed Successfully!
                  </h1>
                  <p className="text-xs sm:text-sm text-[#5e6888] font-medium max-w-xl leading-relaxed">
                    Thank you for your purchase! Your payment was verified and confirmed.
                    Your Google Drive reels access links are ready below
                    {verifiedData?.customer?.email && (
                      <>
                        {' '}and have also been sent to{' '}
                        <strong className="text-slate-900 font-bold underline decoration-purple-300">
                          {verifiedData.customer.email}
                        </strong>.
                      </>
                    )}
                  </p>
                </div>

                {/* 3D Visual Art Badge on Desktop */}
                <div className="md:col-span-3 hidden md:flex justify-end">
                  <div className="w-[180px] h-[130px] rounded-[24px] bg-gradient-to-br from-[#7e3af2] via-[#6a32e4] to-[#5424cb] p-4 text-white shadow-[0_14px_30px_rgba(95,57,220,0.22)] relative flex flex-col items-center justify-center text-center overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner">
                      <Download className="w-6 h-6 text-white stroke-[2.5]" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-200">
                      Cloud Delivery
                    </span>
                    <strong className="text-xs font-extrabold text-white">
                      100% Unlocked
                    </strong>
                  </div>
                </div>

              </div>
            </section>

            {/* ReelsBundles 6-Column Order Summary Strip (.rbt-order-summary) */}
            <section className="rounded-2xl border border-[#e7e4f3] bg-white p-4 sm:p-5 shadow-[0_6px_22px_rgba(39,35,92,0.04)]">
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#17214a] flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>Order Summary &amp; Verification Details</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>PayU Verified</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* 1. Order Number */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                    #
                  </div>
                  <div className="min-w-0">
                    <small className="block text-[11px] font-bold text-slate-400">Order ID</small>
                    <strong className="block text-xs font-black text-[#17214a] truncate">
                      {verifiedData?.orderNumber || orderId}
                    </strong>
                  </div>
                </div>

                {/* 2. Date */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <small className="block text-[11px] font-bold text-slate-400">Date</small>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">
                      {new Date().toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </div>
                </div>

                {/* 3. Customer Email */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3 col-span-2 sm:col-span-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <small className="block text-[11px] font-bold text-slate-400">Access Sent To</small>
                    <strong className="block text-xs font-black text-[#17214a] truncate" title={verifiedData?.customer?.email || 'Your Gmail'}>
                      {verifiedData?.customer?.email || 'customer@gmail.com'}
                    </strong>
                  </div>
                </div>

                {/* 4. Total Amount */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    ₹
                  </div>
                  <div className="min-w-0">
                    <small className="block text-[11px] font-bold text-slate-400">Total Paid</small>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">
                      ₹{verifiedData?.order_amount || verifiedData?.totalAmount || 0}.00
                    </strong>
                  </div>
                </div>

                {/* 5. Payment Status */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="min-w-0">
                    <small className="block text-[11px] font-bold text-slate-400">Payment Status</small>
                    <strong className="block text-xs font-black text-emerald-600">
                      Paid &amp; Verified
                    </strong>
                  </div>
                </div>

                {/* 6. Quick Portal Action */}
                <div className="flex items-center justify-end col-span-2 sm:col-span-3 lg:col-span-1">
                  <Link
                    href="/my-order"
                    className="w-full h-full min-h-[46px] px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>My Orders</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* SPECIAL VIP BANNER: IF ALL-ACCESS MEMBERSHIP PURCHASED */}
            {hasAllAccessPurchased && (
              <section className="relative rounded-[26px] p-6 sm:p-8 bg-gradient-to-r from-[#5f1ec9] via-[#9128bd] to-[#d4369a] text-white shadow-[0_16px_40px_rgba(114,36,205,0.28)] overflow-hidden">
                <div className="pointer-events-none absolute -top-12 -right-8 w-52 h-52 rounded-full bg-white/10" />
                <div className="hidden sm:block absolute left-3.5 top-5 bottom-5 w-[4px] bg-white/95 rounded-full" />

                <div className="relative space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-white">
                    <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>VIP All-Access Membership Activated</span>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                      You Have Unlocked Every Reels Bundle in the Store!
                    </h2>
                    <p className="text-xs sm:text-sm text-purple-100 max-w-2xl font-medium leading-relaxed">
                      Congratulations! You now have lifetime master access to all 129+ published reels bundles (over 222,000+ viral HD videos), future upcoming releases, and commercial reseller rights.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                      <strong className="block text-base sm:text-lg font-black text-white">129+</strong>
                      <span className="text-[11px] text-purple-200 font-bold">Categories Included</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                      <strong className="block text-base sm:text-lg font-black text-white">222,000+</strong>
                      <span className="text-[11px] text-purple-200 font-bold">Ready-to-Post Reels</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                      <strong className="block text-base sm:text-lg font-black text-white">Reseller</strong>
                      <span className="text-[11px] text-purple-200 font-bold">Commercial License</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                      <strong className="block text-base sm:text-lg font-black text-white">Lifetime</strong>
                      <span className="text-[11px] text-purple-200 font-bold">Cloud Drive Updates</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* UNLOCKED GOOGLE DRIVE PRODUCTS LIST (.rbt-products) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f0ebff] text-[#6c3cff] flex items-center justify-center font-black">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-[#17214a] leading-none">
                      Your Google Drive Download Links
                    </h2>
                    <small className="text-xs text-slate-500 font-medium">
                      Click &apos;Open Google Drive Folder&apos; to view, stream or download your files
                    </small>
                  </div>
                </div>

                <span className="text-xs font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                  {verifiedData?.items?.length || 1} Item(s) Ready
                </span>
              </div>

              {/* Products Grid */}
              <div className="space-y-4">
                {verifiedData?.items?.map((item: any, idx: number) => {
                  const driveUrl = item.googleDriveLink || 'https://drive.google.com';
                  const isReseller = item.license === 'reseller';
                  const copyKey = `item-${idx}`;

                  return (
                    <article
                      key={idx}
                      className="rounded-[22px] border border-[#e7e4f3] bg-white p-4 sm:p-5 shadow-[0_8px_24px_rgba(39,35,92,0.05)] transition-all hover:shadow-[0_12px_32px_rgba(39,35,92,0.08)]"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                        
                        {/* 1. Thumbnail Column */}
                        <div className="md:col-span-3">
                          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 shadow-sm border border-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveItemImage(item)}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider text-white">
                              {item.resolution || '1080P FULL HD'}
                            </div>
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-[10px] font-black uppercase text-white">
                              Unlocked
                            </div>
                          </div>
                        </div>

                        {/* 2. Middle Content Column */}
                        <div className="md:col-span-5 space-y-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                isReseller
                                  ? 'bg-[#ffe4ee] text-[#9f1239]'
                                  : 'bg-[#efe8ff] text-[#6c3cff]'
                              }`}
                            >
                              {isReseller ? 'Reseller Rights Included' : 'Personal License'}
                            </span>
                            {Array.isArray(item.files) && item.files.length > 1 && (
                              <span className="text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {item.files.length} Drive Files Included
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-400">
                              Format: {item.format || 'MP4 Video'}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-black text-[#17214a] leading-snug">
                            {item.title}
                          </h3>

                          <p className="text-xs text-[#5e6888] font-medium leading-relaxed">
                            Organized in high-speed Google Drive folders. Ready to post directly to Instagram Reels, YouTube Shorts &amp; TikTok with trending audio.
                          </p>

                          <div className="flex items-center gap-4 text-xs font-bold text-slate-600 pt-1">
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-purple-600" />
                              <span>Instant Delivery</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Lifetime Access</span>
                            </span>
                          </div>
                        </div>

                        {/* 3. Right Access Card (.rbt-access) */}
                        <div className="md:col-span-4">
                          <div className="rounded-2xl border border-[#dcefe4] bg-gradient-to-r from-[#f2fff8] to-[#f8fffb] p-4 sm:p-5 space-y-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#16aa5d] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                                <FolderOpen className="w-5 h-5 stroke-[2.5]" />
                              </div>
                              <div>
                                <strong className="block text-xs sm:text-sm font-black text-[#16894e]">
                                  Google Drive Unlocked
                                </strong>
                                <span className="block text-[11px] text-[#63708b] font-medium">
                                  {Array.isArray(item.files) && item.files.length > 1
                                    ? `${item.files.length} shared folders ready`
                                    : 'Your shared link is ready to open'}
                                </span>
                              </div>
                            </div>

                            {Array.isArray(item.files) && item.files.length > 1 ? (
                              <div className="space-y-2.5 pt-1">
                                {item.files.map((f: any, fIdx: number) => {
                                  const fUrl = f.file_url || f.url || driveUrl;
                                  const fCopyKey = `item-${idx}-file-${fIdx}`;
                                  return (
                                    <div
                                      key={f.id || fIdx}
                                      className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-sm space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-1 text-[11px]">
                                        <span className="font-bold text-[#17214a] truncate">
                                          {f.name || `Drive File #${fIdx + 1}`}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyLink(fUrl, fCopyKey)}
                                          className="text-[10px] font-bold text-slate-500 hover:text-purple-700 shrink-0"
                                        >
                                          {copiedKey === fCopyKey ? 'Copied' : 'Copy'}
                                        </button>
                                      </div>
                                      <a
                                        href={fUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#6734ff] to-[#7d3dff] hover:from-[#5e2ae6] hover:to-[#6f33ea] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform hover:scale-[1.01]"
                                      >
                                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Open Drive Folder</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <>
                                <a
                                  href={driveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6734ff] to-[#7d3dff] hover:from-[#5e2ae6] hover:to-[#6f33ea] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_10px_22px_rgba(103,52,255,0.22)] transition-transform hover:scale-[1.02]"
                                >
                                  <Download className="w-4 h-4 stroke-[2.5]" />
                                  <span>Open Google Drive Folder</span>
                                  <ArrowRight className="w-4 h-4" />
                                </a>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(driveUrl, copyKey)}
                                    className="text-[11px] font-bold text-slate-500 hover:text-purple-700 flex items-center gap-1 transition-colors"
                                  >
                                    {copiedKey === copyKey ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                        <span className="text-emerald-600">Copied to Clipboard!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy Drive Link</span>
                                      </>
                                    )}
                                  </button>

                                  <a
                                    href={driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1"
                                  >
                                    <span>Direct Link</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                      </div>
                    </article>
                  );
                })}

                {/* BONUS PACK IF ORDER BUMP ADDED */}
                {verifiedData?.hasBump && (
                  <article className="rounded-[22px] border border-amber-200 bg-gradient-to-r from-[#fffcf2] to-[#fffaf0] p-4 sm:p-5 shadow-[0_8px_24px_rgba(217,119,6,0.06)]">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                      <div className="md:col-span-3">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-amber-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={verifiedData?.orderBump?.thumbnail || "https://reelsbundles.in/wp-content/uploads/2026/10/3200-ultimate-twisted-world-reel-bundle-reels-bundle-1-2-768x576.png"}
                            alt={verifiedData?.orderBump?.title || "Bonus Reels Pack"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-600 text-[10px] font-black uppercase text-white">
                            ★ EXCLUSIVE BONUS
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-5 space-y-2">
                        <span className="text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          Order Bump Bonus Offer
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-amber-950">
                          {verifiedData?.orderBump?.title || "1500+ Ultimate Twisted World & Viral AI Reels Pack"}
                        </h3>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                          {verifiedData?.orderBump?.subtitle || "Extra bonus collection unlocked via checkout special offer. High retention surreal & reverse world AI animations."}
                        </p>
                      </div>

                      <div className="md:col-span-4">
                        <a
                          href={verifiedData?.orderBump?.googleDriveLink || "https://drive.google.com/drive/folders/bonus-pack-twisted-world"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_10px_22px_rgba(245,158,11,0.25)] transition-transform hover:scale-[1.02]"
                        >
                          <Download className="w-4 h-4 stroke-[2.5]" />
                          <span>Open Bonus Drive Folder</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </article>
                )}
              </div>
            </section>

            {/* STEP-BY-STEP DOWNLOAD & ACCESS GUIDE (.rbt-info-grid) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              
              {/* Left 4-Step Walkthrough */}
              <div className="lg:col-span-8 rounded-[24px] border border-[#e7e4f3] bg-white p-5 sm:p-7 shadow-[0_8px_24px_rgba(39,35,92,0.04)] space-y-4">
                <div className="flex items-center gap-2 text-[#5432cf]">
                  <Play className="w-4 h-4 fill-[#5432cf]" />
                  <h3 className="text-sm sm:text-base font-black text-[#5432cf] uppercase tracking-wide">
                    How to Download &amp; Save to Google Drive
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Step 1 */}
                  <div className="relative rounded-2xl border border-purple-100 bg-purple-50/40 p-4 text-center flex flex-col items-center justify-center space-y-2">
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#6e42ff] text-white text-[11px] font-black flex items-center justify-center">
                      1
                    </span>
                    <span className="text-2xl">📂</span>
                    <strong className="text-xs font-black text-[#17214a]">Open Drive</strong>
                    <p className="text-[11px] text-slate-500 font-medium">Click the button above to launch folder</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative rounded-2xl border border-purple-100 bg-purple-50/40 p-4 text-center flex flex-col items-center justify-center space-y-2">
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#6e42ff] text-white text-[11px] font-black flex items-center justify-center">
                      2
                    </span>
                    <span className="text-2xl">⭐</span>
                    <strong className="text-xs font-black text-[#17214a]">Add Shortcut</strong>
                    <p className="text-[11px] text-slate-500 font-medium">Click 3-dots to add shortcut or star</p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative rounded-2xl border border-purple-100 bg-purple-50/40 p-4 text-center flex flex-col items-center justify-center space-y-2">
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#6e42ff] text-white text-[11px] font-black flex items-center justify-center">
                      3
                    </span>
                    <span className="text-2xl">⬇️</span>
                    <strong className="text-xs font-black text-[#17214a]">Download</strong>
                    <p className="text-[11px] text-slate-500 font-medium">Download individual reels or whole folders</p>
                  </div>

                  {/* Step 4 */}
                  <div className="relative rounded-2xl border border-purple-100 bg-purple-50/40 p-4 text-center flex flex-col items-center justify-center space-y-2">
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#6e42ff] text-white text-[11px] font-black flex items-center justify-center">
                      4
                    </span>
                    <span className="text-2xl">🚀</span>
                    <strong className="text-xs font-black text-[#17214a]">Post &amp; Grow</strong>
                    <p className="text-[11px] text-slate-500 font-medium">Publish to Instagram, YouTube &amp; TikTok</p>
                  </div>
                </div>
              </div>

              {/* Right Important Tips */}
              <div className="lg:col-span-4 rounded-[24px] border border-[#fae8c8] bg-gradient-to-b from-[#fffaf0] to-white p-5 sm:p-7 shadow-[0_8px_24px_rgba(245,158,11,0.06)] space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-sm sm:text-base font-black text-[#8b5900] uppercase tracking-wide flex items-center gap-2">
                    <span>💡</span>
                    <span>Important Creator Tips</span>
                  </h3>
                  <ul className="space-y-2 text-xs text-[#4a526c] font-medium">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>Works seamlessly on Mobile (Google Drive App) &amp; PC / Mac.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>No zip extraction required — preview and stream directly in the cloud.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>1080p Full HD 9:16 vertical resolution with viral background audio.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-900 font-semibold">
                  Access anytime later by visiting our passwordless{' '}
                  <Link href="/my-order" className="underline font-black text-amber-950">
                    My Orders Portal
                  </Link>.
                </div>
              </div>

            </section>

            {/* UPSELL SECTION: IF USER BOUGHT A SINGLE BUNDLE, SHOW THE EXACT "Unlock Every Reels Bundle in One Plan" OFFER */}
            {!hasAllAccessPurchased && (
              <section className="relative rounded-[28px] sm:rounded-[34px] bg-gradient-to-br from-[#f8f4ff] via-[#fdf9fc] to-[#fef4f8] border border-[#eee3f8] p-5 sm:p-8 space-y-6 shadow-[0_14px_45px_rgba(91,40,224,0.06)] overflow-hidden">
                {/* Top Accent Bar */}
                <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-[#5e24d6] via-[#a22bc4] to-[#f43f85] rounded-b-full" />

                {/* Purple-to-Pink Header Banner matching the user uploaded image */}
                <div className="max-w-[660px] mx-auto relative rounded-[20px] bg-gradient-to-r from-[#5f1ec9] via-[#9128bd] to-[#d4369a] px-6 py-5 sm:px-8 sm:py-6 text-white shadow-[0_12px_30px_rgba(114,36,205,0.24)] overflow-hidden text-center">
                  <div className="pointer-events-none absolute -top-12 -right-8 w-44 h-44 rounded-full bg-white/10" />
                  <div className="hidden sm:block absolute left-3.5 top-4 bottom-4 w-[4px] bg-white/95 rounded-full" />

                  <div className="relative space-y-1">
                    <h2 className="text-xl sm:text-[28px] font-black text-white tracking-tight leading-tight">
                      Unlock Every Reels Bundle in One Plan
                    </h2>
                    <p className="text-xs sm:text-[13px] text-white/95 font-medium max-w-md mx-auto">
                      Choose Personal or Reseller access, pay once, and unlock every bundle included with your plan.
                    </p>
                  </div>
                </div>

                {/* Segmented Switcher */}
                <div className="max-w-[480px] mx-auto bg-[#eeeaf6] p-1.5 rounded-[18px] grid grid-cols-2 gap-1.5 border border-[#e2dcf0]">
                  <button
                    type="button"
                    onClick={() => setUpsellTab('personal')}
                    className={`py-2 px-3 rounded-[14px] text-left transition-all ${
                      upsellTab === 'personal'
                        ? 'bg-white shadow-[0_2px_10px_rgba(91,40,224,0.08)] border border-[#e5def5]'
                        : 'hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <div className={`text-xs font-extrabold ${upsellTab === 'personal' ? 'text-[#4c1d95]' : 'text-[#3f465a]'}`}>
                      Personal
                    </div>
                    <div className="text-[10.5px] text-[#525a70] font-medium">For your own pages</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUpsellTab('reseller')}
                    className={`py-2 px-3 rounded-[14px] text-left transition-all flex items-start justify-between gap-1 ${
                      upsellTab === 'reseller'
                        ? 'bg-white shadow-[0_2px_10px_rgba(91,40,224,0.08)] border border-[#e5def5]'
                        : 'hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <div>
                      <div className={`text-xs font-extrabold ${upsellTab === 'reseller' ? 'text-[#4c1d95]' : 'text-[#3f465a]'}`}>
                        Reseller
                      </div>
                      <div className="text-[10.5px] text-[#525a70] font-medium">For resale &amp; clients</div>
                    </div>
                    <span className="text-[9px] font-black uppercase text-[#9f1239] bg-[#ffe4ee] px-2 py-0.5 rounded-full shrink-0">
                      POPULAR
                    </span>
                  </button>
                </div>

                {/* Plan Content Card */}
                <div
                  className={`relative rounded-[24px] p-5 sm:p-7 space-y-6 transition-all ${
                    upsellTab === 'reseller'
                      ? 'bg-gradient-to-b from-[#fff6f9] to-[#fffcfc] border border-[#f8dbe5]'
                      : 'bg-gradient-to-b from-[#faf8ff] to-[#ffffff] border border-[#e8e1f7]'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    
                    {/* Left: Info + Price Box */}
                    <div className="md:col-span-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 ${
                            upsellTab === 'reseller'
                              ? 'bg-gradient-to-br from-[#ff4793] to-[#ec2677]'
                              : 'bg-gradient-to-br from-[#7e3af2] to-[#6324d6]'
                          }`}
                        >
                          {upsellTab === 'reseller' ? (
                            <ArrowUpRight className="w-5 h-5 text-white stroke-[2.5]" />
                          ) : (
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          )}
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              upsellTab === 'reseller'
                                ? 'bg-[#ffe4ee] text-[#9f1239]'
                                : 'bg-[#efe8ff] text-[#6c3cff]'
                            }`}
                          >
                            {upsellTab === 'reseller' ? 'RESELLER ACCESS' : 'PERSONAL ACCESS'}
                          </span>
                          <h4 className="text-base sm:text-lg font-black text-[#17214a] mt-1">
                            {upsellTab === 'reseller'
                              ? 'All Bundles + Reseller Rights'
                              : 'All Bundles – Personal Use'}
                          </h4>
                          <p className="text-xs text-[#5e6888] font-medium">
                            {upsellTab === 'reseller'
                              ? 'Built for resellers, agencies and creators who need broader commercial rights.'
                              : 'Premium ready-to-post reels for your own pages and channels.'}
                          </p>
                        </div>
                      </div>

                      {/* Price Box */}
                      <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm inline-block min-w-[240px]">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                          <span>ONE-TIME PRICE</span>
                          <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            {upsellTab === 'reseller' ? `${ALL_ACCESS_PLANS[1].discountPercentage}% OFF` : `${ALL_ACCESS_PLANS[0].discountPercentage}% OFF`}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <strong className="text-2xl font-black text-[#ff2d75]">
                            {upsellTab === 'reseller' ? `₹${ALL_ACCESS_PLANS[1].price}` : `₹${ALL_ACCESS_PLANS[0].price}`}
                          </strong>
                          <del className="text-xs font-bold text-slate-400">
                            {upsellTab === 'reseller' ? `₹${ALL_ACCESS_PLANS[1].originalPrice}` : `₹${ALL_ACCESS_PLANS[0].originalPrice}`}
                          </del>
                        </div>
                        <small className="block text-[11px] text-slate-500 font-semibold mt-0.5">
                          Pay once • Instant access
                        </small>
                      </div>
                    </div>

                    {/* Right: Bullet List & Best Value Badge */}
                    <div className="md:col-span-6 space-y-3">
                      <div className="flex justify-end">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white bg-[#ec2677] px-3 py-1 rounded-full shadow-sm">
                          BEST VALUE
                        </span>
                      </div>

                      <ul className="space-y-2 text-xs font-semibold text-[#20284c] border-t border-slate-100 pt-2">
                        <li className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-pink-100 text-[#ec2677] flex items-center justify-center text-[10px] font-black">
                            ✓
                          </span>
                          <span>Access to 129+ published reels bundles</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-pink-100 text-[#ec2677] flex items-center justify-center text-[10px] font-black">
                            ✓
                          </span>
                          <span>Import all bundles in one click</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-pink-100 text-[#ec2677] flex items-center justify-center text-[10px] font-black">
                            ✓
                          </span>
                          <span>Everything in Personal Plan</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-pink-100 text-[#ec2677] flex items-center justify-center text-[10px] font-black">
                            ✓
                          </span>
                          <span>Reseller rights included</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-pink-100 text-[#ec2677] flex items-center justify-center text-[10px] font-black">
                            ✓
                          </span>
                          <span>Priority VIP support</span>
                        </li>
                      </ul>
                    </div>

                  </div>

                  {/* Wide Button matching the screenshot */}
                  <Link
                    href={upsellTab === 'reseller' ? '/product/all-bundles-reseller-rights' : '/product/all-bundles-personal-use'}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ef2f32] via-[#ff4f21] to-[#ff7a00] hover:from-[#e02629] hover:to-[#f07000] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(238,72,27,0.28)] transition-transform hover:scale-[1.01]"
                  >
                    <span>{upsellTab === 'reseller' ? 'Get Reseller Access' : 'Get Personal Access'}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </Link>
                </div>
              </section>
            )}

            {/* ACTION CARDS STRIP (.rbt-actions) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. WhatsApp Support */}
              <a
                href={buildSupportWhatsAppUrl(
                  `Hi VaultWorld Support, I have an order query regarding Order ${verifiedData?.orderNumber || orderId}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-emerald-200/80 bg-[#f5fff9] p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-[#17214a]">VIP WhatsApp Support</h4>
                <p className="text-xs text-[#5e6888] font-medium leading-relaxed">
                  Need help downloading your files or have any question? Chat with our team.
                </p>
                <div className="pt-1 text-xs font-black text-emerald-700 flex items-center gap-1">
                  <span>Chat on WhatsApp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>

              {/* 2. My Orders Portal */}
              <Link
                href="/my-order"
                className="rounded-2xl border border-purple-200/80 bg-[#f8f6ff] p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-[#17214a]">My Orders Portal</h4>
                <p className="text-xs text-[#5e6888] font-medium leading-relaxed">
                  Access past orders and download folders anytime using your Gmail.
                </p>
                <div className="pt-1 text-xs font-black text-purple-700 flex items-center gap-1">
                  <span>Open Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>

              {/* 3. Telegram VIP */}
              <a
                href="https://t.me/vaultzet"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-sky-200/80 bg-[#f6fbff] p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-[#17214a]">Creator Community</h4>
                <p className="text-xs text-[#5e6888] font-medium leading-relaxed">
                  Join 15,000+ creators for daily trending audio, hooks &amp; viral reels updates.
                </p>
                <div className="pt-1 text-xs font-black text-sky-700 flex items-center gap-1">
                  <span>Join Telegram</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>

              {/* 4. Continue Shopping */}
              <Link
                href="/shop"
                className="rounded-2xl border border-purple-200/80 bg-[#fbf9ff] p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Flame className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-[#17214a]">Browse 48+ Categories</h4>
                <p className="text-xs text-[#5e6888] font-medium leading-relaxed">
                  Discover AI influencers, luxury lifestyle, fitness, spiritual &amp; trending reels.
                </p>
                <div className="pt-1 text-xs font-black text-purple-700 flex items-center gap-1">
                  <span>Explore Shop</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </section>

            {/* TRUST STRIP (.rbt-trust) */}
            <section className="rounded-2xl border border-[#e7e4f3] bg-white p-4 sm:p-5 shadow-[0_6px_20px_rgba(39,35,92,0.03)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center sm:text-left">
                <div className="flex items-center gap-2.5 p-2">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">Virus Free</strong>
                    <small className="block text-[11px] text-slate-400 font-semibold">100% Clean Files</small>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2">
                  <span className="text-xl">⚡</span>
                  <div>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">Instant Delivery</strong>
                    <small className="block text-[11px] text-slate-400 font-semibold">Direct Cloud Access</small>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2">
                  <span className="text-xl">🔄</span>
                  <div>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">Free Updates</strong>
                    <small className="block text-[11px] text-slate-400 font-semibold">Lifetime Cloud Sync</small>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2">
                  <span className="text-xl">🔒</span>
                  <div>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">256-Bit SSL</strong>
                    <small className="block text-[11px] text-slate-400 font-semibold">PayU Verified</small>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 col-span-2 sm:col-span-1">
                  <span className="text-xl">💬</span>
                  <div>
                    <strong suppressHydrationWarning className="block text-xs font-black text-[#17214a]">24/7 Support</strong>
                    <small className="block text-[11px] text-slate-400 font-semibold">Creator Assistance</small>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

      </div>
    </div>
  );
}

class OrderSuccessErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OrderSuccess Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen py-16 px-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white flex items-center justify-center">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Payment Received &amp; Verified
              </span>
              <h2 className="text-2xl font-black text-white">Your Order is Safe!</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your payment was successfully received. You can access your reels bundle directly via Google Drive or contact our 24/7 WhatsApp support.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <a
                href="https://drive.google.com/drive/folders/vaultworld-master-access"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Google Drive Access</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={buildSupportWhatsAppUrl(
                  'Hi VaultWorld Support, I have completed my payment and need my download access.'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Chat with WhatsApp Support</span>
              </a>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Reload Confirmation Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function OrderSuccessPage() {
  return (
    <OrderSuccessErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen py-24 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-purple-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-500">Loading order verification...</p>
          </div>
        }
      >
        <OrderSuccessContent />
      </Suspense>
    </OrderSuccessErrorBoundary>
  );
}
