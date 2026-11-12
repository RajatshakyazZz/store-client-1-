'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  ShieldCheck,
  FolderOpen,
  CheckCircle2,
  Sparkles,
  Lock,
  ChevronDown,
  Layers,
  Video,
  Clock,
  ArrowRight,
  Flame,
  Star,
  Download,
  AlertTriangle,
  Share2,
  Check,
} from 'lucide-react';
import { ResellerListing, ListingThemePreset } from '@/types/reseller';
import { BundleProduct } from '@/types';
import { useCart } from '@/context/CartContext';
import { track } from '@/lib/analytics';
import WhatsAppButton from '@/components/WhatsAppButton';
import { HARDCODED_SUPPORT_WHATSAPP } from '@/lib/whatsappSupport';

interface ResellerLandingClientProps {
  listing: ResellerListing;
  originalProduct?: BundleProduct;
}

// Theme style configurations
const THEME_STYLES: Record<
  ListingThemePreset,
  {
    bg: string;
    cardBg: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    ctaGradient: string;
    accentGlow: string;
    accentText: string;
  }
> = {
  dark: {
    bg: 'bg-[#0b0819]',
    cardBg: 'bg-[#15102a]/80 backdrop-blur-xl',
    cardBorder: 'border-purple-500/20',
    textPrimary: 'text-white',
    textSecondary: 'text-purple-200/70',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/30',
    ctaGradient: 'from-[#6734f7] via-[#8445f8] to-[#ec288d]',
    accentGlow: 'shadow-[0_0_35px_rgba(103,52,247,0.35)]',
    accentText: 'text-[#a87ffb]',
  },
  midnight: {
    bg: 'bg-[#050a18]',
    cardBg: 'bg-[#0c1630]/80 backdrop-blur-xl',
    cardBorder: 'border-cyan-500/20',
    textPrimary: 'text-white',
    textSecondary: 'text-cyan-200/70',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
    ctaGradient: 'from-cyan-500 via-blue-600 to-indigo-600',
    accentGlow: 'shadow-[0_0_35px_rgba(6,182,212,0.35)]',
    accentText: 'text-cyan-400',
  },
  neon: {
    bg: 'bg-[#09080e]',
    cardBg: 'bg-[#140e1f]/80 backdrop-blur-xl',
    cardBorder: 'border-fuchsia-500/25',
    textPrimary: 'text-white',
    textSecondary: 'text-fuchsia-200/70',
    badgeBg: 'bg-fuchsia-500/10',
    badgeText: 'text-fuchsia-300',
    badgeBorder: 'border-fuchsia-500/30',
    ctaGradient: 'from-fuchsia-500 via-pink-600 to-purple-600',
    accentGlow: 'shadow-[0_0_35px_rgba(217,70,239,0.35)]',
    accentText: 'text-fuchsia-400',
  },
  sunset: {
    bg: 'bg-[#100b0d]',
    cardBg: 'bg-[#1e1217]/80 backdrop-blur-xl',
    cardBorder: 'border-amber-500/25',
    textPrimary: 'text-white',
    textSecondary: 'text-amber-200/70',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    ctaGradient: 'from-amber-500 via-orange-600 to-rose-600',
    accentGlow: 'shadow-[0_0_35px_rgba(245,158,11,0.35)]',
    accentText: 'text-amber-400',
  },
  emerald: {
    bg: 'bg-[#05110d]',
    cardBg: 'bg-[#0a1e17]/80 backdrop-blur-xl',
    cardBorder: 'border-emerald-500/25',
    textPrimary: 'text-white',
    textSecondary: 'text-emerald-200/70',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    ctaGradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    accentGlow: 'shadow-[0_0_35px_rgba(16,185,129,0.35)]',
    accentText: 'text-emerald-400',
  },
  minimal: {
    bg: 'bg-[#0f1115]',
    cardBg: 'bg-[#181b22]/80 backdrop-blur-xl',
    cardBorder: 'border-slate-700/50',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    ctaGradient: 'from-indigo-500 to-violet-600',
    accentGlow: 'shadow-[0_0_30px_rgba(99,102,241,0.3)]',
    accentText: 'text-indigo-400',
  },
};

