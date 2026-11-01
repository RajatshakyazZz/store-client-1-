import { z } from 'zod';

// ==========================================
// 1. DASHBOARD & SUMMARY TYPES
// ==========================================
export const DailySummarySchema = z.object({
  sales: z.number(),
  orders: z.number(),
  customers: z.number(),
  pending_orders: z.number(),
  refunded_orders: z.number().default(0),
  gross_revenue: z.number(),
  net_revenue: z.number(),
  average_order_value: z.number(),
  currency: z.string().default('INR'),
  currency_symbol: z.string().default('₹'),
  revenue_trend: z.array(
    z.object({
      date: z.string(),
      revenue: z.number(),
      orders: z.number(),
    })
  ),
  top_selling_bundles: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      sales_count: z.number(),
      revenue: z.number(),
    })
  ),
  site_mode: z.enum(['LIVE', 'MAINTENANCE']).default('LIVE'),
  connector_status: z.object({
    version: z.string(),
    latest_version: z.string(),
    update_available: z.boolean(),
    last_checked: z.string(),
  }),
});
export type DailySummary = z.infer<typeof DailySummarySchema>;

// ==========================================
// 2. PRODUCT & DOWNLOADABLE FILE TYPES
// ==========================================
export const ProductSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['publish', 'draft', 'pending', 'private', 'trash']),
  is_deleted: z.boolean().optional(),
  deleted_at: z.string().optional(),
  price: z.number(),
  regular_price: z.number(),
  sale_price: z.number().optional(),
  stock_status: z.enum(['instock', 'outofstock', 'onbackorder']),
  categories: z.array(z.string()),
  reel_count: z.number().default(500),
  format: z.string().default('MP4'),
  resolution: z.string().default('1080P'),
  featured_image: z.string().optional(),
  downloadable: z.boolean().default(true),
  downloads_count: z.number().default(0),
  files: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        file_url: z.string(),
        token: z.string().optional(),
        expires_at: z.string().optional(),
      })
    )
    .optional(),
  created_at: z.string().optional(),
  short_description: z.string().optional(),
  description: z.string().optional(),
  reseller_price: z.number().optional(),
  reseller_regular_price: z.number().optional(),
  preview_video_url: z.string().optional(),
  preview_video_urls: z.array(z.string()).optional(),
  gallery_images: z.array(z.string()).optional(),
  google_drive_link: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_hot: z.boolean().optional(),
  is_trending: z.boolean().optional(),
  rating: z.number().optional(),
  review_count: z.number().optional(),
  features: z.array(z.string()).optional(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  bump_offer: z
    .object({
      enabled: z.boolean().default(true),
      mode: z.enum(['custom', 'ready_made', 'disabled', 'default']).default('default'),
      product_id: z.string().optional(),
      product_slug: z.string().optional(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      price: z.number().optional(),
      regular_price: z.number().optional(),
      thumbnail: z.string().optional(),
      reel_count: z.number().optional(),
      google_drive_link: z.string().optional(),
    })
    .optional(),
});
export type Product = z.infer<typeof ProductSchema>;

export const GlobalBumpOfferSchema = z.object({
  enabled: z.boolean().default(true),
  bump_type: z.enum(['store_product', 'custom']).default('store_product'),
  product_id: z.string().default('bump-special-01'),
  product_slug: z.string().default('1500-ultimate-twisted-world-reel-bundle'),
  title: z.string().default('1500+ Ultimate Twisted World & Viral AI Reels Pack'),
  subtitle: z.string().default('Add this exclusive bonus pack to your order & get 80% instant discount!'),
  price: z.number().default(99),
  regular_price: z.number().default(499),
  discount_percentage: z.number().default(80),
  thumbnail: z.string().default('https://reelsbundles.in/wp-content/uploads/2026/10/3200-ultimate-twisted-world-reel-bundle-reels-bundle-1-2-768x576.png'),
  reel_count: z.number().default(1500),
  google_drive_link: z.string().optional(),
  updated_at: z.string().optional(),
});
export type GlobalBumpOffer = z.infer<typeof GlobalBumpOfferSchema>;

