export interface GrowthProofItem {
  id: string;
  image: string;
  title: string;
  followers?: string;
  metric?: string;
  tag?: string;
  // Product assignment fields
  productId?: string;
  productSlug?: string;
  productTitle?: string;
}

export interface GrowthProofsConfig {
  enabled: boolean;
  badge: string;
  headline: string;
  subheadline: string;
  autoplay: boolean;
  autoplayInterval: number; // in milliseconds (default: 4000)
  items: GrowthProofItem[];
  updatedAt?: string;
}

export const DEFAULT_GROWTH_PROOFS: GrowthProofsConfig = {
  enabled: true,
  badge: 'REAL GROWTH PROOF',
  headline: 'Real Growth By Our Bundle Users',
  subheadline: 'These creators acquired our bundles, scaled to 100K+ followers, and monetize daily.',
  autoplay: true,
  autoplayInterval: 4000,
  items: [],
};

// In-memory runtime cache
let cachedGrowth: GrowthProofsConfig | null = null;
let lastGrowthFetch = 0;

export function getGrowthProofsSync(): GrowthProofsConfig {
  if (cachedGrowth) return cachedGrowth;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('vaultzet_growth_proofs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const loaded: GrowthProofsConfig = { ...DEFAULT_GROWTH_PROOFS, ...parsed };
          cachedGrowth = loaded;
          return loaded;
        }
      }
    } catch {}
  }
  return DEFAULT_GROWTH_PROOFS;
}

export async function fetchGrowthProofs(force = false): Promise<GrowthProofsConfig> {
  const now = Date.now();
  if (!force && cachedGrowth && now - lastGrowthFetch < 60000) {
    return cachedGrowth;
  }

  // 1. Client-side fetch via internal API
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings/growth-proofs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          cachedGrowth = data.config;
          lastGrowthFetch = now;
          try {
            localStorage.setItem('vaultzet_growth_proofs', JSON.stringify(data.config));
          } catch {}
          return data.config;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch /api/settings/growth-proofs:', e);
    }
  }

  return getGrowthProofsSync();
}
