'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  TrendingUp,
  Instagram,
  Package,
} from 'lucide-react';
import {
  GrowthProofsConfig,
  GrowthProofItem,
  getGrowthProofsSync,
  fetchGrowthProofs,
} from '@/lib/proofSettings';
import LightboxModal from './LightboxModal';

interface GrowthProofSectionProps {
  initialConfig?: GrowthProofsConfig;
  className?: string;
  productSlug?: string;
  productId?: string;
  strictProductOnly?: boolean;
  headlineOverride?: string;
  badgeOverride?: string;
  subheadlineOverride?: string;
}

export default function GrowthProofSection({
  initialConfig,
  className = '',
  productSlug,
  productId,
  strictProductOnly = false,
  headlineOverride,
  badgeOverride,
  subheadlineOverride,
}: GrowthProofSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<GrowthProofsConfig>(initialConfig || getGrowthProofsSync());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Drag / Touch tracking
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch updated config on mount & listen to live updates from admin
  useEffect(() => {
    fetchGrowthProofs().then((cfg) => {
      if (cfg) setConfig(cfg);
    });

    const handleUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<GrowthProofsConfig>;
      if (customEvt.detail) {
        setConfig(customEvt.detail);
      }
    };

    window.addEventListener('vaultzet:growth_proofs_updated', handleUpdate);
    return () => window.removeEventListener('vaultzet:growth_proofs_updated', handleUpdate);
  }, []);

  const isProductFiltered = Boolean(productSlug || productId);

  // Filter items based on product scope
  const items = useMemo(() => {
    if (!config.enabled || !config.items || config.items.length === 0) {
      return [];
    }

    if (isProductFiltered) {
      const targetSlug = (productSlug || '').toLowerCase().trim();
      const targetId = String(productId || '').trim();

      const matched = config.items.filter((it) => {
        const itSlug = (it.productSlug || '').toLowerCase().trim();
        const itId = String(it.productId || '').trim();
        return (targetSlug && itSlug === targetSlug) || (targetId && itId === targetId);
      });

      // User requirement: "or dummy screenshot mat lagana jab user lagayega tabhi wo section show ho"
      // If 0 screenshots uploaded for this specific product, return [] so section is hidden!
      return matched;
    }

    // On main Growth Proofs page (/proofs) or home page without filter:
    // User requirement: "or menu ke growth page per saare screenhot show hoen lage"
    return config.items;
  }, [config.enabled, config.items, isProductFiltered, productSlug, productId]);

  const total = items.length;

  // Keep currentIndex bounded
  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, total]);

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Autoplay loop
  useEffect(() => {
    if (!config.enabled || !config.autoplay || isPaused || total <= 1) return;

    autoPlayTimerRef.current = setInterval(() => {
      nextSlide();
    }, config.autoplayInterval || 4000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [config.enabled, config.autoplay, config.autoplayInterval, isPaused, nextSlide, total]);

  // Touch Handlers for smooth mobile finger swipe
  const handleTouchStart = (clientX: number) => {
    if (total <= 1) return;
    setIsDragging(true);
    startXRef.current = clientX;
    currentXRef.current = clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (clientX: number) => {
    if (!isDragging || total <= 1) return;
    currentXRef.current = clientX;
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 40 && total > 1) {
      if (diff < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    setTimeout(() => setIsPaused(false), 2000);
  };

  // If not mounted or section is disabled OR 0 screenshots exist for this scope, return null!
  if (!mounted || !config.enabled || total === 0) {
    return null;
  }

  // Calculate position class for each item relative to currentIndex
  const getSlot = (index: number): 'center' | 'left1' | 'left2' | 'right1' | 'right2' | 'hidden' => {
    if (total === 1) return 'center';
    if (total === 2) {
      return index === currentIndex ? 'center' : 'right1';
    }

    let diff = (index - currentIndex) % total;
    if (diff < 0) diff += total;

    if (diff === 0) return 'center';
    if (diff === 1) return 'right1';
    if (diff === 2) return 'right2';
    if (diff === total - 1) return 'left1';
    if (diff === total - 2) return 'left2';

    return 'hidden';
  };

  const headline =
    headlineOverride ||
    (isProductFiltered
      ? 'Real Growth From This Bundle'
      : config.headline || 'Real Growth By Our Bundle Users');

  const badge = badgeOverride || config.badge || 'REAL GROWTH PROOF';

  const subheadline =
    subheadlineOverride ||
    (isProductFiltered
      ? 'Genuine follower reach & viral stats achieved by creators using this specific reels pack.'
      : config.subheadline ||
        'These creators acquired our bundles, scaled to 100K+ followers, and monetize daily.');

  return (
    <section
      className={`relative w-full py-14 sm:py-20 bg-[#09090b] text-white overflow-hidden select-none [contain:layout_style] ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[650px] h-[350px] sm:h-[650px] bg-purple-600/15 rounded-full blur-[140px] sm:blur-[180px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[280px] h-[280px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-black tracking-widest uppercase mb-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>{badge}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
            {headline}
          </h2>

          <p className="text-xs sm:text-base text-slate-400 mt-3 sm:mt-4 max-w-2xl mx-auto font-normal leading-relaxed">
            {subheadline}
          </p>
        </div>

        {/* 3D Perspective Stage / Coverflow Area */}
        <div
          className="relative w-full h-[480px] sm:h-[560px] md:h-[650px] flex items-center justify-center [perspective:1200px] md:[perspective:1800px] touch-pan-y"
          onTouchStart={(e) => handleTouchStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleTouchMove(e.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={(e) => handleTouchStart(e.clientX)}
          onMouseMove={(e) => handleTouchMove(e.clientX)}
          onMouseUp={handleTouchEnd}
        >
          {/* Centered Phone Radial Glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[420px] h-[280px] sm:h-[420px] rounded-full bg-purple-700/25 blur-[90px] sm:blur-[120px] pointer-events-none" />

          {/* Phone Items Strip */}
          <div className="absolute inset-0 flex items-center justify-center">
            {items.map((item, index) => {
              const slot = getSlot(index);
              const isCenter = slot === 'center';

              // CSS slot transformation classes
              let slotClass = '';
              let zIndex = 1;

              if (slot === 'center') {
                slotClass =
                  'z-30 opacity-100 filter-none cursor-pointer [transform:translate(-50%,-50%)_translateZ(100px)_scale(1)] md:[transform:translate(-50%,-50%)_translateZ(120px)_scale(1)] shadow-[0_30px_90px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.25)] ring-2 ring-purple-500/40';
                zIndex = 30;
              } else if (slot === 'left1') {
                slotClass =
                  'z-20 opacity-75 sm:opacity-85 brightness-90 cursor-pointer [transform:translate(-50%,-50%)_translateX(-115px)_translateZ(20px)_rotateY(20deg)_scale(0.86)] sm:[transform:translate(-50%,-50%)_translateX(-170px)_translateZ(30px)_rotateY(18deg)_scale(0.9)] md:[transform:translate(-50%,-50%)_translateX(-230px)_translateZ(40px)_rotateY(18deg)_scale(0.92)] shadow-2xl';
                zIndex = 20;
              } else if (slot === 'right1') {
                slotClass =
                  'z-20 opacity-75 sm:opacity-85 brightness-90 cursor-pointer [transform:translate(-50%,-50%)_translateX(115px)_translateZ(20px)_rotateY(-20deg)_scale(0.86)] sm:[transform:translate(-50%,-50%)_translateX(170px)_translateZ(30px)_rotateY(-18deg)_scale(0.9)] md:[transform:translate(-50%,-50%)_translateX(230px)_translateZ(40px)_rotateY(-18deg)_scale(0.92)] shadow-2xl';
                zIndex = 20;
              } else if (slot === 'left2') {
                slotClass =
                  'z-10 opacity-30 sm:opacity-55 brightness-75 cursor-pointer [transform:translate(-50%,-50%)_translateX(-190px)_scale(0.72)] sm:[transform:translate(-50%,-50%)_translateX(-280px)_translateZ(-40px)_rotateY(26deg)_scale(0.8)] md:[transform:translate(-50%,-50%)_translateX(-420px)_translateZ(-60px)_rotateY(30deg)_scale(0.82)] shadow-xl';
                zIndex = 10;
              } else if (slot === 'right2') {
                slotClass =
                  'z-10 opacity-30 sm:opacity-55 brightness-75 cursor-pointer [transform:translate(-50%,-50%)_translateX(190px)_scale(0.72)] sm:[transform:translate(-50%,-50%)_translateX(280px)_translateZ(-40px)_rotateY(-26deg)_scale(0.8)] md:[transform:translate(-50%,-50%)_translateX(420px)_translateZ(-60px)_rotateY(-30deg)_scale(0.82)] shadow-xl';
                zIndex = 10;
              } else {
                slotClass =
                  'z-0 opacity-0 pointer-events-none [transform:translate(-50%,-50%)_scale(0.5)]';
                zIndex = 0;
              }

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isCenter) {
                      setIsLightboxOpen(true);
                    } else if (slot === 'left1' || slot === 'left2') {
                      prevSlide();
                    } else if (slot === 'right1' || slot === 'right2') {
                      nextSlide();
                    }
                  }}
                  style={{ zIndex }}
                  className={`absolute left-1/2 top-1/2 w-[225px] h-[450px] sm:w-[265px] sm:h-[530px] md:w-[315px] md:h-[630px] rounded-[24px] sm:rounded-[28px] overflow-hidden bg-slate-900 border border-white/10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${slotClass}`}
                >
                  {/* Smartphone Screen Top Notch Bar */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/60 backdrop-blur-md rounded-full z-20 pointer-events-none flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-2" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                  </div>

                  {/* Main Screenshot Image */}
                  <div className="relative w-full h-full bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title || 'Growth Proof'}
                      loading={isCenter ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover object-top select-none pointer-events-none"
                    />

                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

                    {/* Subtle Glass Inner Border */}
                    <div className="absolute inset-0 rounded-[24px] sm:rounded-[28px] border border-white/15 pointer-events-none" />

                    {/* Tap to Zoom Indicator (Only Center) */}
                    {isCenter && (
                      <div className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 backdrop-blur-md text-white/90 border border-white/20 hover:bg-black/80 transition-transform active:scale-95 shadow-lg">
                        <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300" />
                      </div>
                    )}

                    {/* Creator Info Footer */}
                    <div className="absolute bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-20 text-white">
                      {/* Product Attribution Badge (Shown especially on global /proofs page) */}
                      {item.productTitle && !isProductFiltered && (
                        <div className="mb-1.5">
                          {item.productSlug ? (
                            <Link
                              href={`/product/${item.productSlug}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/25 hover:bg-amber-400/35 text-amber-300 border border-amber-400/40 text-[10px] sm:text-[11px] font-black transition-colors truncate max-w-full"
                              title={`View ${item.productTitle}`}
                            >
                              <Package className="w-3 h-3 text-amber-300 shrink-0" />
                              <span className="truncate">{item.productTitle}</span>
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/25 text-amber-300 border border-amber-400/40 text-[10px] sm:text-[11px] font-black truncate max-w-full">
                              <Package className="w-3 h-3 text-amber-300 shrink-0" />
                              <span className="truncate">{item.productTitle}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {item.tag && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-purple-500/40 mb-1.5">
                          {item.tag}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-white truncate">
                        <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 font-medium mt-1">
                        {item.followers && (
                          <span className="font-extrabold text-amber-400 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                            {item.followers}
                          </span>
                        )}
                        {item.metric && (
                          <span className="text-[11px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {item.metric}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Left Arrow (Visible only if more than 1 item) */}
          {total > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-2 sm:left-6 md:left-12 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/60 hover:bg-purple-600 text-white border border-white/20 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95"
              aria-label="Previous growth proof"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {/* Floating Right Arrow (Visible only if more than 1 item) */}
          {total > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-2 sm:right-6 md:right-12 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/60 hover:bg-purple-600 text-white border border-white/20 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95"
              aria-label="Next growth proof"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>

        {/* Carousel Indicators / Navigation Dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 transition-all rounded-full ${
                  idx === currentIndex
                    ? 'w-8 bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to proof slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Mobile Swipe Hint */}
        {total > 1 && (
          <div className="text-center mt-3 text-xs text-slate-500 md:hidden flex items-center justify-center gap-1.5">
            <span>👈 Swipe left or right to explore proofs 👉</span>
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Modal for High-Res Inspection */}
      <LightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        items={items.map((it) => ({
          id: it.id,
          image: it.image,
          title: it.title,
          subtitle: `${it.followers || ''}${it.followers && it.metric ? ' • ' : ''}${it.metric || ''}${
            it.productTitle ? ` (Product: ${it.productTitle})` : ''
          }`,
          badge: it.tag || 'Growth Proof',
        }))}
        currentIndex={currentIndex}
        onNavigate={setCurrentIndex}
      />
    </section>
  );
}
