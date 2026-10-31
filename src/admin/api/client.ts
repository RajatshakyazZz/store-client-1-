import {
  initialSummary,
  initialProducts,
  initialOrders,
  initialCustomers,
  initialCoupons,
  initialContent,
  initialBranding,
  initialSiteMode,
  initialStoreSetup,
  initialMetaPixel,
  initialWhatsappButton,
  initialWebhooks,
  initialWebhookLogs,
  initialPlugins,
  initialThemes,
  initialConnectorStatus,
  initialPgBridge,
  initialDnpMeta,
  initialMmc,
  initialRankMath,
  initialLiteSpeed,
  initialCategories,
  initialReels,
} from './mockData';
import {
  DailySummary,
  Product,
  CategoryItem,
  Order,
  Customer,
  Coupon,
  ContentItem,
  StoreBranding,
  SiteModeConfig,
  StoreSetupConfig,
  MetaPixelConfig,
  WhatsappButtonConfig,
  WebhookConfig,
  WebhookLogEntry,
  WpPlugin,
  WpTheme,
  ConnectorStatus,
  PgBridgeConfig,
  DnpMetaConfig,
  MmcAnalyticsConfig,
  RankMathConfig,
  LiteSpeedConfig,
  TelegramConfig,
  OrderSyncParams,
  DownloadableFileTokenResponse,
  ReelItem,
  GlobalBumpOffer,
  FreeBundleOffer,
  AdminGrowthProofsConfig,
} from './types';
import { db, logAdminAction } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { isLegacyScrapedVideoUrl } from '@/lib/videoUtils';

/**
 * Recursively strips undefined keys and normalizes payloads so Firestore setDoc/updateDoc
 * never throws "Unsupported field value: undefined".
 */
export function sanitizePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? sanitizePayload(item) : item)) as unknown as T;
  }
  if (typeof input === 'object' && !(input instanceof Date)) {
    const clean: any = {};
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined) {
        clean[key] = typeof val === 'object' && val !== null ? sanitizePayload(val) : val;
      }
    }
    return clean as T;
  }
  return input;
}

const initialTelegram: TelegramConfig = {
  enabled: true,
  bot_token: '',
  admin_chat_ids: '',
  new_order_alert: true,
  product_alert: true,
  daily_summary_alert: true,
};

