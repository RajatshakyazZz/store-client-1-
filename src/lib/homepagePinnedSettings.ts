import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  pinnedSlugs: ['2500-ai-snake2'],
  badgeText: 'VIRAL BUNDLE',
  popupTitle: 'Viral Bundles',
  popupSubtitle: 'Handpicked viral reels packs curated to scale your reach 10x.',
  autoPopup: false,
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
          const loaded: HomepagePinnedConfig = {
            ...DEFAULT_HOMEPAGE_PINNED,
            ...parsed,
            pinnedSlugs: Array.isArray(parsed.pinnedSlugs)
              ? parsed.pinnedSlugs.map((s: any) => String(s || '').trim()).filter(Boolean)
              : [],
          };
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

  const local = getHomepagePinnedSync();

  if (typeof window !== 'undefined') {
    // 1. Direct client Firestore read from store_settings/general (cloud verified source)
    if (db) {
      try {
        const genSnap = await getDoc(doc(db, 'store_settings', 'general')).catch(() => null);
        if (genSnap && genSnap.exists()) {
          const gData = genSnap.data();
          if (gData.homepage_pinned && typeof gData.homepage_pinned === 'object') {
            const data = gData.homepage_pinned;
            const loaded: HomepagePinnedConfig = {
              enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
              pinnedSlugs: Array.isArray(data.pinnedSlugs) ? data.pinnedSlugs : [],
              badgeText: data.badgeText || DEFAULT_HOMEPAGE_PINNED.badgeText,
              popupTitle: data.popupTitle || DEFAULT_HOMEPAGE_PINNED.popupTitle,
              popupSubtitle: data.popupSubtitle || DEFAULT_HOMEPAGE_PINNED.popupSubtitle,
              autoPopup: typeof data.autoPopup === 'boolean' ? data.autoPopup : true,
              updatedAt: data.updatedAt || data.updated_at,
            };
            if (loaded.pinnedSlugs.length > 0 || !local.pinnedSlugs?.length) {
              cachedPinned = loaded;
              lastPinnedFetch = now;
              try {
                localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(loaded));
              } catch {}
              return loaded;
            }
          }
        }

        // Secondary fallback to dedicated doc
        const snap = await getDoc(doc(db, 'store_settings', 'homepage_pinned')).catch(() => null);
        if (snap && snap.exists()) {
          const data = snap.data();
          const loaded: HomepagePinnedConfig = {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
            pinnedSlugs: Array.isArray(data.pinnedSlugs) ? data.pinnedSlugs : [],
            badgeText: data.badgeText || DEFAULT_HOMEPAGE_PINNED.badgeText,
            popupTitle: data.popupTitle || DEFAULT_HOMEPAGE_PINNED.popupTitle,
            popupSubtitle: data.popupSubtitle || DEFAULT_HOMEPAGE_PINNED.popupSubtitle,
            autoPopup: typeof data.autoPopup === 'boolean' ? data.autoPopup : true,
            updatedAt: data.updatedAt || data.updated_at,
          };
          if (loaded.pinnedSlugs.length > 0 || !local.pinnedSlugs?.length) {
            cachedPinned = loaded;
            lastPinnedFetch = now;
            try {
              localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(loaded));
            } catch {}
            return loaded;
          }
        }
      } catch (err) {
        console.warn('Direct client firestore read error for homepage_pinned:', err);
      }
    }

    // 2. Fetch from API endpoint
    try {
      const res = await fetch('/api/settings/homepage-pinned', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          const incoming = data.config as HomepagePinnedConfig;
          if (incoming.pinnedSlugs?.length || !local.pinnedSlugs?.length) {
            cachedPinned = incoming;
            lastPinnedFetch = now;
            try {
              localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(incoming));
            } catch {}
            return incoming;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch /api/settings/homepage-pinned:', e);
    }
  }

  return local;
}

export async function saveHomepagePinned(config: HomepagePinnedConfig): Promise<boolean> {
  cachedPinned = config;
  lastPinnedFetch = Date.now();

  if (typeof window !== 'undefined') {
    // 1. Instant local persistence
    try {
      localStorage.setItem('vaultzet_homepage_pinned', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('vaultzet:homepage_pinned_updated', { detail: config }));
    } catch {}

    // 2. Direct Firestore write from client SDK (writing to general settings is permitted across all clients)
    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'general'), {
          homepage_pinned: config,
          updated_at: new Date().toISOString()
        }, { merge: true });

        // Optional secondary write to standalone doc if permitted
        setDoc(doc(db, 'store_settings', 'homepage_pinned'), config, { merge: true }).catch(() => null);
      } catch (err) {
        console.warn('Direct firestore save error for homepage_pinned:', err);
      }
    }

    // 3. Sync to API route
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
