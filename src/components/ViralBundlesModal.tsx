'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Flame,
  X,
  Sparkles,
  ArrowRight,
  ShoppingCart,
  Zap,
  Film,
  CheckCircle2,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { BundleProduct } from '@/types';
import { BUNDLE_PRODUCTS } from '@/data/bundles';
import { optimizeImageUrl } from '@/lib/imageOptimized';
import {
  fetchCustomProducts,
  getAllCatalogBundles,
  getLocalCustomProductsSync,
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

  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<HomepagePinnedConfig>(getHomepagePinnedSync());
  const [allBundles, setAllBundles] = useState<BundleProduct[]>(() => {
    const local = getLocalCustomProductsSync();
    return getAllCatalogBundles(local, BUNDLE_PRODUCTS);
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync pinned settings & products
  useEffect(() => {
    fetchHomepagePinned().then((cfg) => {
      if (cfg) setConfig(cfg);
    });

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

  // Compute the list of pinned viral bundles in exact order
  const pinnedBundles = useMemo(() => {
    if (!config.enabled || !config.pinnedSlugs || config.pinnedSlugs.length === 0) {
      return [];
    }

    const map = new Map<string, BundleProduct>();
    for (const b of allBundles) {
      if (b.slug) map.set(b.slug.toLowerCase().trim(), b);
      if (b.id) map.set(String(b.id).toLowerCase().trim(), b);
    }

    return config.pinnedSlugs
      .map((slug) => map.get(slug.toLowerCase().trim()))
      .filter((b): b is BundleProduct => Boolean(b));
  }, [config.enabled, config.pinnedSlugs, allBundles]);

  // Auto-open logic (only pops up once per browser session after a brief delay)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pinnedBundles.length === 0) return;
    if (config.autoPopup === false) return;

    try {
      const alreadySeen = sessionStorage.getItem('vaultzet_viral_popup_seen');
      if (!alreadySeen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          sessionStorage.setItem('vaultzet_viral_popup_seen', 'true');
        }, 2200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [pinnedBundles.length, config.autoPopup]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // If no pinned bundles configured, don't show anything
  if (pinnedBundles.length === 0) {
    return null;
  }

  const handleBuyNowClick = (bundle: BundleProduct) => {
    buyNow(bundle, 'personal');
    setIsOpen(false);
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
      {/* 1. FLOATING ACTION TRIGGER PILL (Visible when modal is closed) */}
      {!isOpen && (
        <aside
          aria-label="Viral Bundles Spotlight"
          className="fixed bottom-20 sm:bottom-6 left-4 z-40 animate-bounce duration-1000"
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950 text-white border border-amber-400/50 hover:border-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.35)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
            aria-label="Open Viral Bundles Spotlight"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <Flame className="w-3.5 h-3.5 fill-slate-950 animate-pulse" />
            </div>

            <div className="text-left flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-amber-300 tracking-tight">
                {popupTitle}
              </span>
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {pinnedBundles.length}
              </span>
            </div>
          </button>
        </aside>
      )}

      {/* 2. VIRAL BUNDLES POPUP MODAL */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="viral-bundles-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
        >
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
          />

          {/* Modal Card */}
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl max-h-[90vh] rounded-[28px] sm:rounded-[36px] bg-gradient-to-b from-slate-950 via-slate-900 to-[#120b22] border border-amber-500/40 text-white shadow-[0_25px_80px_rgba(0,0,0,0.8),0_0_50px_rgba(245,158,11,0.2)] flex flex-col overflow-hidden z-10"
          >
            {/* Top Amber Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.8)]" />

            {/* Header */}
            <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/80 flex items-start justify-between gap-3 relative">
              <div className="space-y-1 pr-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{badgeText}</span>
                </div>

                <h2
                  id="viral-bundles-title"
                  className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2"
                >
                  <span>{popupTitle}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black">
                    {pinnedBundles.length} Packs Pinned
                  </span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  {popupSubtitle}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Scrollable Products List */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
              {pinnedBundles.map((bundle, index) => {
                const origPrice = bundle.personalOriginalPrice || 499;
                const currPrice = bundle.personalPrice || 99;
                const discount =
                  origPrice > currPrice
                    ? Math.round(((origPrice - currPrice) / origPrice) * 100)
                    : 80;

                return (
                  <div
                    key={bundle.id || bundle.slug}
                    className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-amber-500/25 hover:border-amber-400/60 transition-all flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-start sm:items-center justify-between shadow-md group"
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <Link
                        href={`/product/${bundle.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0 block border border-white/10 group-hover:scale-105 transition-transform"
                      >
                        <img
                          src={optimizeImageUrl(bundle.thumbnail, 180, 80)}
                          alt={bundle.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-amber-300 text-[9px] font-black border border-amber-400/40">
                          #{index + 1} TOP
                        </div>
                      </Link>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link
                          href={`/product/${bundle.slug}`}
                          onClick={() => setIsOpen(false)}
                          className="font-bold text-xs sm:text-sm text-white hover:text-amber-400 transition-colors line-clamp-2 block leading-snug"
                        >
                          {bundle.title}
                        </Link>

                        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                            {bundle.reelCount}+ Reels
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" />
                            <span>{bundle.resolution || '1080P'}</span>
                          </span>
                          <span className="text-emerald-400 font-bold">{discount}% OFF</span>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 pt-0.5">
                          <span className="text-sm sm:text-base font-black text-amber-400">
                            ₹{currPrice}
                          </span>
                          {origPrice > currPrice && (
                            <span className="text-xs text-slate-500 line-through">
                              ₹{origPrice}
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-400 font-bold">
                            Instant Drive Access
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleBuyNowClick(bundle)}
                        className="flex-1 sm:flex-none w-full px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Instant Buy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCartClick(bundle)}
                        className="flex-1 sm:flex-none w-full px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-5 border-t border-slate-800/80 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-semibold text-emerald-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Google Drive Access</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Commercial Rights</span>
                </span>
              </div>

              <Link
                href="/shop"
                onClick={() => setIsOpen(false)}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline"
              >
                <span>View All 131 Bundles in Shop</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