export default function ResellerLandingClient({
  listing,
  originalProduct,
}: ResellerLandingClientProps) {
  const router = useRouter();
  const { setBuyNowItem } = useCart();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeImage, setActiveImage] = useState<string>(
    listing.coverImage || originalProduct?.thumbnail || (originalProduct as any)?.featuredImage || ''
  );
  const [shareCopied, setShareCopied] = useState(false);

  const themeKey: ListingThemePreset = (listing.themePreset && THEME_STYLES[listing.themePreset])
    ? listing.themePreset
    : 'dark';
  const theme = THEME_STYLES[themeKey];

  // Track page view and unique visitor deduplicated via localStorage
  useEffect(() => {
    if (listing.status !== 'active') return;

    // View content in pixel
    track('view_item', {
      currency: 'INR',
      value: Number(listing.resalePrice),
      items: [
        {
          item_id: listing.id,
          item_name: listing.customTitle,
          price: Number(listing.resalePrice),
          quantity: 1,
        },
      ],
    });

    // Check unique visitor window
    let isUnique = false;
    const storageKey = `vz_visited_r_${listing.slug}`;
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(storageKey)) {
        isUnique = true;
        localStorage.setItem(storageKey, new Date().toISOString());
      }
    }

    // Call server analytics track endpoint
    fetch('/api/reseller/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: listing.slug,
        eventType: 'page_view',
        isUniqueVisitor: isUnique,
      }),
    }).catch(() => {});
  }, [listing]);

  // Handle Buy Now click
  const handleBuyNow = () => {
    if (listing.status !== 'active') return;

    // Track analytics event
    fetch('/api/reseller/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: listing.slug,
        eventType: 'cta_click',
      }),
    }).catch(() => {});

    fetch('/api/reseller/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: listing.slug,
        eventType: 'checkout_initiate',
      }),
    }).catch(() => {});

    track('begin_checkout', {
      currency: 'INR',
      value: Number(listing.resalePrice),
      items: [
        {
          item_id: listing.id,
          item_name: listing.customTitle,
          price: Number(listing.resalePrice),
          quantity: 1,
        },
      ],
    });

    const buyNowPayload = {
      product: {
        id: listing.originalProductId,
        slug: listing.originalProductSlug || listing.slug,
        title: listing.customTitle,
        shortDescription: listing.customShortDescription || '',
        category: originalProduct?.category || 'Reels Bundle',
        categorySlug: originalProduct?.categorySlug || 'reels',
        reelCount: originalProduct?.reelCount || 1000,
        personalPrice: Number(listing.resalePrice),
        personalOriginalPrice: Math.round(Number(listing.resalePrice) * 1.6),
        resellerPrice: Number(listing.resalePrice),
        resellerOriginalPrice: Math.round(Number(listing.resalePrice) * 1.6),
        thumbnail: activeImage || listing.coverImage || originalProduct?.thumbnail || '',
        galleryImages: listing.galleryImages && listing.galleryImages.length > 0
          ? listing.galleryImages
          : originalProduct?.galleryImages || [],
        resolution: '1080x1920 (9:16 Vertical)',
        aspectRatio: '9:16',
        format: 'MP4',
        audioIncluded: true,
        tags: originalProduct?.tags || [],
        rating: 4.9,
        reviewCount: 340,
        features: listing.features && listing.features.length > 0 ? listing.features : originalProduct?.features || [],
        faqs: originalProduct?.faqs || [],
      },
      license: 'personal' as const,
      price: Number(listing.resalePrice),
    };

    // 1. Immediately update CartContext state
    setBuyNowItem(buyNowPayload as any);

    // 2. Persist in storage for seamless cross-navigation and hard refresh
    try {
      sessionStorage.setItem('vaultzet_buynow_item', JSON.stringify(buyNowPayload));
      localStorage.setItem('vaultzet_buynow_item', JSON.stringify(buyNowPayload));
      sessionStorage.setItem('vaultzet_reseller_slug', listing.slug);
      localStorage.setItem('vaultzet_reseller_slug', listing.slug);
      sessionStorage.setItem('vaultzet_reseller_listing', JSON.stringify(listing));
      localStorage.setItem('vaultzet_reseller_listing', JSON.stringify(listing));
    } catch {}

    router.push(`/checkout?r=${listing.slug}&mode=buynow`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.customTitle,
          text: listing.customHeadline || listing.customTitle,
          url,
        });
        return;
      } catch {}
    }
    // Fallback: clipboard
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // If listing is paused, suspended, or rejected: display dedicated paused UI
  if (listing.status !== 'active') {
    return (
      <div className={`min-h-screen ${theme.bg} text-white flex items-center justify-center p-4`}>
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black">Listing Temporarily Paused</h1>
            <p className="text-xs text-white/60 mt-1 font-medium">
              This product listing is currently {listing.status} by the reseller and cannot accept new orders at this time.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-1">
            <p className="font-bold text-white/80">{listing.customTitle}</p>
            <p className="text-white/50 text-[11px]">Reseller: {listing.resellerName}</p>
          </div>
          <Link
            href="/shop"
            className="block w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            Browse Store Catalog
          </Link>
        </div>
      </div>
    );
  }

  const galleryList = [
    ...(listing.coverImage ? [listing.coverImage] : []),
    ...(listing.galleryImages || []),
    ...(originalProduct?.galleryImages || []),
  ].filter((img, idx, arr) => img && arr.indexOf(img) === idx);

  const benefitsList = listing.benefits && listing.benefits.length > 0
    ? listing.benefits
    : [
        'Instant Google Drive Access directly after checkout',
        '1080x1920 Full HD Vertical Format for Reels & Shorts',
        'Trending Background Audios & Soundtracks Included',
        'Zero Watermarks — 100% Commercial-Ready',
        'Lifetime Cloud Download & Future Updates Included',
      ];

  const featuresList = listing.features && listing.features.length > 0
    ? listing.features
    : originalProduct?.features || [
        'Over 1,000+ viral reel concepts in high definition',
        'Category organized folders for effortless posting',
        'Fully compatible with CapCut, Premiere, InShot & Canva',
        'Optimized for Instagram, YouTube Shorts, and Facebook',
      ];

  const faqs = originalProduct?.faqs || [
    {
      question: 'How do I receive the bundle after payment?',
      answer: 'Delivery is 100% instant and automated. Immediately upon successful payment verification, you receive lifetime access to a private Google Drive folder with all watermark-free vertical MP4 videos.',
    },
    {
      question: 'Do these reels have any logos or watermarks?',
      answer: 'No. All videos are 100% clean, watermark-free, and rendered in high definition 1080x1920 9:16 vertical video ready for Instagram Reels, YouTube Shorts, and Facebook.',
    },
    {
      question: 'Can I monetize pages using these reels?',
      answer: 'Yes! You have full commercial rights to edit, brand, post, and monetize these reels across all your social media channels.',
    },
  ];

  const originalPriceCalculated = Math.round(Number(listing.resalePrice) * 1.6);
  const savingsCalculated = originalPriceCalculated - Number(listing.resalePrice);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textPrimary} relative selection:bg-purple-500/30 selection:text-white pb-24 md:pb-12`}>
      {/* Background ambient decorative blurs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-pink-600/10 blur-[140px]" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-64 rounded-full bg-blue-600/10 blur-[150px]" />
      </div>

      {/* Top Banner Notice */}
      <div className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md px-4 py-2.5 text-center">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-white/80 font-bold text-[11px] sm:text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>⚡ Instant Automated Delivery via Google Drive</span>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all"
          >
            {shareCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-12">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Visuals & Gallery */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`relative rounded-3xl overflow-hidden border ${theme.cardBorder} ${theme.cardBg} ${theme.accentGlow} aspect-[9/12] max-h-[500px] mx-auto w-full group shadow-2xl`}>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={listing.customTitle}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900/60">
                  <Video className="w-16 h-16 text-white/30" />
                </div>
              )}

              {/* Promo Badge Tag */}
              {listing.promoBadge && (
                <div className="absolute top-4 left-4 z-20">
                  <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-black shadow-lg uppercase tracking-wider flex items-center gap-1.5 border border-white/20">
                    <Flame className="w-3.5 h-3.5 fill-current animate-pulse" />
                    <span>{listing.promoBadge}</span>
                  </span>
                </div>
              )}

              {/* Format Overlay */}
              <div className="absolute bottom-4 left-4 right-4 z-20 p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-white/90">
                  <Video className="w-3.5 h-3.5 text-purple-400" />
                  <span>1080x1920 Full HD</span>
                </span>
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>No Watermark</span>
                </span>
              </div>
            </div>

            {/* Gallery Thumbnails (if multiple images) */}
            {galleryList.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 justify-center sm:justify-start">
                {galleryList.slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      activeImage === img
                        ? 'border-purple-400 scale-105 shadow-md'
                        : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Copy, Pricing & Buy CTA */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header info */}
            <div className="space-y-3">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-white/10 bg-white/5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className={theme.accentText}>{listing.customSubtitle || 'Ready-to-Post HD Reels Bundle'}</span>
              </div>

              {/* Custom Title */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                {listing.customTitle}
              </h1>

              {/* Marketing Headline */}
              {listing.customHeadline && (
                <p className={`text-sm sm:text-base ${theme.textSecondary} font-medium leading-relaxed`}>
                  {listing.customHeadline}
                </p>
              )}

              {/* Ratings and Social Proof */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-white/70 pt-1">
                <div className="flex items-center gap-1 text-amber-400">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="font-bold text-white ml-1">4.9/5</span>
                  <span className="text-white/50">(340+ verified creators)</span>
                </div>
                <span>•</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Download className="w-3 h-3" /> 1,280+ Downloads
                </span>
              </div>
            </div>

            {/* Pricing Box */}
            <div className={`p-6 sm:p-7 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} space-y-5 shadow-xl`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/50 font-extrabold block">
                    Special Offer Price
                  </span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      ₹{listing.resalePrice}
                    </span>
                    <span className="text-base sm:text-lg text-white/40 line-through font-bold">
                      ₹{originalPriceCalculated}
                    </span>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
                  Save ₹{savingsCalculated} (60% OFF)
                </div>
              </div>

              {/* Primary Buy Now CTA */}
              <button
                onClick={handleBuyNow}
                className={`w-full py-4 sm:py-4.5 px-6 rounded-2xl bg-gradient-to-r ${theme.ctaGradient} text-white text-base sm:text-lg font-black flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform group`}
              >
                <Zap className="w-5 h-5 fill-current text-amber-300" />
                <span>{listing.ctaText || 'Download HD Bundle Now'}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Guarantees list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-white/70 pt-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span>Google Drive Access</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-Bit SSL Checkout</span>
                </span>
                <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Lifetime Updates</span>
                </span>
              </div>
            </div>

            {/* Benefits Checklist */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white/60">
                What&apos;s Included In This Bundle:
              </h3>
              <div className="space-y-2">
                {benefitsList.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-white/90 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Short & Detailed Description */}
        {(listing.customShortDescription || listing.customDescription) && (
          <div className={`p-6 sm:p-8 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} space-y-4`}>
            <h2 className="text-lg sm:text-xl font-black">About This Reels Collection</h2>
            {listing.customShortDescription && (
              <p className={`text-sm ${theme.textSecondary} leading-relaxed font-medium`}>
                {listing.customShortDescription}
              </p>
            )}
            {listing.customDescription && (
              <div className="text-xs sm:text-sm text-white/70 leading-relaxed space-y-3 pt-2 whitespace-pre-line border-t border-white/5">
                {listing.customDescription}
              </div>
            )}
          </div>
        )}

        {/* Feature Cards Grid */}
        {featuresList.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black">Bundle Highlights & Capabilities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuresList.map((feature, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} space-y-2`}
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-black text-xs">
                    {idx + 1}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white/90 leading-snug">
                    {feature}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instant Automated Delivery Breakdown */}
        <div className={`p-6 sm:p-8 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} space-y-4`}>
          <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>How Automated Delivery Works</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-purple-400">Step 1</span>
              <h4 className="text-xs font-black">Complete Secure Checkout</h4>
              <p className="text-[11px] text-white/60">Pay seamlessly using UPI (Google Pay, PhonePe, Paytm), Cards, or NetBanking.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-purple-400">Step 2</span>
              <h4 className="text-xs font-black">Instant Link Access</h4>
              <p className="text-[11px] text-white/60">Directly after payment, your unique Google Drive access link opens on screen and is delivered to your email.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-purple-400">Step 3</span>
              <h4 className="text-xs font-black">Download & Post</h4>
              <p className="text-[11px] text-white/60">Save to your phone or computer and start scheduling reels across all social media platforms immediately.</p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className={`p-6 sm:p-8 rounded-3xl border ${theme.cardBorder} ${theme.cardBg} space-y-4`}>
          <h2 className="text-lg sm:text-xl font-black">Frequently Asked Questions</h2>
          <div className="divide-y divide-white/5">
            {faqs.map((faq, i) => (
              <div key={i} className="py-3">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-bold gap-3"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-white/50 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <p className="text-xs text-white/60 leading-relaxed mt-2 pt-1 font-medium">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Seller Disclosure & Legal Safeguard */}
        <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] text-center text-[11px] text-white/50 space-y-1 max-w-2xl mx-auto">
          <p className="font-semibold text-white/70">
            Authorized Reseller Listing • Powered by VaultWorld Digital Storefront
          </p>
          <p>
            Payments are securely processed via certified PayU India Payment Gateway with 256-bit SSL encryption.
            Digital files are delivered instantly via automated cloud infrastructure.
          </p>
        </div>
      </main>

      {/* Floating Mobile Sticky Purchase Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-black/90 backdrop-blur-xl border-t border-white/10 md:hidden flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <span className="text-[10px] text-white/50 block font-bold">Total Price</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-white">₹{listing.resalePrice}</span>
            <span className="text-xs text-white/40 line-through">₹{originalPriceCalculated}</span>
          </div>
        </div>

        <button
          onClick={handleBuyNow}
          className={`px-6 py-3 rounded-xl bg-gradient-to-r ${theme.ctaGradient} text-white text-xs font-black flex items-center gap-2 shadow-lg active:scale-95 transition-transform`}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>{listing.ctaText || 'Download Now'}</span>
        </button>
      </div>

      {/* Floating WhatsApp Support Button (Controlled by Reseller's Landing Page Setting) */}
      {listing.whatsappButtonEnabled !== false && (
        <WhatsAppButton
          isResellerPage={true}
          phoneNumber={listing.whatsappNumber || HARDCODED_SUPPORT_WHATSAPP}
          storeName={listing.resellerName ? `${listing.resellerName} • VaultWorld Partner` : 'VaultWorld Support'}
          productTitle={listing.customTitle}
          defaultMessage={`Hi! I am browsing "${listing.customTitle}" on VaultWorld. Can you please assist me?`}
          positionClassName="bottom-20 md:bottom-6 right-4 sm:right-6"
        />
      )}
    </div>
  );
}