export const FreeBundleOfferSchema = z.object({
  enabled: z.boolean().default(true),
  banner_image: z.string().default(''),
  banner_fallback_image: z.string().default(''),
  min_cart_value: z.number().default(149),
  free_bundle_quantity: z.number().default(2),
  headline: z.string().default('Get 2 of Any Bundle FREE'),
  subheadline: z.string().default('PAY ₹149 OR MORE & PICK ANY 2 ADDITIONAL REELS BUNDLES AT NO EXTRA COST!'),
  button_text: z.string().default('🎁 Claim 2 Free Bundles on Min. ₹149 Order →'),
  updated_at: z.string().optional(),
});
export type FreeBundleOffer = z.infer<typeof FreeBundleOfferSchema>;

export const CategoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  count: z.number().default(0),
  icon: z.string().optional(),
  bg: z.string().optional(),
  border: z.string().optional(),
  iconColor: z.string().optional(),
  description: z.string().optional(),
  created_at: z.string().optional(),
  is_custom: z.boolean().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.string().optional(),
});
export type CategoryItem = z.infer<typeof CategoryItemSchema>;

export interface DownloadableFileTokenResponse {
  token: string;
  download_url: string;
  expires_in_minutes: number;
}

// ==========================================
// 3. ORDERS TYPES
// ==========================================
export const OrderItemSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
  name: z.string(),
  quantity: z.number(),
  subtotal: z.number(),
  total: z.number(),
  license: z.enum(['personal', 'reseller']).default('personal'),
});

export const OrderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  order_number: z.string(),
  status: z.enum([
    'completed',
    'processing',
    'pending',
    'on-hold',
    'failed',
    'refunded',
    'cancelled',
  ]),
  total: z.number(),
  currency: z.string().default('INR'),
  customer: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    first_name: z.string(),
    last_name: z.string().optional(),
    email: z.string(),
    phone: z.string().optional(),
  }),
  items: z.array(OrderItemSchema),
  payment_method: z.string(),
  transaction_id: z.string().optional(),
  date_created: z.string(),
  date_modified: z.string().optional(),
  google_drive_sent: z.boolean().default(true),
});
export type Order = z.infer<typeof OrderSchema>;

export interface OrderSyncParams {
  limit?: number;
  offset?: number;
  order_id?: string | number;
  meta_only?: boolean;
  modified_after?: string;
}

// ==========================================
// 4. CUSTOMERS TYPES
// ==========================================
export const CustomerSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  total_spent: z.number(),
  orders_count: z.number(),
  last_order_date: z.string().optional(),
  status: z.enum(['active', 'blocked']).default('active'),
  registered_at: z.string().optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;

// ==========================================
// 5. COUPONS TYPES
// ==========================================
export const CouponSchema = z.object({
  id: z.union([z.string(), z.number()]),
  code: z.string(),
  discount_type: z.enum(['percent', 'fixed_cart', 'fixed_product']),
  amount: z.number(),
  description: z.string().optional(),
  usage_count: z.number().default(0),
  usage_limit: z.number().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});
export type Coupon = z.infer<typeof CouponSchema>;

// ==========================================
// 6. CONTENT, POSTS & PAGES
// ==========================================
export const ContentItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  slug: z.string(),
  type: z.enum(['post', 'page']),
  status: z.enum(['publish', 'draft', 'pending', 'private']),
  author: z.string().optional(),
  category: z.string().optional(),
  date_modified: z.string(),
  content: z.string().optional(),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

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
  is_deleted?: boolean;
  deleted_at?: string;
}

// ==========================================
// 7. BRANDING TYPES
// ==========================================
export interface StoreBranding {
  store_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
}

// ==========================================
// 8. SITE MODE TYPES
// ==========================================
export interface SiteModeConfig {
  mode: 'LIVE' | 'MAINTENANCE';
  maintenance_message: string;
  bypass_ips: string[];
  last_updated: string;
}

// ==========================================
// 9. STORE SETUP TYPES
// ==========================================
export interface StoreSetupConfig {
  store_name: string;
  contact_email: string;
  support_whatsapp: string;
  support_phone?: string;
  currency: string;
  currency_symbol: string;
  price_format: string;
  auto_complete_digital_orders: boolean;
  enable_guest_checkout: boolean;
  order_success_drive_redirect: boolean;
}

// ==========================================
// 10. META PIXEL & CAPI TYPES
// ==========================================
export interface MetaPixelConfig {
  enabled: boolean;
  pixel_id: string;
  capi_token: string;
  test_event_code: string;
  track_pageviews: boolean;
  track_view_content: boolean;
  track_add_to_cart: boolean;
  track_initiate_checkout: boolean;
  track_purchase: boolean;
  last_event_status?: string;
  last_event_time?: string;
}

