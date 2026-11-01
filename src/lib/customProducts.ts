import { BundleProduct } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { BUNDLE_PRODUCTS } from '@/data/bundles';
import { isLegacyScrapedVideoUrl } from '@/lib/videoUtils';
import { getHomepagePinnedSync } from '@/lib/homepagePinnedSettings';

// Helper to reliably detect and filter out demo, placeholder, deleted, or dummy test bundles
export function isDemoOrInvalidBundle(p: any): boolean {
  if (!p) return true;
  const title = String(p.title || p.name || '').trim();
  const slug = String(p.slug || '').trim().toLowerCase();
  const id = String(p.id || '').trim().toLowerCase();
  const thumb = String(p.thumbnail || p.featured_image || p.image || '').trim();

  // Explicit demo/test/placeholder/deleted titles
  if (
    !title ||
    title === 'Reels Bundle' ||
    title === 'New Reels Bundle' ||
    title === 'New Product' ||
    title === '[DELETED]' ||
    title.toLowerCase().startsWith('demo') ||
    title.toLowerCase().startsWith('test')
  ) {
    return true;
  }

  // Explicit demo/test slugs or IDs
  if (
    slug === 'reels-bundle' ||
    slug === 'new-reels-bundle' ||
    slug.startsWith('test-') ||
    slug.startsWith('demo-') ||
    id.startsWith('test-') ||
    id.startsWith('demo-')
  ) {
    return true;
  }

  // Stock placeholder unsplash image with generic or missing title
  if (
    thumb.includes('photo-1618005182384-a83a8bd57fbe') &&
    (title === 'Reels Bundle' || title === 'New Reels Bundle' || !title)
  ) {
    return true;
  }

  if (Boolean(p.is_deleted || p.isDeleted || p.status === 'trash' || p.status === 'draft')) {
    return true;
  }

  return false;
}

// Purge legacy scraped preview video links from browser localStorage cache
if (typeof window !== 'undefined') {
  try {
    const videoCleanKey = 'vaultzet_video_cleaned_v3';
    if (localStorage.getItem(videoCleanKey) !== 'true') {
      const raw = localStorage.getItem('vaultzet_custom_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleanedList = parsed.map((item: any) => ({
            ...item,
            preview_video_url: isLegacyScrapedVideoUrl(item.preview_video_url) ? '' : (item.preview_video_url || ''),
            previewVideoUrl: isLegacyScrapedVideoUrl(item.previewVideoUrl) ? '' : (item.previewVideoUrl || ''),
            preview_video_urls: (item.preview_video_urls || []).filter((u: string) => !isLegacyScrapedVideoUrl(u)),
            previewVideoUrls: (item.previewVideoUrls || []).filter((u: string) => !isLegacyScrapedVideoUrl(u)),
          }));
          localStorage.setItem('vaultzet_custom_products', JSON.stringify(cleanedList));
        }
      }
      localStorage.setItem(videoCleanKey, 'true');
    }
  } catch {}
}

