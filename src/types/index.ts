export type LicenseType = 'personal' | 'reseller';

export interface BundleProduct {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;
  category: string;
  categorySlug: string;
  reelCount: number;
  personalPrice: number;
  personalOriginalPrice: number;
  resellerPrice: number;
  resellerOriginalPrice: number;
  thumbnail: string;
  galleryImages: string[];
  previewVideoUrl?: string;
  previewVideoUrls?: string[];
  tags: string[];
  isHot?: boolean;
  isTrending?: boolean;
  isUpcoming?: boolean;
  isHomepageTop?: boolean;
  homepageRank?: number;
  rating: number;
  reviewCount: number;
  resolution: string;
  aspectRatio: string;
  format: string;
  audioIncluded: boolean;
  googleDriveLink?: string;
  files?: Array<{ id?: string; name: string; file_url: string }>;
  features: string[];
  faqs: { question: string; answer: string }[];
  categories?: string[];
  categorySlugs?: string[];
  aliases?: string[];
  bumpOffer?: ProductBumpOfferConfig;
}

export interface ProductBumpOfferConfig {
  enabled: boolean;
  mode: 'custom' | 'ready_made' | 'disabled' | 'default';
  bumpType?: 'store_product' | 'custom';
  productId?: string;
  productSlug?: string;
  title?: string;
  subtitle?: string;
  price?: number;
  regularPrice?: number;
  thumbnail?: string;
  reelCount?: number;
  googleDriveLink?: string;
}

export interface CartItem {
  product: BundleProduct;
  license: LicenseType;
  price: number;
  isFreeBonus?: boolean;
}

export interface OrderBumpItem {
  id: string;
  title: string;
  subtitle: string;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
  thumbnail: string;
  reelCount: number;
  googleDriveLink?: string;
  enabled?: boolean;
  productId?: string;
  productSlug?: string;
}

export interface ReelItem {
  id: string;
  title: string;
  videoUrl: string;
  videoType: 'youtube' | 'direct' | 'embed';
  youtubeId?: string;
  poster?: string;
  category?: string;
  bundleId?: string;
  bundleSlug?: string;
  bundleTitle?: string;
  bundlePrice?: number;
  bundleOriginalPrice?: number;
  reelCount?: number;
  order?: number;
  likes?: number;
  views?: number;
  isActive: boolean;
  createdAt?: string;
}
