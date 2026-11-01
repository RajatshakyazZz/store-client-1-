export interface HomepagePinnedConfig {
  enabled: boolean;
  pinnedSlugs: string[]; // Slugs of products pinned to top of homepage in order
  badgeText: string;     // Default: 'VIRAL BUNDLE'
  popupTitle?: string;   // Default: 'Viral Bundles'
  popupSubtitle?: string;// Default: 'Handpicked viral reels packs curated to scale your reach 10x.'
  autoPopup?: boolean;   // Default: true
  updatedAt?: string;
}

export const DEFAULT_HOMEPAGE_PINNED: HomepagePinnedConfig = {
  enabled: true,
  pinnedSlugs: [],
  badgeText: 'VIRAL BUNDLE',
  popupTitle: 'Viral Bundles',
  popupSubtitle: 'Handpicked viral reels packs curated to scale your reach 10x.',
  autoPopup: true,
};

let cachedPinned: HomepagePinnedConfig | null = null;
let lastPinnedFetch = 0;

export function getHomepagePinnedSync(): HomepagePinnedConfig {
  if (cachedPinned) return cachedPinned;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('vaultzet_homepage_pinned');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const loaded: HomepagePinnedConfig = { ...DEFAULT_HOMEPAGE_PINNED, ...parsed };
          cachedPinned = loaded;
          return loaded;
        }
      }
    } catch {}
  }
  return DEFAULT_HOMEPAGE_PINNED;
}

export async function fetchHomepagePinned(force = false): Promise<HomepagePinnedConfig> {
  const now = Date.now();
  if (!force && cachedPinned && now - lastPinnedFetch < 60000) {
    return cachedPinned;
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings/homepage-pinned', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          cachedPinned = data.config;
          lastPinnedFetch = now;
          try {
            localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(data.config));
          } catch {}
          return data.config;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch /api/settings/homepage-pinned:', e);
    }
  }

  return getHomepagePinnedSync();
}

export async function saveHomepagePinned(config: HomepagePinnedConfig): Promise<boolean> {
  cachedPinned = config;
  lastPinnedFetch = Date.now();

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('vaultzet:homepage_pinned_updated', { detail: config }));
    } catch {}

    try {
      const res = await fetch('/api/admin/settings/homepage-pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to save homepage pinned settings to API:', e);
      return false;
    }
  }
  return true;
}