export function mapFirestoreDocToBundleProduct(data: any): BundleProduct {
  if (!data) data = {};
  const rawName = data.name ? String(data.name).trim() : '';
  const rawSlug = data.slug ? String(data.slug).trim() : '';
  const rawId = data.id ? String(data.id).trim() : '';

  // Look for an existing base product in BUNDLE_PRODUCTS to overlay updates
  const cleanSlug = rawSlug.toLowerCase();
  const cleanId = rawId.toLowerCase();
  const cleanIdNoPrefix = cleanId.replace(/^rb-/, '');

  const baseProd = BUNDLE_PRODUCTS.find(
    (b) =>
      (cleanSlug && b.slug.toLowerCase() === cleanSlug) ||
      (cleanId && b.id.toLowerCase() === cleanId) ||
      (cleanIdNoPrefix && b.id.toLowerCase().replace(/^rb-/, '') === cleanIdNoPrefix) ||
      (b.aliases && cleanSlug && b.aliases.some((a) => a.toLowerCase() === cleanSlug))
  );

  const name = rawName || baseProd?.title || 'Reels Bundle';
  const slug =
    rawSlug ||
    baseProd?.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') ||
    'reels-bundle';

  const price =
    data.price != null
      ? Number(data.price)
      : data.sale_price != null
      ? Number(data.sale_price)
      : baseProd?.personalPrice != null
      ? baseProd.personalPrice
      : 99;

  const regularPrice =
    data.regular_price != null
      ? Number(data.regular_price)
      : baseProd?.personalOriginalPrice != null
      ? baseProd.personalOriginalPrice
      : price * 5;

  const resellerPrice =
    data.reseller_price != null
      ? Number(data.reseller_price)
      : baseProd?.resellerPrice != null
      ? baseProd.resellerPrice
      : price * 2;

  const resellerRegularPrice =
    data.reseller_regular_price != null
      ? Number(data.reseller_regular_price)
      : baseProd?.resellerOriginalPrice != null
      ? baseProd.resellerOriginalPrice
      : price * 10;

  const rawCats: string[] = Array.isArray(data.categories) && data.categories.length > 0
    ? data.categories.map(String).map((c: string) => c.trim()).filter(Boolean)
    : typeof data.categories === 'string' && data.categories.trim()
    ? [data.categories.trim()]
    : typeof data.category === 'string' && data.category.trim()
    ? [data.category.trim()]
    : baseProd?.categories && baseProd.categories.length > 0
    ? baseProd.categories
    : ['Trending Reels'];

  const category = rawCats[0] || baseProd?.category || 'Trending Reels';
  const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const categorySlugs = rawCats.map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

  let tags: string[] = [];
  if (Array.isArray(data.tags) && data.tags.length > 0) {
    tags = data.tags.filter((t: any) => typeof t === 'string');
  } else if (typeof data.tags === 'string' && data.tags.trim()) {
    tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  } else if (baseProd?.tags) {
    tags = baseProd.tags;
  }

  const galleryImages = Array.isArray(data.gallery_images) && data.gallery_images.length > 0
    ? data.gallery_images.filter((img: any) => typeof img === 'string')
    : baseProd?.galleryImages || [];

  const defaultFeatures = [
    'Direct Google Drive Instant Access',
    `${data.reel_count || baseProd?.reelCount || 1000}+ High Quality HD Viral Reels`,
    'No Watermark, Ready to Post',
    'Pre-added Trending Background Audio',
    'Full Reseller Commercial Rights Available',
    'Instant Lifetime Access & Free Updates',
  ];

  const defaultFaqs = [
    {
      question: 'How do I access this bundle after payment?',
      answer:
        'Instant Google Drive link is provided right after payment on the confirmation page and also sent to your Gmail.',
    },
    {
      question: 'Can I monetize or resell these reels?',
      answer:
        'Yes! With the Reseller Rights license, you can keep 100% of the profits and resell them anywhere.',
    },
    {
      question: 'Do these reels have any watermark?',
      answer:
        'No, all reels are completely clean, watermark-free, and rendered in 1080x1920 Full HD (9:16).',
    },
  ];

  const features =
    Array.isArray(data.features) && data.features.length > 0
      ? data.features.filter((f: any) => typeof f === 'string')
      : baseProd?.features && baseProd.features.length > 0
      ? baseProd.features
      : defaultFeatures;

  const faqs =
    Array.isArray(data.faqs) && data.faqs.length > 0
      ? data.faqs.filter((faq: any) => faq && typeof faq === 'object')
      : baseProd?.faqs && baseProd.faqs.length > 0
      ? baseProd.faqs
      : defaultFaqs;

  const baseFiles = baseProd?.files || [];
  const rawFiles = Array.isArray(data.files) && data.files.length > 0 ? data.files : baseFiles;
  // Security: Never leak real Google Drive URLs in public store client data
  const files = rawFiles.map((f: any) => ({
    id: f?.id || 'file-1',
    name: f?.name || `${name} Access`,
    file_url: '', // Explicitly wiped for public frontend security
  }));

  const rawBump = data.bump_offer || data.bumpOffer;
  let bumpOffer: any = undefined;
  if (rawBump && typeof rawBump === 'object') {
    bumpOffer = {
      enabled: typeof rawBump.enabled === 'boolean' ? rawBump.enabled : true,
      mode: (rawBump.mode as 'custom' | 'disabled' | 'default') || (rawBump.enabled === false ? 'disabled' : 'default'),
      productId: rawBump.product_id || rawBump.productId || '',
      productSlug: rawBump.product_slug || rawBump.productSlug || '',
      title: rawBump.title || '',
      subtitle: rawBump.subtitle || '',
      price: rawBump.price != null ? Number(rawBump.price) : undefined,
      regularPrice: rawBump.regular_price != null ? Number(rawBump.regular_price) : (rawBump.regularPrice != null ? Number(rawBump.regularPrice) : undefined),
      thumbnail: rawBump.thumbnail || '',
      reelCount: rawBump.reel_count != null ? Number(rawBump.reel_count) : (rawBump.reelCount != null ? Number(rawBump.reelCount) : undefined),
      googleDriveLink: rawBump.google_drive_link || rawBump.googleDriveLink || '',
    };
  }

  return {
    id: String(data.id || baseProd?.id || slug),
    slug,
    title: name,
    shortDescription:
      String(data.short_description || '') ||
      (typeof data.description === 'string' ? data.description.slice(0, 160) : '') ||
      baseProd?.shortDescription ||
      `Get instant access to ${data.reel_count || baseProd?.reelCount || 1000}+ viral reels ready to publish.`,
    description: String(data.description || data.short_description || baseProd?.description || ''),
    category,
    categorySlug,
    reelCount: Number(data.reel_count || baseProd?.reelCount || 1000),
    personalPrice: price,
    personalOriginalPrice: regularPrice,
    resellerPrice,
    resellerOriginalPrice: resellerRegularPrice,
    thumbnail:
      String(
        data.featured_image ||
        data.thumbnail ||
        data.image ||
        data.imageUrl ||
        data.image_url ||
        data.poster ||
        ''
      ).trim() ||
      baseProd?.thumbnail ||
      (BUNDLE_PRODUCTS && BUNDLE_PRODUCTS[0]?.thumbnail) ||
      'https://reelsbundles.in/wp-content/uploads/2026/10/500-dr-skeleton-health-reels-bundle-1-2-768x576.png',
    galleryImages,
    previewVideoUrls: (() => {
      const rawUrls: string[] = Array.isArray(data.preview_video_urls) && data.preview_video_urls.length > 0
        ? data.preview_video_urls
        : Array.isArray(data.previewVideoUrls) && data.previewVideoUrls.length > 0
        ? data.previewVideoUrls
        : typeof data.preview_video_urls === 'string' && data.preview_video_urls.trim()
        ? data.preview_video_urls.split('\n')
        : (data.preview_video_url || data.previewVideoUrl)
        ? [String(data.preview_video_url || data.previewVideoUrl)]
        : (baseProd?.previewVideoUrls && baseProd.previewVideoUrls.length > 0)
        ? baseProd.previewVideoUrls
        : baseProd?.previewVideoUrl
        ? [baseProd.previewVideoUrl]
        : [];
      return rawUrls
        .map((u: any) => String(u || '').trim())
        .filter((u: string) => Boolean(u) && !isLegacyScrapedVideoUrl(u));
    })(),
    previewVideoUrl: (() => {
      const single = String(
        (Array.isArray(data.preview_video_urls) && data.preview_video_urls[0]) ||
        (Array.isArray(data.previewVideoUrls) && data.previewVideoUrls[0]) ||
        data.preview_video_url ||
        data.previewVideoUrl ||
        baseProd?.previewVideoUrl ||
        ''
      ).trim();
      return isLegacyScrapedVideoUrl(single) ? '' : single;
    })(),
    tags,
    isHot: typeof data.is_hot === 'boolean' ? data.is_hot : Boolean(baseProd?.isHot),
    isTrending: typeof data.is_trending === 'boolean' ? data.is_trending : Boolean(baseProd?.isTrending),
    rating: Number(data.rating || baseProd?.rating || 5),
    reviewCount: Number(data.review_count || baseProd?.reviewCount || 443),
    resolution: String(data.resolution || baseProd?.resolution || '1080P Full HD (9:16)'),
    aspectRatio: '9:16 (Vertical Reel)',
    format: String(data.format || baseProd?.format || 'MP4'),
    audioIncluded: true,
    googleDriveLink: '', // Never expose real drive link in public client state
    features,
    faqs,
    files,
    categories: rawCats,
    categorySlugs,
    bumpOffer,
  };
}

