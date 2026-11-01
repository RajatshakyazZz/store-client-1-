'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Flame,
  X,
  Zap,
  ShoppingCart,
  Film,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { BundleProduct } from '@/types';
import { BUNDLE_PRODUCTS } from '@/data/bundles';
import { optimizeImageUrl } from '@/lib/imageOptimized';
import {
  fetchCustomProducts,
  getAllCatalogBundles,
  getLocalCustomProductsSync,
  mapFirestoreDocToBundleProduct,
} from '@/lib/customProducts';
import {
  HomepagePinnedConfig,
  fetchHomepagePinned,
  getHomepagePinnedSync,
  DEFAULT_HOMEPAGE_PINNED,
} from '@/lib/homepagePinnedSettings';

export default function ViralBundlesModal() {
  const router = useRouter();
  const { addToCart, buyNow } = useCart();

  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<HomepagePinnedConfig>(DEFAULT_HOMEPAGE_PINNED);
  const [allBundles, setAllBundles] = useState<BundleProduct[]>(BUNDLE_PRODUCTS);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync pinned settings & custom products after mount to guarantee zero hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    const initial = getHomepagePinnedSync();
    if (initial) setConfig(initial);

    fetchHomepagePinned(true).then((cfg) => {
      if (cfg) setConfig(cfg);
    }).catch(() => {});

    fetchCustomProducts().then((res) => {
      const all = getAllCatalogBundles(res, BUNDLE_PRODUCTS);
      setAllBundles(all);
    }).catch(() => {});

    const handlePinnedUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<HomepagePinnedConfig>;
      if (customEvt.detail) {
        setConfig(customEvt.detail);
      }
    };

    const handleOpenTrigger = () => {
      setIsOpen(true);
    };

    window.addEventListener('vaultzet:homepage_pinned_updated', handlePinnedUpdate);
    window.addEventListener('vaultzet:open_viral_bundles_popup', handleOpenTrigger);

    return () => {
      window.removeEventListener('vaultzet:homepage_pinned_updated', handlePinnedUpdate);
      window.removeEventListener('vaultzet:open_viral_bundles_popup', handleOpenTrigger);
    };
  }, []);

  // Compute the list of pinned viral bundles in exact order (with prefix, title, keyword & image resolution)
  const pinnedBundles = useMemo(() => {
    try {
      if (!isMounted || !config || !config.enabled || !Array.isArray(config.pinnedSlugs) || config.pinnedSlugs.length === 0) {
        return [];
      }

      const map = new Map<string, BundleProduct>();

      const registerBundle = (b: BundleProduct) => {
        if (!b) return;
        if (b.slug) {
          const s = String(b.slug).toLowerCase().trim();
          map.set(s, b);
          map.set(s.replace(/^rb-/, ''), b);
          map.set(`rb-${s}`, b);
        }
        if (b.id) {
          const id = String(b.id).toLowerCase().trim();
          map.set(id, b);
          map.set(id.replace(/^rb-/, ''), b);
          map.set(`rb-${id}`, b);
        }
        if (b.title) {
          const t = String(b.title).toLowerCase().trim();
          map.set(t, b);
          const tSlug = t.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          map.set(tSlug, b);
          map.set(tSlug.replace(/^rb-/, ''), b);
          map.set(`rb-${tSlug}`, b);
        }
      };

      for (const b of (allBundles || [])) {
        registerBundle(b);
      }
      for (const b of BUNDLE_PRODUCTS) {
        if (!map.has(b.slug.toLowerCase())) {
          registerBundle(b);
        }
      }

      // Check localStorage for custom products created in admin
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('vaultzet_custom_products');
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
              for (const p of parsed) {
                if (!p) continue;
                const mapped = mapFirestoreDocToBundleProduct(p);
                registerBundle(mapped);
                const rawSlug = String(p.slug || p.id || '').toLowerCase().trim();
                const rawName = String(p.name || '').toLowerCase().trim();
                const rawNameSlug = rawName.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                if (rawSlug) map.set(rawSlug, mapped);
                if (rawName) map.set(rawName, mapped);
                if (rawNameSlug) map.set(rawNameSlug, mapped);
              }
            }
          }
        } catch {}
      }

      return config.pinnedSlugs
        .map((slug) => {
          const clean = String(slug || '').toLowerCase().trim();
          if (!clean) return null;
          let found =
            map.get(clean) ||
            map.get(clean.replace(/^rb-/, '')) ||
            map.get(`rb-${clean}`);

          // Extract keyword words e.g. "snake" from "2500-ai-snake2"
          const words = clean
            .split(/[-_\s]+/)
            .filter((w) => w.length >= 3 && !['bundle', 'reels', 'pack', 'prod', 'video', 'videos'].includes(w));

          const keywordMatch = (allBundles || []).concat(BUNDLE_PRODUCTS).find((b) => {
            const text = `${b.slug} ${b.title} ${b.id}`.toLowerCase();
            return words.some((w) => text.includes(w));
          });

          if (!found && keywordMatch) {
            found = keywordMatch;
          }

          const fallbackThumbnail =
            keywordMatch?.thumbnail ||
            'https://reelsbundles.in/wp-content/uploads/2026/10/500-snake-ulti-duniya-reverse-world-ai-reels-bundle-2-768x576.png';

          if (found) {
            // Guarantee thumbnail is a real bundle image
            const thumb =
              found.thumbnail && !found.thumbnail.includes('photo-1618005182384-a83a8bd57fbe')
                ? found.thumbnail
                : fallbackThumbnail;
            return {
              ...found,
              thumbnail: thumb,
            };
          }

          // Fallback bundle object with clean formatting & realistic cover photo
          const fallbackTitle = clean
            .replace(/^rb-/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return ({
            id: clean,
            slug: clean.replace(/^rb-/, ''),
            title: fallbackTitle,
            shortDescription: `${fallbackTitle} viral bundle with ready-to-post high converting reels.`,
            category: 'AI Reels',
            categorySlug: 'ai-reels',
            reelCount: 1000,
            personalPrice: 99,
            personalOriginalPrice: 499,
            resellerPrice: 199,
            resellerOriginalPrice: 998,
            thumbnail: fallbackThumbnail,
            galleryImages: [],
            previewVideoUrl: '',
            previewVideoUrls: [],
          } as unknown) as BundleProduct;
        })
        .filter((b): b is BundleProduct => Boolean(b));
    } catch (err) {
      console.warn('Error computing pinned bundles:', err);
      return [];
    }
  }, [isMounted, config, allBundles]);

  // NEVER auto-open popup on page load; strictly open only when user clicks floating pill or button
  const handleClose = () => {
    setIsOpen(false);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    try {
      sessionStorage.setItem('vaultzet_viral_popup_seen', 'true');
    } catch {}
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll ONLY while user has modal open, restore immediately on close
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // If not mounted on client or no pinned bundles configured, don't show anything (zero hydration mismatch)
  if (!isMounted || pinnedBundles.length === 0) {
    return null;
  }

  const handleBuyNowClick = (bundle: BundleProduct) => {
    buyNow(bundle, 'personal');
    handleClose();
    router.push('/checkout');
  };

  const handleAddToCartClick = (bundle: BundleProduct) => {
    addToCart(bundle, 'personal');
  };

  const popupTitle = config.popupTitle || 'Viral Bundles';
  const popupSubtitle =
    config.popupSubtitle || 'Handpicked viral reels packs curated to scale your reach 10x.';
  const badgeText = config.badgeText || 'VIRAL BUNDLE';

  return (
    <>
      {/* 1. FLOATING ACTION TRIGGER PILL (Visible when modal is closed, perfectly positioned on mobile above bottom nav) */}
      {!isOpen && (
        <aside
          aria-label="Viral Bundles Spotlight"
          className="fixed bottom-[74px] sm:bottom-6 left-3 sm:left-5 z-[55] pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-slate-950 via-[#1a0c30] to-slate-900 text-white border-2 border-amber-400 hover:border-yellow-300 shadow-[0_6px_25px_rgba(245,158,11,0.5)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
            aria-label="Open Viral Bundles Spotlight"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <Flame className="w-3.5 h-3.5 fill-slate-950 animate-pulse" />
            </div>

            <div className="text-left flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-amber-300 tracking-tight drop-shadow-xs">
                {popupTitle}
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {pinnedBundles.length}
              </span>
            </div>
          </button>
        </aside>
      )}

      {/* 2. VIRAL BUNDLES POPUP MODAL (Perfect mobile & desktop balance) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="viral-bundles-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
        >
          {/* Backdrop */}
          <div
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
          />

          {/* Modal Card - Sized for Mobile & PC */}
          <div
            ref={modalRef}
            className="relative w-full max-w-lg sm:max-w-xl max-h-[85vh] rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#140b24] via-[#0d071a] to-[#080410] border border-amber-500/40 text-white shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(245,158,11,0.25)] flex flex-col overflow-hidden z-10 my-auto"
          >
            {/* Top Glowing Amber Line */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />

            {/* Header: Compact & Elegant */}
            <div className="p-3.5 sm:p-5 pb-2.5 sm:pb-3 border-b border-white/10 flex items-center justify-between gap-3 relative">
              <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{badgeText}</span>
                </div>

                <h2
                  id="viral-bundles-title"
                  className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2 truncate"
                >
                  <span className="truncate">{popupTitle}</span>
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shrink-0">
                    {pinnedBundles.length} Packs
                  </span>
                </h2>

                <p className="text-[11px] sm:text-xs text-slate-300 font-normal line-clamp-1">
                  {popupSubtitle}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Products List - Balanced Card Layout */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              {pinnedBundles.map((bundle, index) => {
                const origPrice = bundle.personalOriginalPrice || 499;
                const currPrice = bundle.personalPrice || 99;
                const discount =
                  origPrice > currPrice
                    ? Math.round(((origPrice - currPrice) / origPrice) * 100)
                    : 75;

                return (
                  <div
                    key={bundle.id || bundle.slug || index}
                    className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-900/80 border border-amber-500/20 hover:border-amber-400/50 transition-all flex items-center gap-2.5 sm:gap-3.5 shadow-sm group"
                  >
                    {/* Thumbnail: Sleek 64px on mobile, 80px on desktop */}
                    <Link
                      href={`/product/${bundle.slug}`}
                      onClick={handleClose}
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-slate-950 shrink-0 block border border-white/10 group-hover:scale-105 transition-transform"
                    >
                      <img
                        src={optimizeImageUrl(bundle.thumbnail, 160, 80)}
                        alt={bundle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.includes('reelsbundles.in')) {
                            target.src = 'https://reelsbundles.in/wp-content/uploads/2026/10/500-dr-skeleton-health-reels-bundle-1-2-768x576.png';
                          }
                        }}
                      />
                      <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-black/85 text-amber-300 text-[8px] font-black border border-amber-400/40">
                        #{index + 1}
                      </div>
                    </Link>

                    {/* Middle: Details */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Link
                        href={`/product/${bundle.slug}`}
                        onClick={handleClose}
                        className="font-bold text-xs sm:text-sm text-white hover:text-amber-400 transition-colors line-clamp-1 block leading-snug"
                      >
                        {bundle.title}
                      </Link>

                      <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                          {bundle.reelCount}+ Reels
                        </span>
                        <span className="text-emerald-400 font-bold">{discount}% OFF</span>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-1.5 pt-0.5">
                        <span className="text-xs sm:text-sm font-black text-amber-400">
                          ₹{currPrice}
                        </span>
                        {origPrice > currPrice && (
                          <span className="text-[10px] text-slate-500 line-through">
                            ₹{origPrice}
                          </span>
                        )}
                        <span className="text-[9px] text-emerald-400 font-medium hidden sm:inline">
                          • Instant Drive Access
                        </span>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleBuyNowClick(bundle)}
                        className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Zap className="w-3 h-3 fill-slate-950" />
                        <span>Buy ₹{currPrice}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCartClick(bundle)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700 transition-all cursor-pointer"
                        title="Add to Cart"
                        aria-label="Add to cart"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: Compact Reassurance */}
            <div className="p-2.5 sm:p-3.5 border-t border-white/10 bg-black/40 flex items-center justify-between text-[10px] sm:text-xs text-slate-400">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold truncate pr-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Google Drive • Instant Download</span>
              </div>

              <Link
                href="/shop"
                onClick={handleClose}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline shrink-0"
              >
                <span>View All Shop</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
