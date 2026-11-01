'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingCart, Film } from 'lucide-react';
import { BUNDLE_PRODUCTS } from '@/data/bundles';
import { useCart } from '@/context/CartContext';
import { optimizeImageUrl } from '@/lib/imageOptimized';
import {
  fetchCustomProducts,
  getAllCatalogBundles,
  getLocalCustomProductsSync,
  isDemoOrInvalidBundle,
} from '@/lib/customProducts';
import { BundleProduct } from '@/types';

export default function FreshReelsGrid() {
  const { addToCart, buyNow } = useCart();
  const [freshBundles, setFreshBundles] = useState<BundleProduct[]>(() => {
    return BUNDLE_PRODUCTS.filter((b) => !b.isUpcoming && !isDemoOrInvalidBundle(b)).slice(0, 8);
  });

  useEffect(() => {
    const loadBundles = () => {
      const local = getLocalCustomProductsSync();
      if (local && local.length > 0) {
        const all = getAllCatalogBundles(local, BUNDLE_PRODUCTS);
        setFreshBundles(all.filter((b) => !b.isUpcoming && !isDemoOrInvalidBundle(b)).slice(0, 8));
      }

      fetchCustomProducts().then((res) => {
        const all = getAllCatalogBundles(res, BUNDLE_PRODUCTS);
        setFreshBundles(all.filter((b) => !b.isUpcoming && !isDemoOrInvalidBundle(b)).slice(0, 8));
      }).catch(() => {});
    };

    loadBundles();

    const handlePinnedUpdate = () => {
      loadBundles();
    };

    window.addEventListener('vaultzet:homepage_pinned_updated', handlePinnedUpdate);
    return () => window.removeEventListener('vaultzet:homepage_pinned_updated', handlePinnedUpdate);
  }, []);

  return (
    <section className="py-6 sm:py-8 [contain:layout_style]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Outer Section Card Wrapper */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-slate-50 border border-slate-200/90 p-4 sm:p-6 space-y-6 shadow-sm">
          
          {/* Midnight Slate & Royal Gold Header Banner */}
          <div className="rounded-[20px] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_10px_28px_rgba(2,6,23,0.35)] border border-amber-500/30">
            <div className="flex items-center gap-3">
              {/* Amber gold bar indicator on left */}
              <div className="w-[5px] h-10 bg-amber-400 rounded-full shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight flex items-center gap-2">
                  <span>Fresh Reels, Ready to Post</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold hidden sm:inline-block">NEW DROP</span>
                </h2>
                <p className="text-xs sm:text-[13px] text-slate-300 font-medium mt-0.5">
                  Freshly curated reels bundles to keep your posting schedule consistent and viral.
                </p>
              </div>
            </div>

            <Link
              href="/shop"
              prefetch={false}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>View All Catalog</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
            </Link>
          </div>

          {/* Product Cards Grid: 2 columns on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
            {freshBundles.map((bundle) => {
              const origPrice = bundle.personalOriginalPrice || 499;
              const currPrice = bundle.personalPrice || 99;
              const discount =
                origPrice > currPrice
                  ? Math.round(((origPrice - currPrice) / origPrice) * 100)
                  : 80;

              const isTrending =
                (Array.isArray(bundle.tags) && bundle.tags.includes('TRENDING')) ||
                bundle.isTrending;

              return (
                <div
                  key={bundle.id}
                  className="bg-white rounded-2xl sm:rounded-[24px] border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-amber-400/60 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group"
                >
                  {/* Thumbnail */}
                  <Link
                    href={`/product/${bundle.slug}`}
                    prefetch={false}
                    className="relative aspect-[4/3] overflow-hidden bg-slate-900 block"
                  >
                    <img
                      src={optimizeImageUrl(bundle.thumbnail, 384, 75)}
                      alt={bundle.title}
                      width={384}
                      height={288}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Corner Ribbon */}
                    <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 sm:w-24 sm:h-24 pointer-events-none">
                      {bundle.isHomepageTop ? (
                        <div className="absolute transform rotate-45 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[7px] sm:text-[8.5px] py-0.5 sm:py-1 right-[-34px] sm:right-[-32px] top-[14px] sm:top-[18px] w-[110px] sm:w-[120px] text-center shadow-lg flex items-center justify-center gap-0.5 border-y border-amber-300">
                          <span>⭐</span>
                          <span>TOP PICK</span>
                        </div>
                      ) : isTrending ? (
                        <div className="absolute transform rotate-45 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[7px] sm:text-[8px] py-0.5 sm:py-1 right-[-34px] sm:right-[-32px] top-[14px] sm:top-[18px] w-[110px] sm:w-[120px] text-center shadow-md flex items-center justify-center gap-0.5">
                          <span>👑</span>
                          <span>TRENDING</span>
                        </div>
                      ) : (
                        <div className="absolute transform rotate-45 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-[7.5px] sm:text-[9px] py-0.5 sm:py-1 right-[-34px] sm:right-[-32px] top-[14px] sm:top-[18px] w-[110px] sm:w-[120px] text-center shadow-md flex items-center justify-center gap-0.5">
                          <span>🔥</span>
                          <span>HOT</span>
                        </div>
                      )}
                    </div>

                    {/* 1080P Badge in Bottom Right with green dot */}
                    <span className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 px-1.5 py-0.5 sm:px-2 rounded-md text-[9px] sm:text-[10px] font-black bg-black/80 text-white backdrop-blur-md border border-white/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{String(bundle.resolution || '').includes('1080') ? '1080P' : 'HD'}</span>
                    </span>
                  </Link>

                  {/* Body */}
                  <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2 sm:space-y-3.5">
                    <div className="space-y-1.5 sm:space-y-2">
                      <Link href={`/product/${bundle.slug}`} prefetch={false}>
                        <h3 className="font-extrabold text-xs sm:text-[14px] text-slate-900 hover:text-amber-600 transition-colors line-clamp-2 leading-snug min-h-[32px] sm:min-h-[40px]">
                          {bundle.title}
                        </h3>
                      </Link>

                      {/* Meta Pills */}
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <span className="px-1.5 sm:px-2.5 py-0.5 rounded-md text-[9px] sm:text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-200/50">
                          {bundle.reelCount}+ Reels
                        </span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 flex items-center gap-0.5">
                          <Film className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span>MP4</span>
                        </span>
                      </div>
                    </div>

                    {/* Pricing & Buttons */}
                    <div className="pt-2 border-t border-slate-100 space-y-2 sm:space-y-2.5">
                      <div className="flex items-baseline justify-between gap-1 flex-wrap">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] sm:text-xs text-slate-400 line-through font-semibold">
                            ₹{bundle.personalOriginalPrice}.00
                          </span>
                          <span className="text-sm sm:text-xl font-black text-slate-950">
                            ₹{bundle.personalPrice}.00
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          {discount}% OFF
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => addToCart(bundle, 'personal')}
                          className="py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">Add to Cart</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => buyNow(bundle, 'personal')}
                          className="py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-[10px] sm:text-xs flex items-center justify-center gap-1 shadow-md shadow-amber-500/25 active:scale-95 transition-all"
                        >
                          <span className="truncate">Buy Now</span>
                          <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5] shrink-0" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}