let cachedCustomProducts: BundleProduct[] | null = null;
let cachedDeletedSlugs = new Set<string>();
let lastFetchTime = 0;

export function getDeletedSlugsSync(): Set<string> {
  const set = new Set<string>(cachedDeletedSlugs);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('vaultzet_deleted_slugs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s) => {
            if (typeof s === 'string' && s) set.add(s.toLowerCase());
          });
        }
      }
    } catch {}
  }
  return set;
}

export function getLocalCustomProductsSync(): BundleProduct[] {
  if (typeof window === 'undefined') return [];
  const deleted = getDeletedSlugsSync();
  try {
    const raw = localStorage.getItem('vaultzet_custom_products');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Auto-scrub demo/test items from localStorage so stale cached dummy data is eliminated
      const sanitized = parsed.filter((item: any) => !isDemoOrInvalidBundle(item));
      if (sanitized.length !== parsed.length) {
        try {
          localStorage.setItem('vaultzet_custom_products', JSON.stringify(sanitized));
        } catch {}
      }

      return sanitized
        .map(mapFirestoreDocToBundleProduct)
        .filter(
          (p) =>
            !isDemoOrInvalidBundle(p) &&
            !deleted.has(p.slug.toLowerCase()) &&
            !deleted.has(p.id.toLowerCase())
        );
    }
  } catch {}
  return [];
}