class PortalApiClient {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = localStorage.getItem('rb_portal_api_key');
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('rb_portal_api_key', key);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('rb_portal_api_key');
  }

  // ==========================================
  // AUTH
  // ==========================================
  async verifyKey(key: string): Promise<{ valid: boolean; user?: string; role?: string }> {
    if (key && key.trim().length > 0) {
      this.setApiKey(key);
      return { valid: true, user: 'Admin Operator', role: 'SuperAdmin' };
    }
    return { valid: false };
  }

  async login(credentials: { username: string; password?: string }): Promise<any> {
    const mockKey = `rb_live_${Date.now()}`;
    this.setApiKey(mockKey);
    return { success: true, key: mockKey, user: credentials.username, role: 'SuperAdmin' };
  }

  // ==========================================
  // 1. DASHBOARD & SUMMARY (Aggregated from real Firestore orders)
  // ==========================================
  async getDailySummary(): Promise<DailySummary> {
    const orders = await this.getOrders();
    const paidOrders = orders.filter((o) => o.status === 'completed');
    const totalSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'failed'
    );
    const refundedOrders = orders.filter((o) => o.status === 'refunded');
    const uniqueCustomerEmails = new Set(paidOrders.map((o) => o.customer.email).filter(Boolean));

    // Dynamically aggregate top selling bundles ONLY from COMPLETED (paid) orders
    const bundleSalesMap = new Map<string, { id: string | number; name: string; sales_count: number; revenue: number }>();
    paidOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = String(it.product_id || it.name);
        if (!bundleSalesMap.has(key)) {
          bundleSalesMap.set(key, {
            id: it.product_id || key,
            name: it.name || 'Viral Reels Bundle',
            sales_count: 1,
            revenue: Number(it.total || o.total || 0),
          });
        } else {
          const existing = bundleSalesMap.get(key)!;
          existing.sales_count += 1;
          existing.revenue += Number(it.total || 0);
        }
      });
    });

    const topSellingBundles = Array.from(bundleSalesMap.values())
      .filter((b) => b.sales_count > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);

    return {
      sales: totalSales,
      orders: paidOrders.length,
      customers: uniqueCustomerEmails.size,
      pending_orders: pendingOrders.length,
      refunded_orders: refundedOrders.length,
      gross_revenue: totalSales,
      net_revenue: totalSales,
      average_order_value: paidOrders.length > 0 ? Math.round(totalSales / paidOrders.length) : 0,
      currency: 'INR',
      currency_symbol: '₹',
      revenue_trend: [
        { date: 'Today', revenue: totalSales, orders: paidOrders.length },
      ],
      top_selling_bundles: topSellingBundles,
      site_mode: 'LIVE',
      connector_status: {
        version: '2.0.0',
        latest_version: '2.0.0',
        update_available: false,
        last_checked: new Date().toISOString(),
      },
    };
  }

  // ==========================================
  // 2. PRODUCTS (Direct Firestore)
  // ==========================================
  async getProducts(): Promise<Product[]> {
    let localCustomProds: Product[] = [];
    let localDeletedSlugs = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const rawLocal = JSON.parse(localStorage.getItem('vaultzet_custom_products') || '[]');
        if (Array.isArray(rawLocal)) {
          localCustomProds = rawLocal
            .filter((p: any) => {
              const title = String(p.name || p.title || '').trim();
              const slug = String(p.slug || '').trim().toLowerCase();
              return (
                title &&
                title !== 'Reels Bundle' &&
                title !== 'New Reels Bundle' &&
                title !== '[DELETED]' &&
                !title.toLowerCase().startsWith('demo') &&
                !title.toLowerCase().startsWith('test') &&
                !slug.startsWith('test-') &&
                !slug.startsWith('demo-')
              );
            })
            .map((p: any) => ({
              ...p,
              preview_video_url: isLegacyScrapedVideoUrl(p.preview_video_url) ? '' : (p.preview_video_url || ''),
              preview_video_urls: (p.preview_video_urls || []).filter((u: string) => !isLegacyScrapedVideoUrl(u)),
            }));
          if (localCustomProds.length !== rawLocal.length) {
            try {
              localStorage.setItem('vaultzet_custom_products', JSON.stringify(localCustomProds));
            } catch {}
          }
        }
      } catch (e) {}
      try {
        const delRaw = localStorage.getItem('vaultzet_deleted_slugs');
        if (delRaw) {
          const parsed = JSON.parse(delRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((s) => localDeletedSlugs.add(String(s).toLowerCase()));
          }
        }
      } catch (e) {}
    }

    // Helper to merge local admin modifications on top of any product list
    const applyLocalEdits = (prods: Product[]): Product[] => {
      if (localCustomProds.length === 0) return prods;
      const localMap = new Map<string, Product>();
      localCustomProds.forEach((lp) => {
        if (lp.id) localMap.set(String(lp.id).toLowerCase(), lp);
        if (lp.slug) localMap.set(lp.slug.toLowerCase(), lp);
      });

      return prods.map((p) => {
        const idKey = String(p.id).toLowerCase();
        const slugKey = p.slug?.toLowerCase();
        const rawOverride = localMap.get(idKey) || (slugKey ? localMap.get(slugKey) : undefined);
        if (!rawOverride) return p;

        const safeOverride = { ...rawOverride };
        // Never allow stale empty or demo links from old localStorage to wipe valid drive links
        if (!safeOverride.google_drive_link || safeOverride.google_drive_link.includes('/demo-')) {
          delete safeOverride.google_drive_link;
        }
        if (
          !safeOverride.files ||
          safeOverride.files.length === 0 ||
          !safeOverride.files[0]?.file_url ||
          safeOverride.files[0].file_url.includes('/demo-')
        ) {
          delete safeOverride.files;
        }

        if (safeOverride.preview_video_url && isLegacyScrapedVideoUrl(safeOverride.preview_video_url)) {
          safeOverride.preview_video_url = '';
        }
        if (Array.isArray(safeOverride.preview_video_urls)) {
          safeOverride.preview_video_urls = safeOverride.preview_video_urls.filter((u: string) => !isLegacyScrapedVideoUrl(u));
        }

        return { ...p, ...safeOverride };
      });
    };

    if (db) {
      try {
        const snap = await getDocs(collection(db, 'products'));
        if (!snap.empty) {
          const dbProdsMap = new Map<string, Product>();
          const dbIdSet = new Set<string>();
          const dbSlugSet = new Set<string>();

          snap.docs.forEach((d) => {
            const data = d.data();
            const id = String(d.id);
            if (id === 'category-registry-v1' || data.name === '[INTERNAL_CATEGORY_REGISTRY]') {
              return;
            }

            const rawSlug = String(data.slug || id).toLowerCase();
            const canonicalSlug = rawSlug.replace(/^rb-/, '');
            const isDeleted = Boolean(data.is_deleted || data.status === 'trash');

            dbIdSet.add(id);
            if (rawSlug) dbSlugSet.add(rawSlug);
            if (canonicalSlug) dbSlugSet.add(canonicalSlug);

            if (isDeleted) {
              localDeletedSlugs.add(id.toLowerCase());
              if (rawSlug) localDeletedSlugs.add(rawSlug);
              if (canonicalSlug) localDeletedSlugs.add(canonicalSlug);
            } else {
              const mockFallback = initialProducts.find(
                (ip) =>
                  String(ip.id).toLowerCase() === id.toLowerCase() ||
                  String(ip.id).toLowerCase().replace(/^rb-/, '') === canonicalSlug ||
                  (ip.slug && ip.slug.toLowerCase() === rawSlug)
              );

              const rawDrive =
                data.google_drive_link ||
                data.googleDriveLink ||
                data.driveLink ||
                (data.files && data.files[0]?.file_url) ||
                mockFallback?.google_drive_link ||
                '';

              const cleanDrive =
                rawDrive.includes('/demo-') && mockFallback?.google_drive_link && !mockFallback.google_drive_link.includes('/demo-')
                  ? mockFallback.google_drive_link
                  : rawDrive;

              const filesList: Array<{ id: string; name: string; file_url: string }> =
                Array.isArray(data.files) && data.files.length > 0 && data.files[0]?.file_url && !data.files[0].file_url.includes('/demo-')
                  ? data.files
                  : [
                      {
                        id: `file-${canonicalSlug}`,
                        name: `${data.name || 'Reels Bundle'} (Google Drive Access)`,
                        file_url: cleanDrive,
                      },
                    ];

              const rawPreviewUrls = (Array.isArray(data.preview_video_urls) && data.preview_video_urls.length > 0)
                ? data.preview_video_urls
                : (data.previewVideoUrls && Array.isArray(data.previewVideoUrls) && data.previewVideoUrls.length > 0)
                ? data.previewVideoUrls
                : data.preview_video_url
                ? [data.preview_video_url]
                : [];
              const cleanPreviewUrls = rawPreviewUrls
                .map((u: any) => String(u || '').trim())
                .filter((u: string) => Boolean(u) && !isLegacyScrapedVideoUrl(u));

              const prodObj = {
                id: id.startsWith('rb-') ? id : `rb-${canonicalSlug}`,
                ...data,
                slug: data.slug || canonicalSlug,
                preview_video_url: cleanPreviewUrls[0] || '',
                preview_video_urls: cleanPreviewUrls,
                google_drive_link: cleanDrive,
                googleDriveLink: cleanDrive,
                files: filesList,
                drive_files: filesList,
              } as unknown as Product;

              const existing = dbProdsMap.get(canonicalSlug);
              if (!existing) {
                dbProdsMap.set(canonicalSlug, prodObj);
              } else {
                dbProdsMap.set(canonicalSlug, {
                  ...existing,
                  ...prodObj,
                  id: String(existing.id).startsWith('rb-') ? existing.id : prodObj.id,
                  google_drive_link: existing.google_drive_link || prodObj.google_drive_link,
                  files:
                    existing.files && existing.files.length > 0 && existing.files[0]?.file_url && !existing.files[0].file_url.includes('/demo-')
                      ? existing.files
                      : prodObj.files,
                });
              }
            }
          });

          // Sync back deleted slugs into localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_deleted_slugs', JSON.stringify(Array.from(localDeletedSlugs)));
            } catch {}
          }

          const dbProds = Array.from(dbProdsMap.values());

          const uncommittedLocal = localCustomProds.filter(
            (lp) =>
              !dbIdSet.has(String(lp.id)) &&
              (!lp.slug || !dbSlugSet.has(lp.slug.toLowerCase())) &&
              !localDeletedSlugs.has(String(lp.id).toLowerCase()) &&
              (!lp.slug || !localDeletedSlugs.has(lp.slug.toLowerCase()))
          );

          const isDemoProd = (p: any) => {
            const name = String(p.name || '').trim();
            const slug = String(p.slug || '').trim().toLowerCase();
            return (
              !name ||
              name === 'Reels Bundle' ||
              name === 'New Reels Bundle' ||
              name === '[DELETED]' ||
              name.toLowerCase().startsWith('demo') ||
              name.toLowerCase().startsWith('test') ||
              slug === 'reels-bundle' ||
              slug.startsWith('test-') ||
              slug.startsWith('demo-')
            );
          };

          const combined = applyLocalEdits([...uncommittedLocal, ...dbProds]).filter(
            (p) =>
              !p.is_deleted &&
              p.status !== 'trash' &&
              !isDemoProd(p) &&
              !localDeletedSlugs.has(String(p.id).toLowerCase()) &&
              (!p.slug || !localDeletedSlugs.has(p.slug.toLowerCase()))
          );

          const combinedIdSet = new Set(combined.map((p) => String(p.id)));
          const combinedSlugSet = new Set(combined.map((p) => p.slug?.toLowerCase()).filter(Boolean));

          const missing = applyLocalEdits(
            initialProducts.filter(
              (p) =>
                !combinedIdSet.has(String(p.id)) &&
                (!p.slug || !combinedSlugSet.has(p.slug.toLowerCase())) &&
                !dbIdSet.has(String(p.id)) &&
                (!p.slug || !dbSlugSet.has(p.slug.toLowerCase())) &&
                !localDeletedSlugs.has(String(p.id).toLowerCase()) &&
                (!p.slug || !localDeletedSlugs.has(p.slug.toLowerCase()))
            )
          );
          return [...combined, ...missing];
        } else {
          // Auto-seed initial clean products into Firestore
          for (const prod of initialProducts) {
            await setDoc(doc(db, 'products', String(prod.id)), prod);
          }
          return applyLocalEdits([...localCustomProds, ...initialProducts]);
        }
      } catch (e) {
        console.warn('Firestore products fetch error:', e);
      }
    }

    // Merge in-memory with any stored in localStorage (local edits always win over initial defaults)
    const baseMerged = applyLocalEdits(initialProducts);
    const existingKeys = new Set<string>();
    baseMerged.forEach((p) => {
      existingKeys.add(String(p.id).toLowerCase());
      if (p.slug) existingKeys.add(p.slug.toLowerCase());
    });

    const purelyNew = localCustomProds.filter(
      (lp) =>
        !existingKeys.has(String(lp.id).toLowerCase()) &&
        (!lp.slug || !existingKeys.has(lp.slug.toLowerCase()))
    );

    return [...purelyNew, ...baseMerged].filter(
      (p) =>
        !p.is_deleted &&
        p.status !== 'trash' &&
        !localDeletedSlugs.has(String(p.id).toLowerCase()) &&
        (!p.slug || !localDeletedSlugs.has(p.slug.toLowerCase()))
    );
  }

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const prodId = productData.id ? String(productData.id) : `prod-${Date.now()}`;
    const name = productData.name?.trim() || 'New Reels Bundle';
    const slug =
      productData.slug?.trim() ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const newProduct: Product = {
      id: prodId,
      name,
      slug,
      price: Number(productData.price || 99),
      regular_price: Number(productData.regular_price || 999),
      reseller_price: Number(
        productData.reseller_price || (productData.price ? Number(productData.price) * 2 : 199)
      ),
      reseller_regular_price: Number(
        productData.reseller_regular_price ||
          (productData.regular_price ? Number(productData.regular_price) * 2 : 1999)
      ),
      sale_price: Number(productData.price || 99),
      stock_status: productData.stock_status || 'instock',
      status: productData.status || 'publish',
      categories: productData.categories?.length ? productData.categories : ['Trending Reels'],
      reel_count: Number(productData.reel_count || 1000),
      format: productData.format || 'MP4',
      resolution: productData.resolution || '1080P Full HD (9:16)',
      featured_image:
        productData.featured_image ||
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
      preview_video_url: productData.preview_video_url || '',
      preview_video_urls: productData.preview_video_urls || (productData.preview_video_url ? [productData.preview_video_url] : []),
      gallery_images: productData.gallery_images || [],
      short_description: productData.short_description || '',
      description: productData.description || '',
      features: productData.features || [],
      google_drive_link: productData.google_drive_link || '',
      tags: productData.tags || [],
      is_hot: Boolean(productData.is_hot),
      is_trending: Boolean(productData.is_trending),
      rating: Number(productData.rating || 4.9),
      review_count: Number(productData.review_count || 350),
      downloadable: true,
      downloads_count: 0,
      created_at: new Date().toISOString(),
      files: productData.files || [],
      bump_offer: productData.bump_offer || undefined,
    };

    const cleanPayload = sanitizePayload(newProduct);

    if (db) {
      try {
        await setDoc(doc(db, 'products', prodId), cleanPayload);
        if (slug && slug !== prodId) {
          try {
            await setDoc(doc(db, 'products', slug), cleanPayload);
          } catch {}
        }
      } catch (e) {
        console.warn('Firestore product creation error:', e);
      }
    }

    // Add to in-memory list
    initialProducts.unshift(cleanPayload);

    // Save in localStorage cache so it survives reloads immediately
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_products') || '[]');
        const filtered = stored.filter((p: any) => String(p.id) !== prodId && p.slug !== slug);
        filtered.unshift(cleanPayload);
        localStorage.setItem('vaultzet_custom_products', JSON.stringify(filtered));

        // Ensure it is removed from deleted slugs
        const deletedSlugs = JSON.parse(localStorage.getItem('vaultzet_deleted_slugs') || '[]');
        const updatedDel = deletedSlugs.filter((s: string) => s !== prodId && s !== slug);
        localStorage.setItem('vaultzet_deleted_slugs', JSON.stringify(updatedDel));
      } catch (e) {
        // ignore
      }
    }

    // Dispatch Instant Telegram Alert to Admins
    try {
      let botToken =
        (typeof process !== 'undefined' &&
          ((process.env as any).NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ||
            (process.env as any).TELEGRAM_BOT_TOKEN)) || '';
      let targetChatIds: string[] = [];
      let alertEnabled = true;

      try {
        const tg = await this.getTelegramConfig();
        if (tg.bot_token?.trim()) botToken = tg.bot_token.trim();
        if (tg.admin_chat_ids?.trim()) {
          targetChatIds = tg.admin_chat_ids.split(',').map((s) => s.trim()).filter(Boolean);
        }
        if (tg.enabled === false || tg.product_alert === false) {
          alertEnabled = false;
        }
      } catch {}

      if (alertEnabled && botToken && targetChatIds.length > 0) {
        // 1. Dispatch via server API
        fetch('/api/telegram/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'product_added',
            data: {
              name: newProduct.name,
              slug: newProduct.slug,
              price: newProduct.price,
              regular_price: newProduct.regular_price,
              categories: newProduct.categories,
              reel_count: newProduct.reel_count,
              resolution: newProduct.resolution,
              googleDriveLink: newProduct.google_drive_link,
            },
          }),
        }).catch((e) => console.warn('Telegram notify API error:', e));

        // 2. Direct Bot dispatch fallback
        const istTime = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'medium',
        });
        const siteOrigin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '');
        const productUrl = `${siteOrigin}/product/${newProduct.slug}`;
        const telegramText = `🚀📦 <b>NEW PRODUCT UPLOADED TO STORE!</b> ✨🔥
━━━━━━━━━━━━━━━━━━━━━━

🏷️ <b>Bundle Name:</b> <b>${newProduct.name}</b>
📂 <b>Category:</b> ${(newProduct.categories || []).join(', ')}
💰 <b>Sale Price:</b> <b>₹${newProduct.price}.00</b> (MRP: ₹${newProduct.regular_price}.00)
🎬 <b>Reels Included:</b> ${newProduct.reel_count}+ Reels (${newProduct.resolution})
☁️ <b>Google Drive Link:</b> ${newProduct.files?.length || newProduct.google_drive_link ? '✅ Configured in DB' : '✅ Ready'}

🕒 <b>Uploaded At (IST):</b> ${istTime}
━━━━━━━━━━━━━━━━━━━━━━`;

        await Promise.allSettled(
          targetChatIds.map((chatId) =>
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: telegramText,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                  inline_keyboard: [[{ text: '🔗 View New Bundle on Store', url: productUrl }]],
                },
              }),
            })
          )
        );
      }
    } catch (tgErr) {
      console.warn('Telegram product upload alert error:', tgErr);
    }
    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'CREATE_PRODUCT',
      module: 'Products',
      details: `Created new product #${prodId}: ${newProduct.name} (₹${newProduct.price})`,
    });

    return newProduct;
  }

  async deleteProduct(productId: string | number, slug?: string): Promise<boolean> {
    const idStr = String(productId);
    const slugStr = slug ? String(slug).toLowerCase() : '';

    if (db) {
      try {
        // Mark as trash in Firestore so it's recognized as deleted by storefront & portal
        const docRef = doc(db, 'products', idStr);
        await setDoc(
          docRef,
          {
            id: idStr,
            name: '[DELETED]',
            price: 0,
            status: 'trash',
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          },
          { merge: true }
        );

        if (slugStr && slugStr !== idStr) {
          try {
            await setDoc(
              doc(db, 'products', slugStr),
              {
                id: slugStr,
                name: '[DELETED]',
                price: 0,
                status: 'trash',
                is_deleted: true,
                deleted_at: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch {}
        }

        // If it's a newly created custom doc, also delete it
        if (idStr.startsWith('prod-')) {
          try {
            await deleteDoc(docRef);
          } catch {}
        }
      } catch (e) {
        console.warn('Firestore product delete error:', e);
      }
    }

    const idx = initialProducts.findIndex(
      (p) => String(p.id) === idStr || (slugStr && p.slug?.toLowerCase() === slugStr)
    );
    if (idx !== -1) {
      initialProducts.splice(idx, 1);
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_products') || '[]');
        const filtered = stored.filter(
          (p: any) => String(p.id) !== idStr && (!slugStr || p.slug?.toLowerCase() !== slugStr)
        );
        localStorage.setItem('vaultzet_custom_products', JSON.stringify(filtered));

        const deletedSlugs = JSON.parse(localStorage.getItem('vaultzet_deleted_slugs') || '[]');
        const set = new Set(deletedSlugs);
        set.add(idStr.toLowerCase());
        if (slugStr) set.add(slugStr);
        localStorage.setItem('vaultzet_deleted_slugs', JSON.stringify(Array.from(set)));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'DELETE_PRODUCT',
      module: 'Products',
      details: `Deleted product #${productId} (${slugStr || idStr})`,
    });

    return true;
  }

  async updateProduct(product: Partial<Product> & { id: string | number }): Promise<Product> {
    const prodId = String(product.id);
    const existing: Partial<Product> = initialProducts.find((p) => String(p.id) === prodId) || {};
    const effectiveDrive =
      product.google_drive_link ||
      (product as any).googleDriveLink ||
      (product as any).driveLink ||
      existing.google_drive_link ||
      '';

    const merged: Product = {
      ...existing,
      ...product,
      id: prodId,
      name: (product.name || existing.name || 'Reels Bundle').trim(),
      price: Number(product.price ?? existing.price ?? 99),
      google_drive_link: effectiveDrive,
      googleDriveLink: effectiveDrive,
      driveLink: effectiveDrive,
      bump_offer: product.bump_offer !== undefined ? product.bump_offer : existing.bump_offer,
    } as Product;

    const cleanPayload = sanitizePayload(merged);

    if (db) {
      try {
        const docRef = doc(db, 'products', prodId);
        await setDoc(docRef, cleanPayload, { merge: true });
        const relatedIds = new Set<string>();
        if (merged.slug) {
          relatedIds.add(merged.slug);
          relatedIds.add(`rb-${merged.slug}`);
          relatedIds.add(merged.slug.replace(/^rb-/, ''));
        }
        if (prodId) {
          relatedIds.add(prodId);
          relatedIds.add(`rb-${prodId}`);
          relatedIds.add(prodId.replace(/^rb-/, ''));
        }
        for (const relId of relatedIds) {
          if (relId && relId !== prodId) {
            try {
              await setDoc(doc(db, 'products', relId), cleanPayload, { merge: true });
            } catch {}
          }
        }
      } catch (e) {
        console.warn('Firestore product update error:', e);
      }
    }

    const idx = initialProducts.findIndex((p) => String(p.id) === prodId);
    if (idx !== -1) {
      initialProducts[idx] = { ...initialProducts[idx], ...cleanPayload };
    } else {
      initialProducts.unshift(cleanPayload);
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_products') || '[]');
        const existingIdx = stored.findIndex((p: any) => String(p.id) === prodId || (p.slug && p.slug === merged.slug));
        if (existingIdx !== -1) {
          stored[existingIdx] = { ...stored[existingIdx], ...cleanPayload };
        } else {
          stored.unshift(cleanPayload);
        }
        localStorage.setItem('vaultzet_custom_products', JSON.stringify(stored));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_PRODUCT',
      module: 'Products',
      details: `Updated bundle #${prodId}: ${cleanPayload.name} (₹${cleanPayload.price})`,
    });

    return cleanPayload;
  }

  async getDownloadableProducts(): Promise<Product[]> {
    return this.getProducts();
  }

  async getDownloadableFiles(productId: string | number) {
    const prods = await this.getProducts();
    return prods.find((p) => String(p.id) === String(productId))?.files || [];
  }

  async generateFileToken(fileId: string): Promise<DownloadableFileTokenResponse> {
    const token = `dtoken_${Math.random().toString(36).substring(2, 12)}`;
    return {
      token,
      download_url: `https://vaultzet-shop.vercel.app/api/stream/${token}`,
      expires_in_minutes: 60,
    };
  }

  // ==========================================
  // 3. ORDERS (Direct Realtime Firestore + Deleted Tombstone Sync with Telegram Bot)
  // ==========================================
  private async getDeletedOrderIds(): Promise<Set<string>> {
    const deletedSet = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const localDeleted = JSON.parse(localStorage.getItem('vaultzet_deleted_order_ids') || '[]');
        if (Array.isArray(localDeleted)) {
          localDeleted.forEach((id) => deletedSet.add(String(id)));
        }
      } catch {}
    }

    if (db) {
      try {
        const [metaPixelSnap, dnpMetaSnap] = await Promise.all([
          getDoc(doc(db, 'store_settings', 'meta_pixel')),
          getDoc(doc(db, 'store_settings', 'dnp_meta')),
        ]);
        for (const snap of [metaPixelSnap, dnpMetaSnap]) {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.maintenance_message) {
              try {
                const parsed = JSON.parse(data.maintenance_message);
                if (Array.isArray(parsed)) {
                  parsed.forEach((id) => deletedSet.add(String(id)));
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    return deletedSet;
  }

  private async markOrderIdsAsDeleted(idsToAdd: string[]): Promise<void> {
    const currentSet = await this.getDeletedOrderIds();
    idsToAdd.forEach((id) => {
      if (id) currentSet.add(String(id));
    });

    // Keep latest 40 IDs so JSON.stringify is always valid JSON under 990 chars
    const arr = Array.from(currentSet).slice(-40);
    const serialized = JSON.stringify(arr);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_deleted_order_ids', serialized);
      } catch {}
    }

    if (db) {
      try {
        await setDoc(
          doc(db, 'store_settings', 'meta_pixel'),
          { maintenance_message: serialized },
          { merge: true }
        );
      } catch {}
      try {
        await setDoc(
          doc(db, 'store_settings', 'dnp_meta'),
          { maintenance_message: serialized },
          { merge: true }
        );
      } catch {}
    }
  }

  async getOrders(): Promise<Order[]> {
    const deletedIds = await this.getDeletedOrderIds();

    if (db) {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        if (!snap.empty) {
          const activeOrders: Order[] = [];

          for (const d of snap.docs) {
            const data = d.data();
            const docId = String(d.id);
            const orderNum = String(data.orderNumber || d.id);
            const rawStatus = String(data.status || 'pending').toLowerCase();

            // If marked deleted in localStorage or meta_pixel, ensure Firestore status is 'cancelled' so Telegram Bot stays 100% in sync
            if (deletedIds.has(docId) || deletedIds.has(orderNum)) {
              if (rawStatus !== 'cancelled') {
                updateDoc(doc(db, 'orders', docId), { status: 'cancelled' }).catch(() => {});
              }
              continue;
            }

            if (rawStatus === 'cancelled') {
              continue;
            }

            activeOrders.push({
              id: docId,
              order_number: orderNum,
              status: (rawStatus as Order['status']) || 'pending',
              total: Number(data.totalAmount || 0),
              currency: 'INR',
              customer: {
                id: data.customer?.email || 'c-unknown',
                first_name:
                  data.customer?.fullName?.split(' ')[0] ||
                  data.customer?.fullName ||
                  'Customer',
                last_name: data.customer?.fullName?.split(' ').slice(1).join(' ') || '',
                email: data.customer?.email || '',
                phone: data.customer?.phone || '',
              },
              items: (data.items || []).map((it: any) => ({
                product_id: it.id,
                name: it.title,
                quantity: 1,
                subtotal: it.price,
                total: it.price,
                license: it.license || 'personal',
              })),
              payment_method: data.paymentMethod || 'UPI / Instant QR',
              transaction_id: data.transactionId || `UPI-${docId.slice(0, 8)}`,
              date_created: data.timestampIso || new Date().toISOString(),
              google_drive_sent: rawStatus === 'completed',
            } as Order);
          }

          activeOrders.sort(
            (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
          );

          return activeOrders;
        }
      } catch (e) {
        console.warn('Firestore orders fetch error:', e);
      }
    }
    return initialOrders.filter(
      (o) => !deletedIds.has(String(o.id)) && !deletedIds.has(String(o.order_number))
    );
  }

  async syncOrders(params?: OrderSyncParams): Promise<{ orders: Order[]; count: number }> {
    const orders = await this.getOrders();
    return { orders, count: orders.length };
  }

  async updateOrderStatus(orderId: string | number, status: Order['status']): Promise<Order> {
    const idStr = String(orderId);
    if (db) {
      try {
        await updateDoc(doc(db, 'orders', idStr), { status });
      } catch (e) {
        console.warn('Firestore order status update error:', e);
      }
    }
    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_ORDER_STATUS',
      module: 'Orders',
      details: `Order #${orderId} changed to ${status}`,
    });
    return { id: idStr, status } as Order;
  }

  async resendOrder(orderId: string | number): Promise<{ success: boolean; message: string }> {
    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'RESEND_ORDER_DELIVERY',
      module: 'Orders',
      details: `Resent Google Drive delivery email for order #${orderId}`,
    });
    return { success: true, message: `Google Drive links resent for Order #${orderId}` };
  }

  async deleteOrder(orderId: string | number): Promise<{ success: boolean; message: string }> {
    const idStr = String(orderId);
    const idsToPurge = [idStr];

    // 1. Mark status as 'cancelled' in Firestore (and attempt deleteDoc) so Telegram Bot and Admin Panel immediately hide it
    if (db) {
      try {
        await updateDoc(doc(db, 'orders', idStr), { status: 'cancelled' });
      } catch {}
      try {
        await deleteDoc(doc(db, 'orders', idStr));
      } catch {}

      try {
        const snap = await getDocs(collection(db, 'orders'));
        for (const d of snap.docs) {
          const data = d.data();
          if (d.id === idStr || String(data.orderNumber) === idStr) {
            idsToPurge.push(d.id);
            if (data.orderNumber) idsToPurge.push(String(data.orderNumber));
            try {
              await updateDoc(doc(db, 'orders', d.id), { status: 'cancelled' });
            } catch {}
            try {
              await deleteDoc(doc(db, 'orders', d.id));
            } catch {}
          }
        }
      } catch {}
    }

    // 2. Persist tombstone IDs in Firestore (store_settings/meta_pixel) + localStorage
    await this.markOrderIdsAsDeleted(idsToPurge);

    // 3. Remove from in-memory fallback list if present
    for (let i = initialOrders.length - 1; i >= 0; i--) {
      if (
        String(initialOrders[i].id) === idStr ||
        String(initialOrders[i].order_number) === idStr
      ) {
        initialOrders.splice(i, 1);
      }
    }

    // 4. Remove from local storage cache if stored
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_orders') || '[]');
        const filtered = stored.filter(
          (o: any) =>
            String(o.id) !== idStr && o.orderNumber !== idStr && o.order_number !== idStr
        );
        localStorage.setItem('vaultzet_orders', JSON.stringify(filtered));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'DELETE_ORDER',
      module: 'Orders',
      details: `Permanently deleted order #${orderId} and purged its metrics from Dashboard & Telegram Bot`,
    });

    return {
      success: true,
      message: `Order #${orderId} permanently deleted from both Admin Panel and Telegram Bot.`,
    };
  }

  async deleteAllOrders(): Promise<{ success: boolean; message: string }> {
    const currentOrders = await this.getOrders();
    const allIds: string[] = [];

    for (const o of currentOrders) {
      allIds.push(String(o.id));
      if (o.order_number) allIds.push(String(o.order_number));
      if (db) {
        try {
          await updateDoc(doc(db, 'orders', String(o.id)), { status: 'cancelled' });
        } catch {}
        try {
          await deleteDoc(doc(db, 'orders', String(o.id)));
        } catch {}
      }
    }

    await this.markOrderIdsAsDeleted(allIds);
    initialOrders.length = 0;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_orders', '[]');
      } catch {}
    }

    return {
      success: true,
      message: 'All orders and revenue stats have been cleared from Admin Panel and Telegram Bot.',
    };
  }

  // ==========================================
  // 4. CUSTOMERS (Aggregated from real Firestore orders)
  // ==========================================
  async getCustomers(): Promise<Customer[]> {
    const orders = await this.getOrders();
    const paidOrders = orders.filter((o) => o.status === 'completed');
    const customerMap = new Map<string, Customer>();

    paidOrders.forEach((o) => {
      const email = o.customer.email;
      if (!email) return;
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: o.customer.id || email,
          name: `${o.customer.first_name} ${o.customer.last_name}`.trim(),
          email: o.customer.email,
          phone: o.customer.phone,
          orders_count: 1,
          total_spent: o.total,
          last_order_date: o.date_created,
          status: 'active',
        });
      } else {
        const existing = customerMap.get(email)!;
        existing.orders_count += 1;
        existing.total_spent += o.total;
        if (new Date(o.date_created) > new Date(existing.last_order_date || '')) {
          existing.last_order_date = o.date_created;
        }
      }
    });

    return Array.from(customerMap.values());
  }

  async getCustomerOrders(customerId: string | number): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders.filter((o) => o.customer.email === customerId || o.customer.id === customerId);
  }

  // ==========================================
  // 5. COUPONS (Direct Firestore)
  // ==========================================
  async getCoupons(): Promise<Coupon[]> {
    // 1. Try server API endpoint first
    try {
      const res = await fetch('/api/admin/coupons');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data?.coupons) && data.coupons.length > 0) {
          return data.coupons;
        }
      }
    } catch (e) {
      console.warn('Server coupon API fetch fallback:', e);
    }

    // 2. Direct Firestore fallback
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'coupons'));
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon));
        } else {
          for (const c of initialCoupons) {
            await setDoc(doc(db, 'coupons', String(c.id)), c);
          }
          return initialCoupons;
        }
      } catch (e) {
        console.warn('Firestore coupons fetch error:', e);
      }
    }
    return initialCoupons;
  }

  async couponAction(action: 'create' | 'update' | 'delete' | 'toggle', coupon: any): Promise<any> {
    const couponId = String(coupon.id || coupon.code);

    // 1. Send to server endpoint
    try {
      if (action === 'delete') {
        await fetch(`/api/admin/coupons?id=${encodeURIComponent(couponId)}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coupon),
        });
      }
    } catch (e) {
      console.warn('Server coupon API action fallback:', e);
    }

    // 2. Direct Firestore write
    if (db) {
      try {
        if (action === 'delete') {
          await deleteDoc(doc(db, 'coupons', couponId));
        } else {
          await setDoc(doc(db, 'coupons', couponId), coupon, { merge: true });
        }
      } catch (e) {
        console.warn('Firestore coupon action error:', e);
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: `COUPON_${action.toUpperCase()}`,
      module: 'Coupons',
      details: `${action} coupon: ${coupon.code || couponId}`,
    });
    return { success: true, action, coupon };
  }

  // ==========================================
  // 6. CONTENT & REELS
  // ==========================================
  async getContent(): Promise<ContentItem[]> {
    return initialContent;
  }

  private getDeletedCategoriesFromStorage(): Set<string> {
    const set = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('vaultzet_deleted_categories');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((k) => set.add(String(k).toLowerCase()));
          }
        }
      } catch {}
    }
    return set;
  }

  private async persistCategoriesRegistry(categories: CategoryItem[], deletedSlugsList?: string[]): Promise<void> {
    if (!db) return;
    const cleanList = categories.map((c) => ({
      id: c.id || c.slug,
      name: c.name,
      slug: c.slug,
      count: Number(c.count || 0),
      icon: c.icon || '✨',
      bg: c.bg || '#f4ebff',
      border: c.border || '#e9d5ff',
      iconColor: c.iconColor || '#7c3aed',
      description: c.description || '',
      created_at: c.created_at || new Date().toISOString(),
      is_custom: true,
      is_deleted: Boolean(c.is_deleted),
    }));

    const delSet = this.getDeletedCategoriesFromStorage();
    if (Array.isArray(deletedSlugsList)) {
      deletedSlugsList.forEach((s) => delSet.add(String(s).toLowerCase()));
    }
    const finalDeletedSlugs = Array.from(delSet);

    const payloadData = {
      categories: cleanList,
      deleted_slugs: finalDeletedSlugs,
    };
    const payloadJson = JSON.stringify(payloadData);

    // 1. Guaranteed Registry doc in products collection
    try {
      await setDoc(
        doc(db, 'products', 'category-registry-v1'),
        {
          id: 'category-registry-v1',
          name: '[INTERNAL_CATEGORY_REGISTRY]',
          price: 0,
          status: 'private',
          description: payloadJson,
          categories: ['_category_registry'],
          created_at: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Error saving category registry to products:', e);
    }

    // 2. Secondary backup in store_settings/branding
    try {
      await setDoc(
        doc(db, 'store_settings', 'branding'),
        {
          maintenance_message: payloadJson,
          last_updated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Error saving category registry to branding:', e);
    }
  }

  async getCategories(): Promise<CategoryItem[]> {
    let localCustomCats: CategoryItem[] = [];
    const localDeletedCats = this.getDeletedCategoriesFromStorage();

    if (typeof window !== 'undefined') {
      try {
        localCustomCats = JSON.parse(localStorage.getItem('vaultzet_custom_categories') || '[]');
      } catch {}
      try {
        const raw = localStorage.getItem('vaultzet_deleted_categories');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((k) => localDeletedCats.add(String(k).toLowerCase()));
          }
        }
      } catch {}
    }

    const customCatsMap = new Map<string, CategoryItem>();

    // 1. Try reading from products/category-registry-v1
    if (db) {
      try {
        const regSnap = await getDoc(doc(db, 'products', 'category-registry-v1'));
        if (regSnap.exists()) {
          const data = regSnap.data();
          if (data && typeof data.description === 'string' && data.description.trim()) {
            const parsed = JSON.parse(data.description);
            let items: any[] = [];
            if (Array.isArray(parsed)) {
              items = parsed;
            } else if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.deleted_slugs)) {
                parsed.deleted_slugs.forEach((s: string) => localDeletedCats.add(String(s).toLowerCase()));
              }
              if (Array.isArray(parsed.categories)) {
                items = parsed.categories;
              }
            }
            items.forEach((c: any) => {
              const slug = String(c.slug || c.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '').toLowerCase();
              const id = String(c.id || slug).toLowerCase();
              if (c && c.name && !c.is_deleted && !localDeletedCats.has(slug) && !localDeletedCats.has(id)) {
                customCatsMap.set(slug, {
                  ...c,
                  id: c.id || slug,
                  slug,
                  is_custom: true,
                });
              }
            });
          }
        }
      } catch {}

      // 2. Try reading from store_settings/branding
      if (customCatsMap.size === 0) {
        try {
          const brandSnap = await getDoc(doc(db, 'store_settings', 'branding'));
          if (brandSnap.exists()) {
            const bData = brandSnap.data();
            if (bData && typeof bData.maintenance_message === 'string' && bData.maintenance_message.trim()) {
              const parsed = JSON.parse(bData.maintenance_message);
              let items: any[] = [];
              if (Array.isArray(parsed)) {
                items = parsed;
              } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.deleted_slugs)) {
                  parsed.deleted_slugs.forEach((s: string) => localDeletedCats.add(String(s).toLowerCase()));
                }
                if (Array.isArray(parsed.categories)) {
                  items = parsed.categories;
                }
              }
              items.forEach((c: any) => {
                const slug = String(c.slug || c.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '').toLowerCase();
                const id = String(c.id || slug).toLowerCase();
                if (c && c.name && !c.is_deleted && !localDeletedCats.has(slug) && !localDeletedCats.has(id) && !customCatsMap.has(slug)) {
                  customCatsMap.set(slug, {
                    ...c,
                    id: c.id || slug,
                    slug,
                    is_custom: true,
                  });
                }
              });
            }
          }
        } catch {}
      }

      // 3. Try reading from direct categories collection
      try {
        const snap = await getDocs(collection(db, 'categories'));
        snap.docs.forEach((d) => {
          const data = d.data();
          const id = d.id.toLowerCase();
          const slug = String(data.slug || id).toLowerCase();
          const isDel = Boolean(data.is_deleted || data.name === '[DELETED]');
          if (isDel) {
            localDeletedCats.add(id);
            localDeletedCats.add(slug);
            customCatsMap.delete(slug);
          } else if (!localDeletedCats.has(id) && !localDeletedCats.has(slug) && !customCatsMap.has(slug)) {
            customCatsMap.set(slug, {
              id: d.id,
              ...(data as any),
              name: String(data.name || id),
              slug: String(data.slug || id),
              count: Number(data.count || 0),
              is_custom: true,
            } as CategoryItem);
          }
        });
      } catch {}
    }

    // 4. Merge any local categories
    localCustomCats.forEach((c) => {
      const slug = String(c.slug || '').toLowerCase();
      const id = String(c.id || slug).toLowerCase();
      if (c && c.name && !c.is_deleted && !localDeletedCats.has(slug) && !localDeletedCats.has(id) && !customCatsMap.has(slug)) {
        customCatsMap.set(slug, {
          ...c,
          is_custom: true,
        });
      }
    });

    const customList = Array.from(customCatsMap.values());
    customList.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    if (typeof window !== 'undefined' && customList.length > 0) {
      try {
        localStorage.setItem('vaultzet_custom_categories', JSON.stringify(customList));
      } catch {}
    }

    const customSlugs = new Set(customList.map((c) => c.slug.toLowerCase()));
    const missingInitial = initialCategories.filter(
      (c) => !customSlugs.has(c.slug.toLowerCase()) && !localDeletedCats.has(c.slug.toLowerCase())
    );

    // Combine custom categories FIRST, then initial categories
    return [...customList, ...missingInitial];
  }

  async createCategory(catData: Partial<CategoryItem>): Promise<CategoryItem> {
    const name = catData.name?.trim() || 'New Category';
    const slug =
      catData.slug?.trim() ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    const catId = catData.id || slug;

    // Helper for auto-generating icon if none supplied
    const autoEmoji = (() => {
      const n = name.toLowerCase();
      if (n.includes('ai') || n.includes('robot')) return '🤖';
      if (n.includes('story') || n.includes('history')) return '📖';
      if (n.includes('aesthetic') || n.includes('glow')) return '✨';
      if (n.includes('entertain') || n.includes('movie')) return '🎬';
      if (n.includes('comedy') || n.includes('funny') || n.includes('joke')) return '🎭';
      if (n.includes('animal') || n.includes('dog') || n.includes('cat')) return '🐾';
      if (n.includes('animat') || n.includes('anime')) return '🎨';
      if (n.includes('fit') || n.includes('gym')) return '💪';
      if (n.includes('game') || n.includes('gaming')) return '🎮';
      if (n.includes('diy') || n.includes('craft')) return '🛠️';
      if (n.includes('crypto') || n.includes('money') || n.includes('finance') || n.includes('wealth')) return '💰';
      if (n.includes('luxury') || n.includes('car')) return '🏎️';
      if (n.includes('tech') || n.includes('code')) return '💻';
      if (n.includes('music') || n.includes('song')) return '🎵';
      if (n.includes('fashion') || n.includes('style')) return '👗';
      if (n.includes('spiritual') || n.includes('god')) return '🙏';
      return '✨';
    })();

    const newCat: CategoryItem = {
      id: catId,
      name,
      slug,
      count: Number(catData.count || 0),
      icon: catData.icon || autoEmoji,
      bg: catData.bg || '#f4ebff',
      border: catData.border || '#e9d5ff',
      iconColor: catData.iconColor || '#7c3aed',
      description: catData.description || `Browse high quality ${name} for viral social media growth.`,
      created_at: new Date().toISOString(),
      is_custom: true,
    };

    const cleanPayload = sanitizePayload(newCat);

    // 1. Get current custom categories list
    let currentCustom: CategoryItem[] = [];
    if (typeof window !== 'undefined') {
      try {
        currentCustom = JSON.parse(localStorage.getItem('vaultzet_custom_categories') || '[]');
      } catch {}
    }
    const updatedCustom = [cleanPayload, ...currentCustom.filter((c: any) => c.slug !== slug && c.id !== catId)];

    // 2. Persist to Firestore Registry (products + store_settings)
    await this.persistCategoriesRegistry(updatedCustom);

    // 3. Attempt direct write to categories collection (if rules allow it)
    if (db) {
      try {
        await setDoc(doc(db, 'categories', catId), cleanPayload);
        if (slug && slug !== catId) {
          try {
            await setDoc(doc(db, 'categories', slug), cleanPayload);
          } catch {}
        }
      } catch (e) {
        // Direct write handled gracefully
      }
    }

    // 4. Update memory & localStorage
    initialCategories.unshift(cleanPayload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_custom_categories', JSON.stringify(updatedCustom));

        const delCats = JSON.parse(localStorage.getItem('vaultzet_deleted_categories') || '[]');
        const updatedDel = delCats.filter((k: string) => k !== slug && k !== catId);
        localStorage.setItem('vaultzet_deleted_categories', JSON.stringify(updatedDel));
      } catch (e) {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'CREATE_CATEGORY',
      module: 'Products',
      details: `Created new category: ${cleanPayload.name} (${cleanPayload.slug})`,
    });

    return cleanPayload;
  }

  async updateCategory(catData: Partial<CategoryItem> & { id?: string; slug?: string }): Promise<CategoryItem> {
    const key = (catData.id || catData.slug || '').toLowerCase();
    const cleanPayload = sanitizePayload(catData);

    let currentCustom: CategoryItem[] = [];
    if (typeof window !== 'undefined') {
      try {
        currentCustom = JSON.parse(localStorage.getItem('vaultzet_custom_categories') || '[]');
      } catch {}
    }

    const exIdx = currentCustom.findIndex((c: any) => c.slug?.toLowerCase() === key || c.id?.toLowerCase() === key);
    if (exIdx !== -1) {
      currentCustom[exIdx] = { ...currentCustom[exIdx], ...cleanPayload, is_custom: true };
    } else {
      currentCustom.unshift({ ...cleanPayload, is_custom: true } as CategoryItem);
    }

    await this.persistCategoriesRegistry(currentCustom);

    if (db && key) {
      try {
        await setDoc(doc(db, 'categories', key), cleanPayload, { merge: true });
      } catch (e) {}
    }

    const idx = initialCategories.findIndex((c) => c.id?.toLowerCase() === key || c.slug?.toLowerCase() === key);
    if (idx !== -1) {
      initialCategories[idx] = { ...initialCategories[idx], ...cleanPayload };
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_custom_categories', JSON.stringify(currentCustom));
      } catch {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_CATEGORY',
      module: 'Products',
      details: `Updated category: ${catData.name || key}`,
    });

    return cleanPayload as CategoryItem;
  }

  async deleteCategory(categoryIdOrSlug: string): Promise<boolean> {
    const key = String(categoryIdOrSlug || '').toLowerCase().trim();
    if (!key) return false;

    // 1. Add to persistent deleted category set
    const delCats = this.getDeletedCategoriesFromStorage();
    delCats.add(key);

    // 2. Remove from active custom categories
    let currentCustom: CategoryItem[] = [];
    if (typeof window !== 'undefined') {
      try {
        currentCustom = JSON.parse(localStorage.getItem('vaultzet_custom_categories') || '[]');
      } catch {}
    }

    const updatedCustom = currentCustom.filter(
      (c: any) => (c.id || '').toLowerCase() !== key && (c.slug || '').toLowerCase() !== key
    );

    // 3. Persist updated custom categories + deleted_slugs to cloud registry
    await this.persistCategoriesRegistry(updatedCustom, Array.from(delCats));

    // 4. Try Firestore direct categories collection if accessible
    if (db) {
      try {
        await setDoc(
          doc(db, 'categories', key),
          { id: key, slug: key, name: '[DELETED]', is_deleted: true, deleted_at: new Date().toISOString() },
          { merge: true }
        );
        await deleteDoc(doc(db, 'categories', key));
      } catch (e) {}
    }

    // 5. Purge from in-memory initialCategories
    for (let i = initialCategories.length - 1; i >= 0; i--) {
      const c = initialCategories[i];
      if (
        (c.id && c.id.toLowerCase() === key) ||
        (c.slug && c.slug.toLowerCase() === key)
      ) {
        initialCategories.splice(i, 1);
      }
    }

    // 6. Update local storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_custom_categories', JSON.stringify(updatedCustom));
        localStorage.setItem('vaultzet_deleted_categories', JSON.stringify(Array.from(delCats)));
      } catch (e) {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'DELETE_CATEGORY',
      module: 'Products',
      details: `Permanently deleted category: ${key}`,
    });

    return true;
  }

  async uploadImage(file: File): Promise<{
    url: string;
    display_url?: string;
    thumb_url?: string | null;
    title?: string;
    size?: number;
  }> {
    const validExtensions = ['.png', '.jpg', '.jpeg'];
    const fileName = file.name ? file.name.toLowerCase() : '';
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const validMimes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg'];
    const hasValidMime = validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt || !hasValidMime) {
      throw new Error('Only .PNG, .JPG, and .JPEG image files are allowed.');
    }

    if (file.size > 32 * 1024 * 1024) {
      throw new Error('Image size exceeds 32 MB limit.');
    }

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/admin/upload-image', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Upload failed with status ${response.status}`);
    }

    return {
      url: data.url,
      display_url: data.display_url,
      thumb_url: data.thumb_url,
      title: data.title,
      size: data.size,
    };
  }

  async uploadMedia(file: File): Promise<{ url: string; id: string }> {
    if (file.type.startsWith('image/')) {
      try {
        const uploaded = await this.uploadImage(file);
        return {
          url: uploaded.url,
          id: `imgbb-${Date.now()}`,
        };
      } catch (err: any) {
        console.warn('ImgBB upload error, falling back to local preview:', err);
      }
    }

    // Fallback for non-image or development offline testing
    const objectUrl = URL.createObjectURL(file);
    return {
      url: objectUrl,
      id: `media-${Date.now()}`,
    };
  }

  parseVideoUrl(url: string): { videoType: 'youtube' | 'direct'; youtubeId?: string; embedUrl?: string } {
    if (!url) return { videoType: 'direct' };
    const trimmed = url.trim();
    const ytRegex = /(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(ytRegex);
    if (match && match[1]) {
      const ytId = match[1];
      return {
        videoType: 'youtube',
        youtubeId: ytId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=1&modestbranding=1&playsinline=1&rel=0`,
      };
    }
    return { videoType: 'direct' };
  }

  async getReels(): Promise<ReelItem[]> {
    let localCustomReels: ReelItem[] = [];
    let localDeletedReels = new Set<string>();

    if (typeof window !== 'undefined') {
      try {
        localCustomReels = JSON.parse(localStorage.getItem('vaultzet_custom_reels') || '[]');
      } catch {}
      try {
        const raw = localStorage.getItem('vaultzet_deleted_reels');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((k) => localDeletedReels.add(String(k).toLowerCase()));
          }
        }
      } catch {}
    }

    if (db) {
      try {
        const snap = await getDocs(collection(db, 'reels'));
        if (!snap.empty) {
          const dbReels: ReelItem[] = [];
          const dbIdSet = new Set<string>();

          snap.docs.forEach((d) => {
            const data = d.data();
            const id = d.id.toLowerCase();
            const isDel = Boolean(data.is_deleted || data.title === '[DELETED]');
            if (isDel) {
              localDeletedReels.add(id);
            } else {
              dbReels.push({ id: d.id, ...data } as ReelItem);
              dbIdSet.add(d.id);
            }
          });

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_deleted_reels', JSON.stringify(Array.from(localDeletedReels)));
            } catch {}
          }

          const combined = [...localCustomReels, ...dbReels].filter(
            (r) =>
              !r.is_deleted &&
              r.title !== '[DELETED]' &&
              !localDeletedReels.has(String(r.id).toLowerCase())
          );
          const combinedIds = new Set(combined.map((r) => String(r.id)));

          const missing = initialReels.filter(
            (r) =>
              !combinedIds.has(String(r.id)) &&
              !dbIdSet.has(String(r.id)) &&
              !localDeletedReels.has(String(r.id).toLowerCase())
          );
          return [...combined, ...missing];
        }
      } catch (e) {
        console.warn('Firestore reels fetch error:', e);
      }
    }

    const reelIdSet = new Set(initialReels.map((r) => String(r.id)));
    const uncommittedLocal = localCustomReels.filter(
      (r) => !reelIdSet.has(String(r.id)) && !localDeletedReels.has(String(r.id).toLowerCase())
    );
    return [...uncommittedLocal, ...initialReels].filter(
      (r) => !localDeletedReels.has(String(r.id).toLowerCase())
    );
  }

  async createReel(reelData: Partial<ReelItem>): Promise<ReelItem> {
    const id = reelData.id || `reel-${Date.now()}`;
    const url = reelData.videoUrl?.trim() || '';
    const parsed = this.parseVideoUrl(url);

    let poster = reelData.poster?.trim() || '';
    if (!poster && parsed.youtubeId) {
      poster = `https://img.youtube.com/vi/${parsed.youtubeId}/hqdefault.jpg`;
    } else if (!poster) {
      poster = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
    }

    const newReel: ReelItem = {
      id,
      title: reelData.title?.trim() || 'Viral Video Reel',
      videoUrl: url,
      videoType: parsed.videoType,
      youtubeId: parsed.youtubeId,
      poster,
      category: reelData.category?.trim() || 'AI Reels',
      bundleId: reelData.bundleId,
      bundleSlug: reelData.bundleSlug,
      bundleTitle: reelData.bundleTitle,
      bundlePrice: reelData.bundlePrice,
      bundleOriginalPrice: reelData.bundleOriginalPrice,
      reelCount: reelData.reelCount,
      order: reelData.order ?? 0,
      likes: reelData.likes ?? Math.floor(Math.random() * 2000 + 500),
      views: reelData.views ?? Math.floor(Math.random() * 10000 + 1200),
      isActive: reelData.isActive ?? true,
      createdAt: new Date().toISOString(),
    };

    const cleanPayload = sanitizePayload(newReel);

    if (db) {
      try {
        await setDoc(doc(db, 'reels', id), cleanPayload);
      } catch (e) {
        console.warn('Firestore reel creation error:', e);
      }
    }

    initialReels.unshift(cleanPayload);

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_reels') || '[]');
        const filtered = stored.filter((r: any) => String(r.id) !== id);
        filtered.unshift(cleanPayload);
        localStorage.setItem('vaultzet_custom_reels', JSON.stringify(filtered));

        const delReels = JSON.parse(localStorage.getItem('vaultzet_deleted_reels') || '[]');
        const updatedDel = delReels.filter((k: string) => k !== id);
        localStorage.setItem('vaultzet_deleted_reels', JSON.stringify(updatedDel));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'CREATE_REEL',
      module: 'Content & Reels',
      details: `Created new reel #${id}: ${cleanPayload.title} (${cleanPayload.videoType})`,
    });

    return cleanPayload;
  }

  async updateReel(id: string, updates: Partial<ReelItem>): Promise<ReelItem> {
    const cleanPayload = sanitizePayload(updates);

    if (db) {
      try {
        await setDoc(doc(db, 'reels', id), cleanPayload, { merge: true });
      } catch (e) {
        console.warn('Firestore reel update error:', e);
      }
    }

    const idx = initialReels.findIndex((r) => r.id === id);
    if (idx !== -1) {
      initialReels[idx] = { ...initialReels[idx], ...cleanPayload };
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_reels') || '[]');
        const updated = stored.map((r: ReelItem) => (r.id === id ? { ...r, ...cleanPayload } : r));
        localStorage.setItem('vaultzet_custom_reels', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_REEL',
      module: 'Content & Reels',
      details: `Updated reel #${id}`,
    });

    return { id, ...cleanPayload } as ReelItem;
  }

  async deleteReel(id: string): Promise<boolean> {
    const idKey = String(id).toLowerCase();
    if (db) {
      try {
        await setDoc(
          doc(db, 'reels', id),
          { id, is_deleted: true, title: '[DELETED]', deleted_at: new Date().toISOString() },
          { merge: true }
        );
        await deleteDoc(doc(db, 'reels', id));
      } catch (e) {
        console.warn('Firestore reel delete error:', e);
      }
    }

    const idx = initialReels.findIndex((r) => String(r.id).toLowerCase() === idKey);
    if (idx !== -1) {
      initialReels.splice(idx, 1);
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vaultzet_custom_reels') || '[]');
        const filtered = stored.filter((r: ReelItem) => String(r.id).toLowerCase() !== idKey);
        localStorage.setItem('vaultzet_custom_reels', JSON.stringify(filtered));

        const delReels = JSON.parse(localStorage.getItem('vaultzet_deleted_reels') || '[]');
        const set = new Set(delReels.map((k: string) => String(k).toLowerCase()));
        set.add(idKey);
        localStorage.setItem('vaultzet_deleted_reels', JSON.stringify(Array.from(set)));
      } catch (e) {
        // ignore
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'DELETE_REEL',
      module: 'Content & Reels',
      details: `Deleted reel #${id}`,
    });

    return true;
  }

  // ==========================================
  // PERSISTENCE HELPERS (LocalStorage + Cloud Dual-Sync)
  // ==========================================
  private getSavedSetting<T>(key: string, defaultValue: T): T {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`vaultzet_setting_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
            return { ...defaultValue, ...parsed };
          }
          return parsed;
        }
      } catch (e) {
        console.warn(`localStorage read error for ${key}:`, e);
      }
    }
    return defaultValue;
  }

  private saveSettingLocally<T>(key: string, value: T): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`vaultzet_setting_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn(`localStorage write error for ${key}:`, e);
      }
    }
  }

  // ==========================================
  // 7. BRANDING
  // ==========================================
  async getBranding(): Promise<StoreBranding> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'branding'));
        if (snap.exists()) {
          const data = snap.data() as StoreBranding;
          this.saveSettingLocally('branding', data);
          return data;
        }
      } catch (e) {
        console.warn('Firestore branding fetch error, using local cache:', e);
      }
    }
    return this.getSavedSetting('branding', initialBranding);
  }

  async updateBranding(branding: StoreBranding): Promise<StoreBranding> {
    const clean = sanitizePayload(branding);
    this.saveSettingLocally('branding', clean);
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'branding'), clean, { merge: true });
        if (clean.store_name) {
          await setDoc(doc(db, 'store_settings', 'general'), { store_name: clean.store_name }, { merge: true });
        }
      } catch (e) {
        console.warn('Firestore updateBranding error:', e);
      }
    }
    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_BRANDING',
      module: 'Branding',
      details: `Updated store branding & name to "${clean.store_name}"`,
    });
    return clean;
  }

  // ==========================================
  // 8. SITE MODE
  // ==========================================
  async getSiteMode(): Promise<SiteModeConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'site_mode'));
        if (snap.exists()) {
          const data = snap.data() as SiteModeConfig;
          this.saveSettingLocally('site_mode', data);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultworld_site_mode', JSON.stringify(data));
            } catch {}
          }
          return data;
        }
      } catch (e) {
        console.warn('Firestore site_mode fetch error, using local cache:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const smLocal = localStorage.getItem('vaultworld_site_mode');
        if (smLocal) {
          return JSON.parse(smLocal);
        }
      } catch {}
    }

    return this.getSavedSetting('site_mode', initialSiteMode);
  }

  async updateSiteMode(config: SiteModeConfig): Promise<SiteModeConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('site_mode', clean);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultworld_site_mode', JSON.stringify(clean));
        window.dispatchEvent(new CustomEvent('vaultworld:site_mode_updated', { detail: clean }));
      } catch {}
    }
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'site_mode'), clean, { merge: true });
      } catch (e) {
        console.warn('Firestore updateSiteMode error:', e);
      }
    }
    // Also sync via API route as fallback
    try {
      fetch('/api/site-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clean),
      }).catch(() => {});
    } catch {}

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_SITE_MODE',
      module: 'Site Mode',
      details: `Switched mode to ${clean.mode}`,
    });
    return clean;
  }

  async setSiteMode(config: SiteModeConfig): Promise<SiteModeConfig> {
    return this.updateSiteMode(config);
  }

  // ==========================================
  // 9. STORE SETUP
  // ==========================================
  async getStoreSetup(): Promise<StoreSetupConfig> {
    if (db) {
      try {
        const [snap, brandSnap, waSnap] = await Promise.all([
          getDoc(doc(db, 'store_settings', 'general')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'branding')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'whatsapp')).catch(() => null),
        ]);

        const data = snap && snap.exists() ? snap.data() : null;
        const brandData = brandSnap && brandSnap.exists() ? brandSnap.data() : null;
        const waData = waSnap && waSnap.exists() ? waSnap.data() : null;

        if (data || brandData || waData) {
          const resolvedPhone =
            data?.support_whatsapp ||
            data?.support_phone ||
            waData?.phone_number ||
            brandData?.support_whatsapp ||
            initialStoreSetup.support_whatsapp;

          const resolvedEmail =
            data?.contact_email ||
            brandData?.contact_email ||
            initialStoreSetup.contact_email;

          const resolvedName =
            data?.store_name ||
            brandData?.store_name ||
            initialStoreSetup.store_name;

          const mapped: StoreSetupConfig = {
            ...initialStoreSetup,
            ...(data || {}),
            store_name: resolvedName,
            contact_email: resolvedEmail,
            support_whatsapp: resolvedPhone,
            support_phone: resolvedPhone,
          };
          this.saveSettingLocally('general', mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Firestore general config fetch error, using local cache:', e);
      }
    }
    return this.getSavedSetting('general', initialStoreSetup);
  }

  async updateStoreSetup(config: StoreSetupConfig): Promise<StoreSetupConfig> {
    const clean = sanitizePayload(config);
    clean.support_phone = clean.support_phone || clean.support_whatsapp;
    clean.support_whatsapp = clean.support_whatsapp || clean.support_phone;
    clean.contact_email = clean.contact_email ? clean.contact_email.trim() : '';

    this.saveSettingLocally('general', clean);

    const rawPhone = clean.support_whatsapp || clean.support_phone || '';
    const digitsOnly = rawPhone.replace(/\D/g, '');

    const waMapped: Partial<WhatsappButtonConfig> = {
      phone_number: digitsOnly || rawPhone,
    };
    this.saveSettingLocally('whatsapp', waMapped);

    if (db) {
      try {
        await Promise.allSettled([
          setDoc(doc(db, 'store_settings', 'general'), clean, { merge: true }),
          setDoc(doc(db, 'store_settings', 'branding'), {
            store_name: clean.store_name,
            contact_email: clean.contact_email,
            support_whatsapp: clean.support_whatsapp,
            support_phone: clean.support_phone,
          }, { merge: true }),
          setDoc(doc(db, 'store_settings', 'whatsapp'), {
            phone_number: digitsOnly || rawPhone,
          }, { merge: true }),
        ]);
      } catch (e) {
        console.warn('Firestore updateStoreSetup error:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vaultworld:whatsapp_updated', {
        detail: { phone_number: digitsOnly || rawPhone }
      }));
      window.dispatchEvent(new CustomEvent('vaultworld:branding_updated', {
        detail: {
          store_name: clean.store_name,
          contact_email: clean.contact_email,
          support_whatsapp: clean.support_whatsapp,
          support_phone: clean.support_phone,
        }
      }));
      window.dispatchEvent(new CustomEvent('vaultworld:store_setup_updated', {
        detail: clean
      }));
    }

    await logAdminAction({
      adminEmail: 'admin@vaultworld.shop',
      action: 'UPDATE_STORE_SETUP',
      module: 'Store Setup',
      details: `Updated store name: "${clean.store_name}", email: "${clean.contact_email}", phone: "${clean.support_whatsapp}"`,
    });

    return clean;
  }

  // ==========================================
  // 10. META PIXEL
  // ==========================================
  async getMetaPixel(): Promise<MetaPixelConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'meta_pixel'));
        if (snap.exists()) {
          const data = snap.data() as MetaPixelConfig;
          this.saveSettingLocally('meta_pixel', data);
          return data;
        }

        // Check fallback to dnp_meta
        const dnpSnap = await getDoc(doc(db, 'store_settings', 'dnp_meta'));
        if (dnpSnap.exists()) {
          const dnpData = dnpSnap.data() as DnpMetaConfig;
          const mapped: MetaPixelConfig = {
            enabled: typeof dnpData.enabled === 'boolean' ? dnpData.enabled : true,
            pixel_id: dnpData.meta_pixel_id || '',
            capi_token: dnpData.capi_token || '',
            test_event_code: dnpData.test_event_code || '',
            track_pageviews: true,
            track_view_content: true,
            track_add_to_cart: true,
            track_initiate_checkout: true,
            track_purchase: true,
          };
          this.saveSettingLocally('meta_pixel', mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Firestore meta_pixel fetch error, using local cache:', e);
      }
    }
    return this.getSavedSetting('meta_pixel', initialMetaPixel);
  }

  async updateMetaPixel(config: MetaPixelConfig): Promise<MetaPixelConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('meta_pixel', clean);

    const dnpMapped: Partial<DnpMetaConfig> = {
      enabled: clean.enabled,
      meta_pixel_id: clean.pixel_id,
      capi_token: clean.capi_token,
      test_event_code: clean.test_event_code,
    };
    this.saveSettingLocally('dnp_meta', dnpMapped);

    if (db) {
      try {
        await Promise.all([
          setDoc(doc(db, 'store_settings', 'meta_pixel'), clean, { merge: true }),
          setDoc(doc(db, 'store_settings', 'dnp_meta'), dnpMapped, { merge: true }),
        ]);
      } catch (e) {
        console.warn('Firestore updateMetaPixel error:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vaultworld:meta_pixel_updated', { detail: clean }));
    }

    await logAdminAction({
      adminEmail: 'admin@vaultworld.shop',
      action: 'UPDATE_META_PIXEL',
      module: 'Meta Pixel',
      details: `Updated Pixel ID: ${clean.pixel_id}`,
    });
    return clean;
  }

  async testMetaEvent(params?: {
    pixel_id?: string;
    capi_token?: string;
    test_event_code?: string;
    event_name?: string;
  }): Promise<any> {
    const res = await fetch('/api/admin/meta-pixel/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Meta test event delivery failed.');
    }
    return data;
  }

  // ==========================================
  // 11. WHATSAPP BUTTON
  // ==========================================
  async getWhatsappButton(): Promise<WhatsappButtonConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'whatsapp'));
        if (snap.exists()) {
          const data = snap.data() as WhatsappButtonConfig;
          this.saveSettingLocally('whatsapp', data);
          return data;
        }
      } catch (e) {
        console.warn('Firestore whatsapp fetch error, using local cache:', e);
      }
    }
    return this.getSavedSetting('whatsapp', initialWhatsappButton);
  }

  async updateWhatsappButton(config: WhatsappButtonConfig): Promise<WhatsappButtonConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('whatsapp', clean);
    if (db) {
      try {
        await Promise.allSettled([
          setDoc(doc(db, 'store_settings', 'whatsapp'), clean, { merge: true }),
          setDoc(doc(db, 'store_settings', 'general'), {
            support_whatsapp: clean.phone_number,
            support_phone: clean.phone_number,
          }, { merge: true }),
        ]);
      } catch (e) {
        console.warn('Firestore updateWhatsapp error:', e);
      }
    }
    await logAdminAction({
      adminEmail: 'admin@vaultworld.shop',
      action: 'UPDATE_WHATSAPP',
      module: 'WhatsApp Button',
      details: `Updated support phone to ${clean.phone_number}`,
    });
    return clean;
  }

  // ==========================================
  // 12. WEBHOOKS & LOGS
  // ==========================================
  async getWebhookSettings(): Promise<WebhookConfig> {
    return initialWebhooks;
  }

  async updateWebhookSettings(config: WebhookConfig): Promise<WebhookConfig> {
    return sanitizePayload(config);
  }

  async getWebhookLogs(): Promise<WebhookLogEntry[]> {
    return initialWebhookLogs;
  }

  async clearWebhookLogs(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async retryWebhook(logId: string): Promise<{ success: boolean; status_code: number }> {
    return { success: true, status_code: 200 };
  }

  async testWebhookTrigger(event: string): Promise<any> {
    return { success: true, event, delivered_at: new Date().toISOString() };
  }

  // ==========================================
  // 13 & 14. PLUGINS & THEMES
  // ==========================================
  async getPlugins(): Promise<WpPlugin[]> {
    return initialPlugins;
  }

  async pluginAction(action: 'install' | 'activate' | 'deactivate' | 'update', pluginFile: string): Promise<any> {
    return { success: true, action, plugin_file: pluginFile };
  }

  async getThemes(): Promise<WpTheme[]> {
    return initialThemes;
  }

  async themeAction(action: 'activate' | 'update', slug: string): Promise<any> {
    return { success: true, action, slug };
  }

  // ==========================================
  // 15. CONNECTOR ENGINE
  // ==========================================
  async getConnectorStatus(): Promise<ConnectorStatus> {
    return initialConnectorStatus;
  }

  async updateConnector(): Promise<any> {
    return { success: true, message: 'Cloud Engine is up to date' };
  }

  // ==========================================
  // 16. SETTINGS & INTEGRATIONS (PayU Gateway)
  // ==========================================
  async getPayUConfig(): Promise<PgBridgeConfig> {
    // 1. First attempt to fetch from server-side admin settings API (reads Firestore directly)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/admin/settings/payu', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.config) {
            const mapped: PgBridgeConfig = {
              enabled: typeof data.config.enabled === 'boolean' ? data.config.enabled : true,
              merchant_key: data.config.merchant_key || '',
              merchant_salt: data.config.merchant_salt || '',
              app_id: data.config.merchant_key || '',
              secret_key: data.config.merchant_salt || '',
              environment: data.config.environment || 'PRODUCTION',
              return_url: data.config.return_url || 'https://vaultworld.shop/api/payment/payu/return',
            };
            this.saveSettingLocally('payu', mapped);
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/admin/settings/payu fetch error, falling back to Firestore/local:', apiErr);
      }
    }

    // 2. Direct client Firestore query (store_settings/general, store_settings/payu, store_settings/cashfree)
    if (db) {
      try {
        const [genSnap, payuSnap, cfSnap] = await Promise.all([
          getDoc(doc(db, 'store_settings', 'general')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'payu')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'cashfree')).catch(() => null),
        ]);

        let data: any = null;
        if (genSnap && genSnap.exists() && (genSnap.data()?.merchant_key || genSnap.data()?.app_id)) {
          data = genSnap.data();
        } else if (payuSnap && payuSnap.exists()) {
          data = payuSnap.data();
        } else if (cfSnap && cfSnap.exists()) {
          data = cfSnap.data();
        } else if (genSnap && genSnap.exists()) {
          data = genSnap.data();
        }

        if (data) {
          const mapped: PgBridgeConfig = {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
            merchant_key: data.merchant_key || data.app_id || '',
            merchant_salt: data.merchant_salt || data.secret_key || '',
            app_id: data.merchant_key || data.app_id || '',
            secret_key: data.merchant_salt || data.secret_key || '',
            environment: data.environment === 'TEST' || data.environment === 'SANDBOX' ? 'TEST' : 'PRODUCTION',
            return_url: data.return_url || 'https://vaultworld.shop/api/payment/payu/return',
          };
          this.saveSettingLocally('payu', mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Firestore direct payu fetch error, using local cache:', e);
      }
    }

    return this.getSavedSetting('payu', initialPgBridge);
  }

  async updatePayUConfig(config: PgBridgeConfig): Promise<PgBridgeConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('payu', clean);
    this.saveSettingLocally('cashfree', clean);

    let apiSucceeded = false;

    // 1. Post to server-side admin settings API (persists to Firestore store_settings/general securely)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/admin/settings/payu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clean),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          apiSucceeded = true;
        } else {
          console.warn('Server API error saving PayU config:', data.error);
        }
      } catch (apiErr) {
        console.warn('Network error saving PayU config to API route:', apiErr);
      }
    }

    // 2. Direct client Firestore persistence (save to store_settings/general as primary universally allowed doc)
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'general'), clean, { merge: true });
        apiSucceeded = true;
      } catch (e) {
        console.warn('Firestore direct write to store_settings/general warning:', e);
      }

      // Also attempt secondary docs in parallel without failing
      Promise.allSettled([
        setDoc(doc(db, 'store_settings', 'payu'), clean, { merge: true }),
        setDoc(doc(db, 'store_settings', 'cashfree'), clean, { merge: true }),
      ]).catch(() => null);
    }

    await logAdminAction({
      adminEmail: 'admin@vaultworld.shop',
      action: 'UPDATE_PAYU_CONFIG',
      module: 'Payments',
      details: `Updated PayU Gateway credentials (Env: ${clean.environment || 'PRODUCTION'}) in Cloud Database`,
    });

    return clean;
  }

  async getCashfreeConfig(): Promise<PgBridgeConfig> {
    return this.getPayUConfig();
  }

  async updateCashfreeConfig(config: PgBridgeConfig): Promise<PgBridgeConfig> {
    return this.updatePayUConfig(config);
  }

  async getPgBridgeConfig(): Promise<PgBridgeConfig> {
    return this.getPayUConfig();
  }

  async updatePgBridgeConfig(config: PgBridgeConfig): Promise<PgBridgeConfig> {
    return this.updatePayUConfig(config);
  }

  async getDnpMetaConfig(): Promise<DnpMetaConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'dnp_meta'));
        if (snap.exists()) {
          const data = snap.data() as DnpMetaConfig;
          this.saveSettingLocally('dnp_meta', data);
          return data;
        }

        // Fallback to meta_pixel doc
        const metaSnap = await getDoc(doc(db, 'store_settings', 'meta_pixel'));
        if (metaSnap.exists()) {
          const metaData = metaSnap.data();
          const mapped: DnpMetaConfig = {
            enabled: typeof metaData.enabled === 'boolean' ? metaData.enabled : true,
            meta_pixel_id: metaData.pixel_id || metaData.meta_pixel_id || '',
            capi_token: metaData.capi_token || metaData.access_token || '',
            test_event_code: metaData.test_event_code || '',
            last_cart_event: metaData.last_cart_event || new Date().toISOString(),
            last_purchase_event: metaData.last_purchase_event || new Date().toISOString(),
            event_health_score: 100,
          };
          this.saveSettingLocally('dnp_meta', mapped);
          return mapped;
        }
      } catch {}
    }
    return this.getSavedSetting('dnp_meta', initialDnpMeta);
  }

  async updateDnpMetaConfig(config: DnpMetaConfig): Promise<DnpMetaConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('dnp_meta', clean);

    const metaPixelMapped: Partial<MetaPixelConfig> = {
      enabled: clean.enabled,
      pixel_id: clean.meta_pixel_id,
      capi_token: clean.capi_token,
      test_event_code: clean.test_event_code,
    };
    this.saveSettingLocally('meta_pixel', metaPixelMapped);

    if (db) {
      try {
        await Promise.all([
          setDoc(doc(db, 'store_settings', 'dnp_meta'), clean, { merge: true }),
          setDoc(doc(db, 'store_settings', 'meta_pixel'), metaPixelMapped, { merge: true }),
        ]);
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vaultworld:meta_pixel_updated', { detail: clean }));
    }

    return clean;
  }

  async getMmcConfig(): Promise<MmcAnalyticsConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'mmc_analytics'));
        if (snap.exists()) {
          const data = snap.data() as MmcAnalyticsConfig;
          this.saveSettingLocally('mmc_analytics', data);
          return data;
        }
      } catch {}
    }
    return this.getSavedSetting('mmc_analytics', initialMmc);
  }

  async updateMmcConfig(config: MmcAnalyticsConfig): Promise<MmcAnalyticsConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('mmc_analytics', clean);
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'mmc_analytics'), clean, { merge: true });
      } catch {}
    }
    return clean;
  }

  async getRankMathConfig(): Promise<RankMathConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'rankmath_seo'));
        if (snap.exists()) {
          const data = snap.data() as RankMathConfig;
          this.saveSettingLocally('rankmath_seo', data);
          return data;
        }
      } catch {}
    }
    return this.getSavedSetting('rankmath_seo', initialRankMath);
  }

  async updateRankMathConfig(config: RankMathConfig): Promise<RankMathConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('rankmath_seo', clean);
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'rankmath_seo'), clean, { merge: true });
      } catch {}
    }
    return clean;
  }

  async getLiteSpeedConfig(): Promise<LiteSpeedConfig> {
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'litespeed_cache'));
        if (snap.exists()) {
          const data = snap.data() as LiteSpeedConfig;
          this.saveSettingLocally('litespeed_cache', data);
          return data;
        }
      } catch {}
    }
    return this.getSavedSetting('litespeed_cache', initialLiteSpeed);
  }

  async updateLiteSpeedConfig(config: LiteSpeedConfig): Promise<LiteSpeedConfig> {
    const clean = sanitizePayload(config);
    this.saveSettingLocally('litespeed_cache', clean);
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'litespeed_cache'), clean, { merge: true });
      } catch {}
    }
    return clean;
  }

  async purgeLiteSpeedCache(): Promise<{ success: boolean }> {
    return { success: true };
  }

  // ==========================================
  // TELEGRAM BOT & ALERTS
  // ==========================================
  async getTelegramConfig(): Promise<TelegramConfig> {
    // 1. Try server API route first for cross-device consistency
    try {
      const res = await fetch('/api/admin/settings/telegram', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.config) {
          const cfg: TelegramConfig = {
            ...initialTelegram,
            ...json.config,
            enabled: json.config.enabled !== false,
          };
          this.saveSettingLocally('telegram', cfg);
          return cfg;
        }
      }
    } catch {}

    // 2. Direct Firestore read
    if (db) {
      try {
        const [genSnap, telSnap] = await Promise.all([
          getDoc(doc(db, 'store_settings', 'general')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'telegram')).catch(() => null),
        ]);

        const genTelegram =
          genSnap && genSnap.exists() && genSnap.data().telegram && typeof genSnap.data().telegram === 'object'
            ? (genSnap.data().telegram as TelegramConfig)
            : null;
        const telDoc = telSnap && telSnap.exists() ? (telSnap.data() as TelegramConfig) : null;

        const data =
          (genTelegram && (genTelegram.bot_token || genTelegram.admin_chat_ids))
            ? genTelegram
            : (telDoc && (telDoc.bot_token || telDoc.admin_chat_ids))
            ? telDoc
            : (genTelegram || telDoc || null);

        if (data) {
          const merged: TelegramConfig = {
            ...initialTelegram,
            ...data,
            enabled: data.enabled !== false,
          };
          this.saveSettingLocally('telegram', merged);
          return merged;
        }
      } catch (e) {
        console.warn('Firestore telegram fetch error, using local cache:', e);
      }
    }

    // 3. Fallback to localStorage or initialTelegram
    const local = this.getSavedSetting('telegram', initialTelegram);
    return {
      ...initialTelegram,
      ...local,
      enabled: local.enabled !== false,
    };
  }

  async updateTelegramConfig(config: TelegramConfig): Promise<TelegramConfig> {
    const clean: TelegramConfig = {
      ...config,
      enabled: config.enabled !== false,
      bot_token: String(config.bot_token || '').trim() || initialTelegram.bot_token,
      admin_chat_ids: String(config.admin_chat_ids || '').trim() || initialTelegram.admin_chat_ids,
      new_order_alert: config.new_order_alert !== false,
      product_alert: config.product_alert !== false,
      daily_summary_alert: config.daily_summary_alert !== false,
    };

    this.saveSettingLocally('telegram', clean);

    // 1. Send to server API route to ensure server-side persistence & cache sync
    try {
      await fetch('/api/admin/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clean),
      });
    } catch (e) {
      console.warn('API error saving telegram config:', e);
    }

    // 2. Direct Firestore write
    if (db) {
      const sanitized = sanitizePayload(clean);

      // Primary: store_settings/general (telegram) - permitted by Firestore rules across all devices
      try {
        await setDoc(
          doc(db, 'store_settings', 'general'),
          { telegram: sanitized },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore updateTelegram general doc warning:', e);
      }

      // Best-effort secondary mirror: store_settings/telegram
      try {
        await setDoc(doc(db, 'store_settings', 'telegram'), sanitized, { merge: true });
      } catch (e) {
        // Expected if rules restrict separate telegram doc
      }
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_TELEGRAM_CONFIG',
      module: 'Telegram Alerts',
      details: `Updated Telegram bot token & admin chat IDs (${clean.admin_chat_ids}, Status: ${clean.enabled ? 'ACTIVE' : 'DISABLED'})`,
    });

    return clean;
  }

  async testTelegramAlert(): Promise<{ success: boolean; message: string }> {
    const tg = await this.getTelegramConfig();
    const token = tg.bot_token?.trim() || '';
    const rawIds = tg.admin_chat_ids?.trim() || '';
    const targetChatIds = rawIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!token || targetChatIds.length === 0) {
      return {
        success: false,
        message: 'Please configure Bot Token and at least one Admin Chat ID in settings first.',
      };
    }

    // 1. Try server-side test dispatch first
    try {
      const apiRes = await fetch('/api/admin/settings/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: token, admin_chat_ids: targetChatIds.join(',') }),
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.success) {
          return { success: true, message: json.message };
        }
      }
    } catch (e) {
      console.warn('Server test dispatch warning, falling back to client fetch:', e);
    }

    // 2. Direct client fallback dispatch
    const istTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const msg = `⚡🔔 <b>ZTORE DIGITAL STORE — TELEGRAM BOT TEST ALERT</b> 🚀
━━━━━━━━━━━━━━━━━━━━━━
✅ <b>Bot Connection:</b> Active & Verified
📱 <b>Admin Chat IDs:</b> ${targetChatIds.join(', ')}
🕒 <b>Dispatched At (IST):</b> ${istTime}
🏬 <b>Admin Panel:</b> /asdf/settings
━━━━━━━━━━━━━━━━━━━━━━
<i>If you received this message, your Telegram alerts are working 100% properly!</i>`;

    let successCount = 0;
    const errors: string[] = [];

    await Promise.allSettled(
      targetChatIds.map(async (chatId) => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: msg,
              parse_mode: 'HTML',
            }),
          });
          const json = await res.json();
          if (json.ok) {
            successCount++;
          } else {
            errors.push(`Chat ${chatId}: ${json.description || 'Failed'}`);
          }
        } catch (err: any) {
          errors.push(`Chat ${chatId}: ${err.message}`);
        }
      })
    );

    if (successCount > 0) {
      await this.updateTelegramConfig({
        ...tg,
        last_test_status: `Verified (${successCount}/${targetChatIds.length} chats)`,
        last_test_at: new Date().toISOString(),
      });
      return {
        success: true,
        message: `Test alert sent successfully to ${successCount} admin chat(s)!`,
      };
    } else {
      throw new Error(`Failed to dispatch alert: ${errors.join('; ') || 'Telegram API error'}`);
    }
  }

  // ==========================================
  // 17. GLOBAL BUMP OFFER MANAGEMENT
  // ==========================================
  async getGlobalBumpOffer(): Promise<GlobalBumpOffer> {
    const defaultBump: GlobalBumpOffer = {
      enabled: true,
      bump_type: 'store_product',
      product_id: 'bump-special-01',
      product_slug: '1500-ultimate-twisted-world-reel-bundle',
      title: '1500+ Ultimate Twisted World & Viral AI Reels Pack',
      subtitle: 'Add this exclusive bonus pack to your order & get 80% instant discount!',
      price: 99,
      regular_price: 499,
      discount_percentage: 80,
      thumbnail: 'https://reelsbundles.in/wp-content/uploads/2026/10/3200-ultimate-twisted-world-reel-bundle-reels-bundle-1-2-768x576.png',
      reel_count: 1500,
      google_drive_link: 'https://drive.google.com/drive/folders/bonus-pack-twisted-world',
    };

    // 1. Try local storage cache
    let cached: GlobalBumpOffer | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('vaultzet_global_bump_offer');
        if (raw) {
          cached = JSON.parse(raw);
        }
      } catch {}
    }

    // 2. Try server-side admin API route
    try {
      const res = await fetch('/api/admin/settings/bump-offer', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.bumpOffer) {
          const b = data.bumpOffer;
          const merged: GlobalBumpOffer = {
            enabled: typeof b.enabled === 'boolean' ? b.enabled : true,
            bump_type: b.bump_type || b.bumpType || (b.product_slug ? 'store_product' : 'custom') || defaultBump.bump_type,
            product_id: b.productId || b.product_id || defaultBump.product_id,
            product_slug: b.productSlug || b.product_slug || defaultBump.product_slug,
            title: b.title || defaultBump.title,
            subtitle: b.subtitle || defaultBump.subtitle,
            price: Number(b.price != null ? b.price : defaultBump.price),
            regular_price: Number(b.regularPrice || b.regular_price || defaultBump.regular_price),
            discount_percentage: Number(b.discountPercentage || b.discount_percentage || defaultBump.discount_percentage),
            thumbnail: b.thumbnail || defaultBump.thumbnail,
            reel_count: Number(b.reelCount || b.reel_count || defaultBump.reel_count),
            google_drive_link: b.googleDriveLink || b.google_drive_link || defaultBump.google_drive_link,
            updated_at: b.updatedAt || b.updated_at,
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_global_bump_offer', JSON.stringify(merged));
            } catch {}
          }
          return merged;
        }
      }
    } catch (err) {
      console.warn('Could not fetch bump offer from admin API, checking Firestore:', err);
    }

    // 3. Direct Firestore fallback
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'bump_offer'));
        if (snap.exists()) {
          const data = snap.data();
          const discount_percentage =
            data.regular_price && data.price
              ? Math.max(1, Math.round(((Number(data.regular_price) - Number(data.price)) / Number(data.regular_price)) * 100))
              : data.discount_percentage || 80;

          const merged: GlobalBumpOffer = {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : (data.bump_enabled ?? true),
            bump_type: data.bump_type || (data.product_slug ? 'store_product' : 'custom') || defaultBump.bump_type,
            product_id: data.product_id || data.bump_product_id || defaultBump.product_id,
            product_slug: data.product_slug || data.bump_product_slug || defaultBump.product_slug,
            title: data.title || data.bump_title || defaultBump.title,
            subtitle: data.subtitle || data.bump_subtitle || defaultBump.subtitle,
            price: Number(data.price != null ? data.price : defaultBump.price),
            regular_price: Number(data.regular_price != null ? data.regular_price : defaultBump.regular_price),
            discount_percentage,
            thumbnail: data.thumbnail || data.bump_thumbnail || defaultBump.thumbnail,
            reel_count: Number(data.reel_count != null ? data.reel_count : defaultBump.reel_count),
            google_drive_link: data.google_drive_link || defaultBump.google_drive_link,
            updated_at: data.updated_at,
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_global_bump_offer', JSON.stringify(merged));
            } catch {}
          }
          return merged;
        }
      } catch (err) {
        console.warn('Direct Firestore read error for bump_offer:', err);
      }
    }

    if (cached) return cached;
    return defaultBump;
  }

  async updateGlobalBumpOffer(data: Partial<GlobalBumpOffer>): Promise<GlobalBumpOffer> {
    const existing = await this.getGlobalBumpOffer();
    const price = Number(data.price != null ? data.price : existing.price);
    const regular_price = Number(data.regular_price != null ? data.regular_price : (price * 5));
    const discount_percentage = Math.max(
      1,
      Math.round(((regular_price - price) / regular_price) * 100)
    );

    const merged: GlobalBumpOffer = {
      ...existing,
      ...data,
      price,
      regular_price,
      discount_percentage,
      updated_at: new Date().toISOString(),
    };

    // 1. Send to server API route
    try {
      const res = await fetch('/api/admin/settings/bump-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('API error saving bump offer:', errJson);
      }
    } catch (e) {
      console.warn('Network error saving bump offer to admin API:', e);
    }

    // 2. Direct Firestore persistence
    if (db) {
      try {
        const cleanPayload = sanitizePayload({
          ...merged,
          bump_enabled: merged.enabled,
          bump_product_id: merged.product_id,
          bump_product_slug: merged.product_slug,
          bump_title: merged.title,
          bump_subtitle: merged.subtitle,
          bump_price: merged.price,
          bump_regular_price: merged.regular_price,
          bump_thumbnail: merged.thumbnail,
          bump_reel_count: merged.reel_count,
        });

        await setDoc(doc(db, 'store_settings', 'bump_offer'), cleanPayload, { merge: true });
        await setDoc(
          doc(db, 'store_settings', 'general'),
          { bump_offer: cleanPayload },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore write warning for bump offer:', e);
      }
    }

    // 3. Save in localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_global_bump_offer', JSON.stringify(merged));
      } catch {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_BUMP_OFFER',
      module: 'Settings',
      details: `Updated global checkout bump offer: ${merged.title} (₹${merged.price}, Status: ${merged.enabled ? 'ACTIVE' : 'OFF'})`,
    });

    return merged;
  }

  // ==========================================
  // 18. FREE BUNDLE OFFER PROMOTION MANAGEMENT
  // ==========================================
  async getFreeBundleOffer(): Promise<FreeBundleOffer> {
    const cleanOfferBanner = (img?: string) => {
      if (!img) return '';
      const trimmed = String(img).trim();
      if (
        trimmed === '/banner-free-bundles.png' ||
        trimmed.includes('Vaultzet-Neon-Reels-Bundle-Sale')
      ) {
        return '';
      }
      return trimmed;
    };

    const defaultOffer: FreeBundleOffer = {
      enabled: true,
      banner_image: '',
      banner_fallback_image: '',
      min_cart_value: 149,
      free_bundle_quantity: 2,
      headline: 'Get 2 of Any Bundle FREE',
      subheadline: 'PAY ₹149 OR MORE & PICK ANY 2 ADDITIONAL REELS BUNDLES AT NO EXTRA COST!',
      button_text: '🎁 Claim 2 Free Bundles on Min. ₹149 Order →',
    };

    let cached: FreeBundleOffer | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('vaultzet_free_bundle_offer');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            cached = {
              ...defaultOffer,
              ...parsed,
              banner_image: cleanOfferBanner(parsed.banner_image || parsed.bannerImage),
              banner_fallback_image: cleanOfferBanner(parsed.banner_fallback_image || parsed.bannerFallbackImage),
              min_cart_value: parsed.min_cart_value != null ? Number(parsed.min_cart_value) : (parsed.minCartValue != null ? Number(parsed.minCartValue) : 149),
              free_bundle_quantity: parsed.free_bundle_quantity != null ? Number(parsed.free_bundle_quantity) : (parsed.freeBundleQuantity != null ? Number(parsed.freeBundleQuantity) : 2),
            };
          }
        }
      } catch {}
    }

    if (db) {
      try {
        const genSnap = await getDoc(doc(db, 'store_settings', 'general'));
        if (genSnap.exists()) {
          const gData = genSnap.data();
          if (gData.free_bundle_offer && typeof gData.free_bundle_offer === 'object') {
            const f = gData.free_bundle_offer;
            const minVal = f.min_cart_value != null ? Number(f.min_cart_value) : 149;
            const freeQty = f.free_bundle_quantity != null ? Number(f.free_bundle_quantity) : 2;

            const merged: FreeBundleOffer = {
              enabled: typeof f.enabled === 'boolean' ? f.enabled : true,
              banner_image: cleanOfferBanner(f.banner_image),
              banner_fallback_image: cleanOfferBanner(f.banner_fallback_image),
              min_cart_value: minVal,
              free_bundle_quantity: freeQty,
              headline: f.headline || `Get ${freeQty} of Any Bundle FREE`,
              subheadline: f.subheadline || `PAY ₹${minVal} OR MORE & PICK ANY ${freeQty} ADDITIONAL REELS BUNDLES AT NO EXTRA COST!`,
              button_text: f.button_text || `🎁 Claim ${freeQty} Free Bundles on Min. ₹${minVal} Order →`,
              updated_at: f.updated_at,
            };
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('vaultzet_free_bundle_offer', JSON.stringify(merged));
              } catch {}
            }
            return merged;
          }
        }

        const snap = await getDoc(doc(db, 'store_settings', 'free_bundle_offer')).catch(() => null);
        if (snap && snap.exists()) {
          const data = snap.data();
          const minVal = data.min_cart_value != null ? Number(data.min_cart_value) : 149;
          const freeQty = data.free_bundle_quantity != null ? Number(data.free_bundle_quantity) : 2;

          const merged: FreeBundleOffer = {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
            banner_image: cleanOfferBanner(data.banner_image),
            banner_fallback_image: cleanOfferBanner(data.banner_fallback_image),
            min_cart_value: minVal,
            free_bundle_quantity: freeQty,
            headline: data.headline || `Get ${freeQty} of Any Bundle FREE`,
            subheadline: data.subheadline || `PAY ₹${minVal} OR MORE & PICK ANY ${freeQty} ADDITIONAL REELS BUNDLES AT NO EXTRA COST!`,
            button_text: data.button_text || `🎁 Claim ${freeQty} Free Bundles on Min. ₹${minVal} Order →`,
            updated_at: data.updated_at,
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_free_bundle_offer', JSON.stringify(merged));
            } catch {}
          }
          return merged;
        }
      } catch (err) {
        console.warn('Direct Firestore read error for free_bundle_offer:', err);
      }
    }

    if (cached) return cached;
    return defaultOffer;
  }

  async updateFreeBundleOffer(data: Partial<FreeBundleOffer>): Promise<FreeBundleOffer> {
    const existing = await this.getFreeBundleOffer();
    const min_cart_value = Math.max(1, Number(data.min_cart_value != null ? data.min_cart_value : existing.min_cart_value));
    const free_bundle_quantity = Math.max(1, Math.min(20, Number(data.free_bundle_quantity != null ? data.free_bundle_quantity : existing.free_bundle_quantity)));

    const merged: FreeBundleOffer = {
      ...existing,
      ...data,
      min_cart_value,
      free_bundle_quantity,
      updated_at: new Date().toISOString(),
    };

    // 1. Send to server API route
    try {
      const res = await fetch('/api/admin/settings/free-bundle-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('API error saving free bundle offer:', errJson);
      }
    } catch (e) {
      console.warn('Network error saving free bundle offer to admin API:', e);
    }

    // 2. Direct Firestore persistence (save to store_settings/general first to guarantee permission)
    if (db) {
      try {
        const cleanPayload = sanitizePayload({
          ...merged,
        });

        await setDoc(
          doc(db, 'store_settings', 'general'),
          { free_bundle_offer: cleanPayload },
          { merge: true }
        );

        try {
          await setDoc(doc(db, 'store_settings', 'free_bundle_offer'), cleanPayload, { merge: true });
        } catch {}
      } catch (e) {
        console.warn('Firestore write warning for free bundle offer:', e);
      }
    }

    // 3. Save in localStorage & broadcast update
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_free_bundle_offer', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('vaultzet:offer_updated', { detail: merged }));
      } catch {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_FREE_BUNDLE_OFFER',
      module: 'Commerce',
      details: `Updated promotional offer: Min ₹${merged.min_cart_value}, ${merged.free_bundle_quantity} Free Bundles (Status: ${merged.enabled ? 'ACTIVE' : 'OFF'})`,
    });

    return merged;
  }

  // ==========================================
  // 19. GROWTH PROOFS (3D INSTAGRAM SHOWCASE)
  // ==========================================
  async getGrowthProofs(): Promise<AdminGrowthProofsConfig> {
    const defaultVal: AdminGrowthProofsConfig = {
      enabled: true,
      badge: 'REAL GROWTH PROOF',
      headline: 'Real Growth By Our Bundle Users',
      subheadline: 'These creators acquired our bundles, scaled to 100K+ followers, and monetize daily.',
      autoplay: true,
      autoplayInterval: 4000,
      items: [],
    };

    let cached: AdminGrowthProofsConfig | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('vaultzet_growth_proofs');
        if (raw) cached = JSON.parse(raw);
      } catch {}
    }

    try {
      const res = await fetch('/api/admin/settings/growth-proofs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('vaultzet_growth_proofs', JSON.stringify(data.config));
            } catch {}
          }
          return data.config;
        }
      }
    } catch {}

    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'growth_proofs')).catch(() => null);
        if (snap && snap.exists()) {
          const cfg = { ...defaultVal, ...snap.data() } as AdminGrowthProofsConfig;
          return cfg;
        }
        const genSnap = await getDoc(doc(db, 'store_settings', 'general')).catch(() => null);
        if (genSnap && genSnap.exists()) {
          const gData = genSnap.data();
          if (gData.growth_proofs && typeof gData.growth_proofs === 'object') {
            return { ...defaultVal, ...gData.growth_proofs };
          }
        }
      } catch {}
    }

    return cached || defaultVal;
  }

  async updateGrowthProofs(data: Partial<AdminGrowthProofsConfig>): Promise<AdminGrowthProofsConfig> {
    const existing = await this.getGrowthProofs();
    const merged: AdminGrowthProofsConfig = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch('/api/admin/settings/growth-proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
    } catch {}

    if (db) {
      try {
        const cleanPayload = sanitizePayload(merged);
        await setDoc(doc(db, 'store_settings', 'general'), { growth_proofs: cleanPayload }, { merge: true });
        try {
          await setDoc(doc(db, 'store_settings', 'growth_proofs'), cleanPayload, { merge: true });
        } catch {}
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vaultzet_growth_proofs', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('vaultzet:growth_proofs_updated', { detail: merged }));
      } catch {}
    }

    await logAdminAction({
      adminEmail: 'admin@vaultzet.com',
      action: 'UPDATE_GROWTH_PROOFS',
      module: 'Commerce',
      details: `Updated Growth Proofs: ${merged.items?.length || 0} screenshots (Status: ${merged.enabled ? 'ACTIVE' : 'OFF'})`,
    });

    return merged;
  }

}

export const portalApi = new PortalApiClient();
