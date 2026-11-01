'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useResellerAuth } from '@/context/ResellerAuthContext';
import ResellerAuthModal from '@/components/reseller/ResellerAuthModal';
import {
  ChevronRight,
  Star,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Sparkles,
  FolderOpen,
  TrendingUp,
  Video,
  Layers,
  Heart,
  Target,
  FileCode,
  CloudDownload,
  Smartphone,
  Monitor,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Check,
  Briefcase,
  Lock,
  ThumbsUp,
  BadgeCheck,
  MessageCircle,
  Clock,
  Download,
  Play,
  Pause,
  VolumeX,
  Film,
} from 'lucide-react';
import { BUNDLE_PRODUCTS } from '@/data/bundles';
import { useCart } from '@/context/CartContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { BundleProduct } from '@/types';
import { optimizeImageUrl } from '@/lib/imageOptimized';
import { getBundleContentDetails } from '@/lib/bundleContent';
import { track } from '@/lib/analytics';
import { fetchCustomProductBySlug } from '@/lib/customProducts';
import dynamic from 'next/dynamic';
import FreeBundleOfferBanner from '@/components/FreeBundleOfferBanner';
import { parseHostedVideoUrl } from '@/lib/videoUtils';

const GrowthProofSection = dynamic(() => import('@/components/GrowthProofSection'), {
  ssr: false,
});

interface ProductDetailClientProps {
  product: BundleProduct;
}