// ==========================================
// 11. WHATSAPP BUTTON TYPES
// ==========================================
export interface WhatsappButtonConfig {
  enabled: boolean;
  phone_number: string;
  default_message: string;
  position: 'bottom-right' | 'bottom-left';
  show_popup_badge: boolean;
  popup_text: string;
  button_color: string;
}

// ==========================================
// 12. WEBHOOKS & LOGS TYPES
// ==========================================
export interface WebhookConfig {
  secret_key: string;
  endpoints: {
    order_created: boolean;
    order_completed: boolean;
    order_refunded: boolean;
    product_updated: boolean;
  };
}

export interface WebhookLogEntry {
  id: string;
  event: string;
  target_url: string;
  status_code: number;
  status: 'success' | 'failed' | 'retrying';
  payload_summary: string;
  retry_count: number;
  timestamp: string;
}

// ==========================================
// 13 & 14. PLUGINS & THEMES
// ==========================================
export interface WpPlugin {
  name: string;
  plugin_file: string;
  version: string;
  active: boolean;
  has_update: boolean;
  latest_version?: string;
  description: string;
}

export interface WpTheme {
  name: string;
  slug: string;
  version: string;
  active: boolean;
  screenshot: string;
  has_update: boolean;
}

// ==========================================
// 15. CONNECTOR PLUGIN UPDATE STATUS
// ==========================================
export interface ConnectorStatus {
  plugin_name: string;
  current_version: string;
  latest_version: string;
  update_available: boolean;
  php_version: string;
  wp_version: string;
  wc_version: string;
  last_sync: string;
  changelog?: string;
}

// ==========================================
// 16. SETTINGS & INTEGRATIONS PANELS
// ==========================================
export interface PayUConfig {
  enabled: boolean;
  merchant_key: string;
  merchant_salt: string;
  environment: 'PRODUCTION' | 'TEST' | 'SANDBOX';
  return_url: string;
  last_test_status?: string;
  // Legacy aliases
  app_id?: string;
  secret_key?: string;
  api_version?: string;
  webhook_secret?: string;
}

export type CashfreeConfig = PayUConfig;
export type PgBridgeConfig = PayUConfig;

export interface DnpMetaConfig {
  enabled: boolean;
  meta_pixel_id: string;
  capi_token: string;
  test_event_code?: string;
  last_cart_event: string;
  last_purchase_event: string;
  event_health_score: number;
}

export interface MmcAnalyticsConfig {
  enabled: boolean;
  tracking_id: string;
  active_visitors_now: number;
  bounce_rate: string;
  avg_session_duration: string;
}

export interface RankMathConfig {
  modules: {
    sitemap: boolean;
    schema: boolean;
    redirections: boolean;
    seo_analysis: boolean;
  };
  global_title_separator: string;
  homepage_meta_title: string;
  homepage_meta_description: string;
}

export interface LiteSpeedConfig {
  cache_enabled: boolean;
  css_minify: boolean;
  js_minify: boolean;
  image_optimization: boolean;
  cdn_status: 'ACTIVE' | 'BYPASS' | 'OFFLINE';
  last_purge_time: string;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token: string;
  admin_chat_ids: string;
  new_order_alert: boolean;
  product_alert: boolean;
  daily_summary_alert: boolean;
  last_test_status?: string;
  last_test_at?: string;
}

// ==========================================
// 19. SOCIAL PROOF & SHOWCASE TYPES
// ==========================================
export interface AdminGrowthProofItem {
  id: string;
  image: string;
  title: string;
  followers?: string;
  metric?: string;
  tag?: string;
  productId?: string;
  productSlug?: string;
  productTitle?: string;
}

export interface AdminGrowthProofsConfig {
  enabled: boolean;
  badge: string;
  headline: string;
  subheadline: string;
  autoplay: boolean;
  autoplayInterval: number;
  items: AdminGrowthProofItem[];
  updatedAt?: string;
}

export interface HomepagePinnedConfig {
  enabled: boolean;
  pinnedSlugs: string[];
  badgeText: string;
  popupTitle?: string;
  popupSubtitle?: string;
  autoPopup?: boolean;
  updatedAt?: string;
}