export async function fetchCustomProducts(force = false): Promise<BundleProduct[]> {
  const now = Date.now();
  if (!force && cachedCustomProducts && now - lastFetchTime < 30000) {
    return cachedCustomProducts;
  }

  const list: BundleProduct[] = [];
  const localList = getLocalCustomProductsSync();
  const slugMap = new Map<string, BundleProduct>();
  const deletedSet = getDeletedSlugsSync();

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'products'));
      snap.docs.forEach((d) => {
        const data = d.data();
        if (
          d.id === 'category-registry-v1' ||
          data.name === '[INTERNAL_CATEGORY_REGISTRY]' ||
          data.status === 'private'
        ) {
          return;
        }
        const slug = String(data.slug || d.id || '').toLowerCase();
        const isDeleted = Boolean(
          data.is_deleted ||
            data.status === 'trash' ||
            data.status === 'draft' ||
            isDemoOrInvalidBundle(data)
        );

        if (isDeleted) {
          deletedSet.add(d.id.toLowerCase());
          if (slug) deletedSet.add(slug);
          cachedDeletedSlugs.add(d.id.toLowerCase());
          if (slug) cachedDeletedSlugs.add(slug);
        } else {
          const bundle = mapFirestoreDocToBundleProduct({ id: d.id, ...data });
          if (isDemoOrInvalidBundle(bundle)) {
            return;
          }
          const bundleSlug = bundle.slug.toLowerCase();
          const bundleId = bundle.id.toLowerCase();
          if (!deletedSet.has(bundleSlug) && !deletedSet.has(bundleId)) {
            // Deduplicate: if already seen (e.g. rb-slug vs slug), keep the one with price/fields
            const existing = slugMap.get(bundleSlug);
            if (!existing || (bundle.personalPrice && !existing.personalPrice)) {
              slugMap.set(bundleSlug, bundle);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error fetching custom products from Firestore:', e);
    }
  }

  // Add deduplicated Firestore bundles to list
  slugMap.forEach((bundle) => {
    if (!isDemoOrInvalidBundle(bundle)) {
      list.push(bundle);
    }
  });

  // Merge any local products not yet in Firestore (and not deleted)
  for (const lp of localList) {
    const lpSlug = lp.slug.toLowerCase();
    if (
      !isDemoOrInvalidBundle(lp) &&
      !slugMap.has(lpSlug) &&
      !deletedSet.has(lpSlug) &&
      !deletedSet.has(lp.id.toLowerCase())
    ) {
      list.push(lp);
      slugMap.set(lpSlug, lp);
    }
  }

  // Persist to localStorage for client-side instant lookups across all components
  if (typeof window !== 'undefined' && list.length > 0) {
    try {
      localStorage.setItem('vaultzet_custom_products', JSON.stringify(list));
    } catch {}
  }

  cachedCustomProducts = list;
  lastFetchTime = now;
  return list;
}

export function getAllCatalogBundles(
  customProds: BundleProduct[],
  initialBundles: BundleProduct[] = [],
  deletedSlugs: Set<string> = getDeletedSlugsSync()
): BundleProduct[] {
  const validCustom = (customProds || []).filter(
    (p): p is BundleProduct =>
      Boolean(
        p &&
          typeof p.slug === 'string' &&
          !isDemoOrInvalidBundle(p) &&
          !deletedSlugs.has(p.slug.toLowerCase()) &&
          !deletedSlugs.has(String(p.id || '').toLowerCase())
      )
  );

  // Map custom products by canonical slug and ID
  const customMap = new Map<string, BundleProduct>();
  const brandNewCustom: BundleProduct[] = [];

  // Index initial bundle identifiers & aliases to distinguish existing overrides from brand-new items
  const initialIdentifiers = new Set<string>();
  const identifierToBaseBundle = new Map<string, BundleProduct>();

  (initialBundles || []).forEach((b) => {
    const bSlug = (b.slug || '').toLowerCase();
    const bId = (b.id || '').toLowerCase();
    const bCleanId = bId.replace(/^rb-/, '');

    if (bSlug) {
      initialIdentifiers.add(bSlug);
      identifierToBaseBundle.set(bSlug, b);
    }
    if (bId) {
      initialIdentifiers.add(bId);
      identifierToBaseBundle.set(bId, b);
    }
    if (bCleanId) {
      initialIdentifiers.add(bCleanId);
      identifierToBaseBundle.set(bCleanId, b);
    }

    if (Array.isArray(b.aliases)) {
      b.aliases.forEach((alias) => {
        const cleanAlias = (alias || '').toLowerCase();
        if (cleanAlias) {
          initialIdentifiers.add(cleanAlias);
          initialIdentifiers.add(`rb-${cleanAlias}`);
          initialIdentifiers.add(cleanAlias.replace(/^rb-/, ''));
          identifierToBaseBundle.set(cleanAlias, b);
          identifierToBaseBundle.set(`rb-${cleanAlias}`, b);
          identifierToBaseBundle.set(cleanAlias.replace(/^rb-/, ''), b);
        }
      });
    }
  });

  validCustom.forEach((cp) => {
    const slugKey = (cp.slug || '').toLowerCase();
    const idKey = String(cp.id || '').toLowerCase();
    const cleanIdKey = idKey.replace(/^rb-/, '');

    const baseBundle =
      identifierToBaseBundle.get(slugKey) ||
      identifierToBaseBundle.get(idKey) ||
      identifierToBaseBundle.get(cleanIdKey);

    const isExisting = Boolean(baseBundle);

    if (isExisting && baseBundle) {
      // Map every possible key of both cp and baseBundle to cp so lookup ALWAYS succeeds
      customMap.set(slugKey, cp);
      customMap.set(idKey, cp);
      customMap.set(cleanIdKey, cp);

      const baseSlug = (baseBundle.slug || '').toLowerCase();
      const baseId = (baseBundle.id || '').toLowerCase();
      const baseCleanId = baseId.replace(/^rb-/, '');

      if (baseSlug) customMap.set(baseSlug, cp);
      if (baseId) customMap.set(baseId, cp);
      if (baseCleanId) customMap.set(baseCleanId, cp);

      if (Array.isArray(baseBundle.aliases)) {
        baseBundle.aliases.forEach((a) => {
          const aLower = (a || '').toLowerCase();
          if (aLower) {
            customMap.set(aLower, cp);
            customMap.set(`rb-${aLower}`, cp);
            customMap.set(aLower.replace(/^rb-/, ''), cp);
          }
        });
      }
    } else {
      if (!brandNewCustom.some((b) => b.slug.toLowerCase() === slugKey || b.id.toLowerCase() === idKey)) {
        brandNewCustom.push(cp);
      }
    }
  });

  // Overlay custom updates in-place over initialBundles so curated order is preserved
  const updatedInitial = (initialBundles || [])
    .filter(
      (b) =>
        b &&
        typeof b.slug === 'string' &&
        !deletedSlugs.has(b.slug.toLowerCase()) &&
        !deletedSlugs.has(String(b.id || '').toLowerCase())
    )
    .map((b) => {
      const slugKey = b.slug.toLowerCase();
      const idKey = String(b.id || '').toLowerCase();
      const cleanIdKey = idKey.replace(/^rb-/, '');

      let override = customMap.get(slugKey) || customMap.get(idKey) || customMap.get(cleanIdKey);
      if (!override && Array.isArray(b.aliases)) {
        for (const a of b.aliases) {
          const aLower = (a || '').toLowerCase();
          override = customMap.get(aLower) || customMap.get(`rb-${aLower}`) || customMap.get(aLower.replace(/^rb-/, ''));
          if (override) break;
        }
      }

      if (override) {
        return {
          ...b,
          ...override,
          personalPrice: override.personalPrice,
          personalOriginalPrice: override.personalOriginalPrice,
          resellerPrice: override.resellerPrice,
          resellerOriginalPrice: override.resellerOriginalPrice,
          title: override.title || b.title,
          description: override.description || b.description,
          shortDescription: override.shortDescription || b.shortDescription,
        };
      }
      return b;
    });

  // Brand-new products placed on top, existing products preserve curated order with updated prices
  const rawBundles = [...brandNewCustom, ...updatedInitial].filter((b) => !isDemoOrInvalidBundle(b));

  // Prioritize homepage-pinned products to the absolute top of the catalog
  const pinnedConfig = getHomepagePinnedSync();
  const pinnedSlugs =
    pinnedConfig && pinnedConfig.enabled && Array.isArray(pinnedConfig.pinnedSlugs)
      ? pinnedConfig.pinnedSlugs
      : [];

  if (pinnedSlugs.length > 0) {
    try {
      const pinnedMap = new Map<string, number>();
      pinnedSlugs.forEach((slug, idx) => {
        const clean = String(slug || '').toLowerCase().trim();
        if (clean) {
          pinnedMap.set(clean, idx);
          pinnedMap.set(clean.replace(/^rb-/, ''), idx);
          pinnedMap.set(`rb-${clean}`, idx);
        }
      });

      const pinnedItems: BundleProduct[] = [];
      const nonPinnedItems: BundleProduct[] = [];

      for (const item of rawBundles) {
        if (!item) continue;
        const sKey = String(item.slug || '').toLowerCase().trim();
        const idKey = String(item.id || '').toLowerCase().trim();
        if (pinnedMap.has(sKey) || pinnedMap.has(idKey)) {
          pinnedItems.push({
            ...item,
            isHomepageTop: true,
            homepageRank: (pinnedMap.get(sKey) ?? pinnedMap.get(idKey) ?? 0) + 1,
          });
        } else {
          nonPinnedItems.push(item);
        }
      }

      pinnedItems.sort((a, b) => {
        const aSlug = String(a?.slug || '').toLowerCase().trim();
        const bSlug = String(b?.slug || '').toLowerCase().trim();
        const aId = String(a?.id || '').toLowerCase().trim();
        const bId = String(b?.id || '').toLowerCase().trim();
        const rankA = pinnedMap.get(aSlug) ?? pinnedMap.get(aId) ?? 999;
        const rankB = pinnedMap.get(bSlug) ?? pinnedMap.get(bId) ?? 999;
        return rankA - rankB;
      });

      return [...pinnedItems, ...nonPinnedItems];
    } catch (err) {
      console.warn('Error applying homepage pinned sorting:', err);
      return rawBundles;
    }
  }

  return rawBundles;
}

const serverSingleProductCache = new Map<string, { product: BundleProduct | null; cachedAt: number }>();
const SERVER_SINGLE_CACHE_TTL = 30 * 1000; // 30 seconds

export async function fetchCustomProductBySlug(slug: string, forceLive = false): Promise<BundleProduct | null> {
  const clean = slug.trim().toLowerCase();
  const deletedSet = getDeletedSlugsSync();
  if (deletedSet.has(clean)) return null;

  // 0. Fast in-memory server/client cache (bypassed if forceLive = true)
  if (!forceLive) {
    const memCached = serverSingleProductCache.get(clean);
    if (memCached && Date.now() - memCached.cachedAt < SERVER_SINGLE_CACHE_TTL) {
      return memCached.product;
    }
  }

  // Find corresponding base bundle in BUNDLE_PRODUCTS if one exists
  const baseProd = BUNDLE_PRODUCTS.find(
    (b) =>
      b.slug.toLowerCase() === clean ||
      b.id.toLowerCase() === clean ||
      b.id.toLowerCase().replace(/^rb-/, '') === clean ||
      (b.aliases && b.aliases.some((a) => a.toLowerCase() === clean || `rb-${a.toLowerCase()}` === clean || a.toLowerCase().replace(/^rb-/, '') === clean))
  );

  // 1. Check local cache (only if NOT forceLive)
  if (!forceLive) {
    const localList = getLocalCustomProductsSync();
    const local = localList.find((p) => {
      const pSlug = (p.slug || '').toLowerCase();
      const pId = (p.id || '').toLowerCase();
      const pCleanId = pId.replace(/^rb-/, '');
      if (deletedSet.has(pSlug) || deletedSet.has(pId)) return false;

      if (pSlug === clean || pId === clean || pCleanId === clean) return true;
      if (baseProd) {
        if (baseProd.slug.toLowerCase() === pSlug || baseProd.id.toLowerCase() === pId) return true;
        if (baseProd.aliases && baseProd.aliases.some((a) => a.toLowerCase() === pSlug || a.toLowerCase() === pId || `rb-${a.toLowerCase()}` === pId)) return true;
      }
      return false;
    });

    if (local) {
      const res = baseProd
        ? {
            ...baseProd,
            ...local,
            personalPrice: local.personalPrice,
            personalOriginalPrice: local.personalOriginalPrice,
            resellerPrice: local.resellerPrice,
            resellerOriginalPrice: local.resellerOriginalPrice,
          }
        : local;
      serverSingleProductCache.set(clean, { product: res, cachedAt: Date.now() });
      return res;
    }
  }

  // 2. Query Firestore directly: check candidate doc IDs in parallel (including all aliases)
  if (db) {
    const firestoreDb = db;
    const candidateIds = Array.from(
      new Set(
        [
          clean,
          `rb-${clean}`,
          clean.replace(/^rb-/, ''),
          baseProd?.id,
          baseProd?.slug,
          ...(baseProd?.aliases || []),
          ...(baseProd?.aliases || []).map((a) => `rb-${a}`),
          ...(baseProd?.aliases || []).map((a) => a.replace(/^rb-/, '')),
        ].filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      )
    ).map((id) => id.toLowerCase());

    try {
      const candidateSnaps = await Promise.all(
        candidateIds.map((candId) => getDoc(doc(firestoreDb, 'products', candId)).catch(() => null))
      );

      for (const snap of candidateSnaps) {
        if (snap && snap.exists()) {
          const data = snap.data();
          if (!data.is_deleted && data.status !== 'trash') {
            const mapped = mapFirestoreDocToBundleProduct({ id: snap.id, ...data });
            const finalResult = baseProd
              ? {
                  ...baseProd,
                  ...mapped,
                  personalPrice: mapped.personalPrice,
                  personalOriginalPrice: mapped.personalOriginalPrice,
                  resellerPrice: mapped.resellerPrice,
                  resellerOriginalPrice: mapped.resellerOriginalPrice,
                }
              : mapped;
            serverSingleProductCache.set(clean, { product: finalResult, cachedAt: Date.now() });

            // Sync updated product into client-side localStorage so other pages have fresh data
            if (typeof window !== 'undefined') {
              try {
                const raw = localStorage.getItem('vaultzet_custom_products');
                let list = raw ? JSON.parse(raw) : [];
                if (Array.isArray(list)) {
                  const idx = list.findIndex(
                    (p: any) =>
                      (p.slug && p.slug.toLowerCase() === clean) ||
                      (p.id && p.id.toLowerCase() === clean) ||
                      (baseProd && (p.slug?.toLowerCase() === baseProd.slug.toLowerCase() || p.id?.toLowerCase() === baseProd.id.toLowerCase()))
                  );
                  const storageItem = { ...finalResult, price: finalResult.personalPrice };
                  if (idx !== -1) {
                    list[idx] = { ...list[idx], ...storageItem };
                  } else {
                    list.unshift(storageItem);
                  }
                  localStorage.setItem('vaultzet_custom_products', JSON.stringify(list));
                }
              } catch {}
            }

            return finalResult;
          }
        }
      }
    } catch {}

    // 3. Fallback scan if candidate direct lookups didn't match
    try {
      const snap = await getDocs(collection(db, 'products'));
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status === 'draft' || data.status === 'trash' || data.is_deleted) continue;
        const docId = d.id.toLowerCase();
        const docSlug = String(data.slug || '').toLowerCase();

        const isMatch =
          docSlug === clean ||
          docId === clean ||
          docId === `rb-${clean}` ||
          clean === `rb-${docSlug}` ||
          (baseProd && (
            docSlug === baseProd.slug.toLowerCase() ||
            docId === baseProd.id.toLowerCase() ||
            docId === `rb-${baseProd.slug.toLowerCase()}` ||
            (baseProd.aliases && baseProd.aliases.some((a) => a.toLowerCase() === docSlug || a.toLowerCase() === docId || `rb-${a.toLowerCase()}` === docId))
          ));

        if (isMatch) {
          const mapped = mapFirestoreDocToBundleProduct({ id: d.id, ...data });
          const finalResult = baseProd
            ? {
                ...baseProd,
                ...mapped,
                personalPrice: mapped.personalPrice,
                personalOriginalPrice: mapped.personalOriginalPrice,
                resellerPrice: mapped.resellerPrice,
                resellerOriginalPrice: mapped.resellerOriginalPrice,
              }
            : mapped;
          serverSingleProductCache.set(clean, { product: finalResult, cachedAt: Date.now() });

          if (typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem('vaultzet_custom_products');
              let list = raw ? JSON.parse(raw) : [];
              if (Array.isArray(list)) {
                const idx = list.findIndex(
                  (p: any) =>
                    (p.slug && p.slug.toLowerCase() === clean) ||
                    (p.id && p.id.toLowerCase() === clean) ||
                    (baseProd && (p.slug?.toLowerCase() === baseProd.slug.toLowerCase() || p.id?.toLowerCase() === baseProd.id.toLowerCase()))
                );
                const storageItem = { ...finalResult, price: finalResult.personalPrice };
                if (idx !== -1) {
                  list[idx] = { ...list[idx], ...storageItem };
                } else {
                  list.unshift(storageItem);
                }
                localStorage.setItem('vaultzet_custom_products', JSON.stringify(list));
              }
            } catch {}
          }

          return finalResult;
        }
      }
    } catch (e) {
      console.warn('Error fetching single custom product:', e);
    }
  }

  // If not in Firestore or local, but exists in BUNDLE_PRODUCTS
  if (baseProd && !deletedSet.has(baseProd.slug.toLowerCase()) && !deletedSet.has(baseProd.id.toLowerCase())) {
    serverSingleProductCache.set(clean, { product: baseProd, cachedAt: Date.now() });
    return baseProd;
  }

  return null;
}