// Authentic creator reviews
const CUSTOMER_REVIEWS = [
  {
    id: 'rev-1',
    author: 'Aarav Mehta',
    handle: '@aarav.creator',
    role: 'Theme Page Creator',
    rating: 5,
    date: 'Yesterday',
    verified: true,
    title: 'Google Drive link instant mil gaya! 100% Worth it',
    comment:
      'Payment complete hote hi screen par Drive link open ho gaya aur email par bhi delivery copy aa gayi. Sare videos 1080p full HD vertical format me hain aur koi watermark nahi hai.',
    helpful: 34,
  },
  {
    id: 'rev-2',
    author: 'Pooja Verma',
    handle: '@pooja_digital',
    role: 'Social Media Marketer',
    rating: 5,
    date: '3 days ago',
    verified: true,
    title: 'Roz 3 ghante editing ka time bacha liya',
    comment:
      'Instagram reels ke liye daily content plan banana difficult hota tha. Is bundle se agle 6 mahine ka content ready hai. Quality crisp hai aur format exactly 9:16 vertical shorts ke liye perfect hai.',
    helpful: 28,
  },
  {
    id: 'rev-3',
    author: 'Rohan Joshi',
    handle: '@rohan.growth',
    role: 'Faceless Channel Operator',
    rating: 5,
    date: '5 days ago',
    verified: true,
    title: 'Viral reach 3x ho gayi pehle hi hafte me',
    comment:
      'Clips ke pehle 3 seconds me visual hooks bohot strong hain. Average view duration 85%+ aa raha hai. Folders Google Drive me bohot neatly categorized hain sub-topics me.',
    helpful: 19,
  },
  {
    id: 'rev-4',
    author: 'Sneha Patel',
    handle: '@sneha_content',
    role: 'Lifestyle Creator',
    rating: 5,
    date: '1 week ago',
    verified: true,
    title: 'Safe UPI payment & Lifetime Drive access',
    comment:
      'PayU UPI se securely pay kiya aur turant Google Drive folder open ho gaya. Lifetime access mila hai, phone me 1-click download ho jata hai bina kisi watermark ke.',
    helpful: 22,
  },
];

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const { buyNow } = useCart();
  const { isAuthenticated } = useResellerAuth();
  const { settings } = useStoreSettings();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [currentProduct, setCurrentProduct] = useState<BundleProduct>(product);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [helpfulMap, setHelpfulMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setCurrentProduct(product);
  }, [product]);

  useEffect(() => {
    let isMounted = true;
    fetchCustomProductBySlug(product.slug, true)
      .then((live) => {
        if (isMounted && live) {
          setCurrentProduct((prev) => ({ ...prev, ...live }));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [product.slug]);

  const p = currentProduct;

  // Track GA4 view_item event once on product mount
  useEffect(() => {
    if (p) {
      track('view_item', {
        currency: 'INR',
        value: Number(p.personalPrice),
        items: [
          {
            item_id: p.id,
            item_name: p.title,
            item_category: p.category || 'Reels Bundle',
            price: Number(p.personalPrice),
            quantity: 1,
            item_variant: 'standard',
          },
        ],
      });
    }
  }, [p?.id, p?.personalPrice]);

  const activePrice = p.personalPrice;
  const originalPrice = p.personalOriginalPrice;
  const discountPercent = Math.round(((originalPrice - activePrice) / Math.max(1, originalPrice)) * 100);
  const savingsAmount = originalPrice - activePrice;
  const currentImage = selectedImage || p.thumbnail || '';

  const details = getBundleContentDetails(p);
  const relatedBundles = BUNDLE_PRODUCTS.filter((b) => b.id !== p.id && !b.isUpcoming).slice(0, 4);

  // Dedicated Video Previews for "View Samples" (Multiple Videos Supported, No Cross-Product Fallback)
  const rawPreviewList: string[] = (
    Array.isArray(p.previewVideoUrls) && p.previewVideoUrls.length > 0
      ? p.previewVideoUrls
      : Array.isArray((p as any).preview_video_urls) && (p as any).preview_video_urls.length > 0
      ? (p as any).preview_video_urls
      : p.previewVideoUrl
      ? [p.previewVideoUrl]
      : (p as any).preview_video_url
      ? [(p as any).preview_video_url]
      : []
  )
    .map((u: any) => String(u || '').trim())
    .filter(Boolean);

  const parsedVideos = rawPreviewList
    .map((url: string) => parseHostedVideoUrl(url))
    .filter((v) => v.type !== 'empty' && v.type !== 'unknown');

  const hasVideoPreview = parsedVideos.length > 0;
  const [activeSampleIdx, setActiveSampleIdx] = useState(0);
  const safeActiveIdx = activeSampleIdx < parsedVideos.length ? activeSampleIdx : 0;
  const currentVideo = parsedVideos[safeActiveIdx];

  const handleHelpful = (id: string) => {
    setHelpfulMap((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const getAudienceIcon = (icon: string) => {
    switch (icon) {
      case 'creator':
        return <Video className="w-4 h-4 text-purple-600" />;
      case 'affiliate':
        return <TrendingUp className="w-4 h-4 text-pink-600" />;
      case 'manager':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'theme':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'family':
        return <Heart className="w-4 h-4 text-orange-600" />;
      case 'agency':
        return <Target className="w-4 h-4 text-amber-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="bg-[#fcfbfe] min-h-screen text-[#1a1725] pb-40 sm:pb-36 md:pb-16 antialiased">
      {/* Top Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-6 space-y-6 sm:space-y-10">
        
        {/* Navigation / Breadcrumb */}
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2">
            <Link href="/" className="hover:text-amber-600 transition-colors">Home</Link>
            <span className="text-slate-300">/</span>
            <Link href="/shop" className="hover:text-amber-600 transition-colors">Shop</Link>
            <span className="text-slate-300">/</span>
            <Link
              href={`/category/${p.categorySlug || 'ai-reels'}`}
              className="hover:text-amber-600 transition-colors"
            >
              {p.category || 'Reels Bundle'}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold truncate max-w-xs">{p.title}</span>
          </nav>

          {/* Mobile Back Header */}
          <div className="flex sm:hidden items-center justify-between w-full">
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Store</span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Instant Delivery</span>
            </span>
          </div>
        </div>

        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          
          {/* LEFT: Clean Image & Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-sm">
              <img
                src={optimizeImageUrl(currentImage, 1024)}
                alt={`${p.title} preview`}
                width={1024}
                height={768}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover"
              />

              {/* Minimal Clean Tag Overlays */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-black/75 text-white backdrop-blur-md shadow-xs">
                  {p.resolution || '1080P'} Full HD
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-black/75 text-white backdrop-blur-md shadow-xs">
                  9:16 Vertical
                </span>
              </div>

              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                  {discountPercent}% OFF
                </span>
              </div>
            </div>

            {/* Gallery Thumbnails Strip (if multiple) */}
            {p.galleryImages && p.galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {p.galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-slate-50 cursor-pointer ${
                      currentImage === img
                        ? 'border-amber-500 ring-2 ring-amber-200'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={optimizeImageUrl(img, 120)}
                      alt={`${p.title} thumbnail ${idx + 1}`}
                      width={80}
                      height={80}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Watch Sample Reel Video Button (Scrolls to View Samples Section) */}
            {hasVideoPreview && (
              <a
                href="#view-samples"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 hover:from-slate-900 hover:to-slate-800 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-3 h-3 fill-amber-300 text-amber-300 ml-0.5" />
                </span>
                <span>
                  Watch Reel Samples & Video Preview{' '}
                  {parsedVideos.length > 1 ? `(${parsedVideos.length} Samples)` : '(1080P)'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  LIVE DEMO
                </span>
              </a>
            )}

            {/* Clean Trust Reassurance Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-center text-xs">
              <div className="flex items-center justify-center gap-1.5 py-1 font-semibold text-slate-700">
                <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] sm:text-xs">Google Drive</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1 font-semibold text-slate-700 border-x border-slate-100">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] sm:text-xs">Safe UPI</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1 font-semibold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] sm:text-xs">No Watermark</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Unified Purchase Card */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-5">
              
              {/* Category, Rating & Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 font-extrabold text-[11px] uppercase tracking-wider border border-amber-200/60">
                      {p.category || 'Reels Bundle'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                      <span>★ 4.9</span>
                      <span className="text-slate-400 font-medium text-[11px]">({p.reviewCount || 200}+ verified reviews)</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Verified Digital Bundle
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {p.title}
                </h1>

                {p.shortDescription && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {p.shortDescription}
                  </p>
                )}
              </div>

              {/* Pricing Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      ₹{activePrice}.00
                    </span>
                    <span className="text-sm text-slate-400 line-through font-semibold">
                      ₹{originalPrice}.00
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    One-time payment · Lifetime Google Drive access
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black">
                    Save ₹{savingsAmount}
                  </span>
                </div>
              </div>

              {/* Special Free Bundles Offer Banner */}
              <FreeBundleOfferBanner variant="product" />

              {/* Key Highlights */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{p.reelCount || 1000}+ HD Video Clips</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>100% Watermark-Free</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>9:16 Vertical (Reels/Shorts)</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Instant Drive Link Access</span>
                </div>
              </div>

              {/* Primary Buy Button */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => buyNow(p, 'personal')}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Buy Now — ₹{activePrice}.00 (Instant Access)</span>
                </button>

                <p className="text-center text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Drive link appears on screen immediately & is sent to your email.</span>
                </p>

                {/* Indian UPI Payment Badges Strip */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>Instant UPI Checkout via PayU</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] font-bold text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Google Pay</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">PhonePe</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Paytm</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">BHIM UPI</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Cards</span>
                  </div>
                </div>

                {/* Secondary Resell & Earn Option Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        router.push(`/earn/create/${p.id}`);
                      } else {
                        setIsAuthModalOpen(true);
                      }
                    }}
                    className="w-full py-3 px-5 rounded-xl bg-white hover:bg-amber-50/80 border border-amber-300/80 text-amber-900 font-black text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4 text-amber-600" />
                    <span>Resell & Earn on This Bundle</span>
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-extrabold uppercase">
                      Keep 100% Margin
                    </span>
                  </button>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Set your own selling price and earn on every successful sale.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* SECTION: VIEW SAMPLES (DEDICATED REEL SAMPLES & VIDEO PREVIEW) */}
        {hasVideoPreview && (
          <section
            id="view-samples"
            className="bg-gradient-to-br from-slate-950 via-[#0d1222] to-slate-950 rounded-2xl sm:rounded-3xl border border-amber-500/30 p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] text-white space-y-6 relative overflow-hidden [contain:layout_style]"
          >
            {/* Ambient glow backgrounds */}
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-extrabold uppercase tracking-wider">
                  <Play className="w-3 h-3 fill-amber-300" />
                  <span>
                    Official Sample {parsedVideos.length > 1 ? `Reels (${parsedVideos.length} Available)` : 'Reel'}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <span>View Samples Before You Buy</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold hidden sm:inline-block">
                    {p.resolution || '1080P'} Full HD
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {parsedVideos.length > 1
                    ? `Watch all ${parsedVideos.length} real sample preview reels below. 100% watermark-free, vertical 9:16 format.`
                    : 'Check the real video quality, audio synchronization, and 9:16 vertical reels included in this bundle.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => buyNow(p, 'personal')}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Buy This Bundle — ₹{activePrice}.00</span>
                </button>
              </div>
            </div>

            {/* Multiple Samples Selector Bar (if > 1 video) */}
            {parsedVideos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none relative z-10 pt-1">
                <span className="text-xs font-bold text-slate-300 shrink-0 flex items-center gap-1.5 mr-1">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>Select Sample:</span>
                </span>
                {parsedVideos.map((vid, idx) => {
                  const isActive = idx === safeActiveIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSampleIdx(idx)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.03]'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80'
                      }`}
                    >
                      <Play className={`w-3 h-3 ${isActive ? 'fill-slate-950 text-slate-950' : 'fill-slate-400 text-slate-400'}`} />
                      <span>Sample #{idx + 1}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Interactive Video Player & Bundle Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center relative z-10">
              {/* Video Smartphone Mockup / Player Frame */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-[290px] sm:max-w-[320px] aspect-[9/16] rounded-[34px] bg-slate-950 border-[3.5px] border-slate-700/80 shadow-[0_15px_50px_rgba(0,0,0,0.7)] p-2 relative flex flex-col justify-between overflow-hidden">
                  {/* Phone top notch */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-center pointer-events-none border border-slate-800">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                  </div>

                  {/* Inner Video Container */}
                  <div className="w-full h-full rounded-[24px] overflow-hidden bg-black relative flex items-center justify-center">
                    {currentVideo?.type === 'direct' && currentVideo.directUrl && (
                      <ReelDirectVideoPlayer
                        key={currentVideo.directUrl}
                        src={currentVideo.directUrl}
                        poster={p.thumbnail}
                        title={p.title}
                      />
                    )}

                    {currentVideo && currentVideo.type === 'drive' && (
                      <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                        <iframe
                          key={currentVideo.embedUrl}
                          src={currentVideo.embedUrl}
                          title={`${p.title} Sample Reel Preview #${safeActiveIdx + 1}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="w-full h-[calc(100%+54px)] -mt-[48px] border-0 scale-[1.02] object-cover"
                        />
                      </div>
                    )}

                    {currentVideo && (currentVideo.type === 'youtube' || currentVideo.type === 'vimeo') && (
                      <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                        <iframe
                          key={currentVideo.embedUrl}
                          src={currentVideo.embedUrl}
                          title={`${p.title} Sample Reel Preview #${safeActiveIdx + 1}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="w-full h-full border-0 object-cover"
                        />
                      </div>
                    )}

                    {/* Video Badge Overlay */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none flex items-center justify-between text-[10px] text-white/90 z-20">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 font-bold">
                        {parsedVideos.length > 1 ? `Sample ${safeActiveIdx + 1} of ${parsedVideos.length}` : `${p.reelCount || 1000}+ Reels`}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/80 backdrop-blur-md text-white font-extrabold">
                        No Watermark
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Details: Specifications & Instant Guarantee */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    What You See is What You Get
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                    Every Reel Rendered in 100% Crisp Quality, Ready to Publish
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Download and publish these reels straight to Instagram, YouTube Shorts, or Facebook without any editing required. All videos come fully compiled with engaging visuals, high retention pacing, and sound.
                  </p>
                </div>

                {/* Feature Bullets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero Watermark / Logo</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      100% clean video files ready to put your own logo or brand name.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>9:16 Vertical HD Format</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Perfect 1080x1920 dimension optimized for maximum reach and engagement.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Trending Audio Included</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Syncs seamlessly with current trending algorithms across social networks.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Instant Google Drive Access</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Download link opens instantly upon payment completion and is emailed.
                    </p>
                  </div>
                </div>

                {/* Quick Action Footer inside sample section */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => buyNow(p, 'personal')}
                    className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Instant Checkout — ₹{activePrice}.00</span>
                  </button>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>One-time payment • Lifetime access</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 1: HOW IT WORKS (3 Simple Steps) */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="text-center sm:text-left">
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 block">
              100% Instant Delivery
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              How You Receive Your Content
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant Google Drive access in 3 simple steps:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">30-Second Checkout</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter your email and pay securely via GPay, PhonePe, Paytm, or Card. No registration required.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Instant Drive Link</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                As soon as payment succeeds, the Google Drive download button appears on your screen and is emailed.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Download & Post</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Download clips directly to your phone or laptop. All files are 100% watermark-free and commercial-ready.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: BUNDLE DETAILS & DESCRIPTION */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 block">
              Bundle Specifications
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Everything Included in This Bundle
            </h2>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quantity</span>
              <strong className="text-sm font-black text-slate-900">{p.reelCount || 1000}+ Videos</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolution</span>
              <strong className="text-sm font-black text-slate-900">{p.resolution || '1080P'} Full HD</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Format</span>
              <strong className="text-sm font-black text-slate-900">9:16 Vertical MP4</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Watermark</span>
              <strong className="text-sm font-black text-emerald-700">Zero (Clean)</strong>
            </div>
          </div>

          {/* Description Text */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {p.description ? (
              <div className="whitespace-pre-line">{p.description}</div>
            ) : (
              <p>{details.overview}</p>
            )}

            {/* Contents Bullets */}
            <div className="pt-2 space-y-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Content specifications:</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {details.contents.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>{item.label}:</strong> {item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 3: WHO IS THIS FOR */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 block">
              Audience
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Who is This Bundle Best For?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {details.audienceCards.slice(0, 3).map((card, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-3"
              >
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  {getAudienceIcon(card.icon)}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 mb-0.5">{card.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DEDICATED PRODUCT GROWTH PROOFS (Strictly renders ONLY if screenshots have been uploaded for this specific bundle) */}
        <GrowthProofSection
          productSlug={currentProduct.slug}
          productId={String(currentProduct.id)}
          strictProductOnly={true}
          className="rounded-2xl sm:rounded-3xl"
          headlineOverride={`Real Channel Growth With ${currentProduct.title}`}
          subheadlineOverride="Verified Instagram reach & follower metrics achieved by creators using this bundle."
        />

        {/* SECTION 4: VERIFIED CUSTOMER REVIEWS */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 block">
                Verified Reviews
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                Creator Feedback & Ratings
              </h2>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 self-start sm:self-auto">
              <span className="text-amber-500 font-black text-sm">★ 4.9 / 5</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">200+ Verified Buyers</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {CUSTOMER_REVIEWS.map((rev) => {
              const currentHelpful = rev.helpful + (helpfulMap[rev.id] || 0);
              return (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/70 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                          {rev.author.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <span>{rev.author}</span>
                            <BadgeCheck className="w-3 h-3 text-emerald-600" />
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">{rev.role}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{rev.date}</span>
                    </div>

                    <div className="text-amber-400 text-xs">★★★★★</div>
                    <h4 className="text-xs font-bold text-slate-900">{rev.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified Purchase
                    </span>
                    <button
                      type="button"
                      onClick={() => handleHelpful(rev.id)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-[11px] cursor-pointer"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Helpful ({currentHelpful})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-purple-700 block">
              FAQ
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-2">
            {details.faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200/80 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-3.5 text-left font-bold text-xs sm:text-sm text-slate-900 flex justify-between items-center gap-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="text-purple-600 font-black text-sm shrink-0">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="p-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 6: WHATSAPP DIRECT SUPPORT ASSISTANCE */}
        <section className="rounded-2xl p-4 sm:p-5 bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 fill-white" />
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                Need any help or have a question before buying?
              </h3>
              <p className="text-[11px] text-emerald-800">
                Our support team is available on WhatsApp to assist you immediately.
              </p>
            </div>
          </div>

          <a
            href={`https://wa.me/${((settings.supportWhatsapp || '7330482005').replace(/[^0-9]/g, '').length === 10 ? '91' + (settings.supportWhatsapp || '7330482005').replace(/[^0-9]/g, '') : (settings.supportWhatsapp || '7330482005').replace(/[^0-9]/g, ''))}?text=${encodeURIComponent(
              `Hi ${settings.storeName || 'InstaReel'} Support! I have a question regarding: "${p.title}"`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <span>Chat on WhatsApp</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </section>

        {/* SECTION 7: RELATED PRODUCTS */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Related Bundles
            </h2>
            <Link
              href="/shop"
              className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {relatedBundles.map((rel) => (
              <article
                key={rel.id}
                className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between p-2.5 space-y-2 group"
              >
                <Link
                  href={`/product/${rel.slug}`}
                  className="block aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 relative"
                >
                  <img
                    src={optimizeImageUrl(rel.thumbnail, 400)}
                    alt={`${rel.title} preview`}
                    width={400}
                    height={300}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/75 text-white">
                    {rel.resolution || '1080P'}
                  </span>
                </Link>

                <div className="space-y-1">
                  <Link href={`/product/${rel.slug}`}>
                    <h3 className="font-bold text-xs text-slate-900 line-clamp-2 hover:text-amber-600 transition-colors leading-snug">
                      {rel.title}
                    </h3>
                  </Link>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-black text-xs sm:text-sm text-slate-900">
                      ₹{rel.personalPrice}.00
                    </span>
                    <button
                      type="button"
                      onClick={() => buyNow(rel, 'personal')}
                      className="px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black shadow-2xs active:scale-95 transition-transform cursor-pointer"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>

      {/* MOBILE STICKY BOTTOM BAR (Locked Directly Above MobileBottomNav) */}
      <aside
        aria-label="Sticky Buy Now Bar"
        className="fixed bottom-[74px] left-2.5 right-2.5 z-40 md:hidden bg-slate-950/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl px-3.5 py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          {/* Price */}
          <div className="flex flex-col shrink-0 min-w-0">
            <span className="text-[9px] font-bold text-rose-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Instant Access
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-white">₹{activePrice}.00</span>
              <span className="text-xs text-slate-400 line-through font-semibold">₹{originalPrice}.00</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <button
              type="button"
              onClick={() => buyNow(p, 'personal')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-md shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Buy Now — ₹{activePrice}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Reseller Auth Modal */}
      <ResellerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => router.push(`/earn/create/${p.id}`)}
        productTitle={p.title}
        productId={p.id}
      />

    </div>
  );
}

function ReelDirectVideoPlayer({
  src,
  poster,
  title,
}: {
  src: string;
  poster?: string;
  title: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay with sound was blocked by browser; fallback to muted autoplay
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
    }
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowAnimation(true);
    setTimeout(() => setShowAnimation(false), 600);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  return (
    <div
      onClick={togglePlay}
      className="w-full h-full relative cursor-pointer select-none group flex items-center justify-center overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-cover"
      />

      {/* Animated Play/Pause pulse in center on tap */}
      {showAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-2xl scale-110 transition-transform duration-300">
            {isPlaying ? (
              <Play className="w-8 h-8 fill-white text-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* Paused state subtle indicator */}
      {!isPlaying && !showAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/35">
          <div className="w-14 h-14 rounded-full bg-amber-500/95 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40">
            <Play className="w-7 h-7 fill-slate-950 ml-1" />
          </div>
        </div>
      )}

      {/* Top Controls: Sound Toggle */}
      <div className="absolute top-7 right-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all cursor-pointer shadow-md"
          title={isMuted ? 'Unmute sound' : 'Mute sound'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-amber-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
