import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { DEFAULT_HOMEPAGE_PINNED, HomepagePinnedConfig } from '@/lib/homepagePinnedSettings';

export const runtime = 'nodejs';

export async function GET() {
  try {
    let config: HomepagePinnedConfig = { ...DEFAULT_HOMEPAGE_PINNED };

    if (db) {
      try {
        const snap = await getDoc(doc(db, 'store_settings', 'homepage_pinned')).catch(() => null);
        if (snap && snap.exists()) {
          const data = snap.data();
          config = {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
            pinnedSlugs: Array.isArray(data.pinnedSlugs) ? data.pinnedSlugs : [],
            badgeText: data.badgeText || DEFAULT_HOMEPAGE_PINNED.badgeText,
            updatedAt: data.updatedAt || data.updated_at,
          };
          return NextResponse.json({ success: true, config });
        }

        const genSnap = await getDoc(doc(db, 'store_settings', 'general')).catch(() => null);
        if (genSnap && genSnap.exists()) {
          const gData = genSnap.data();
          if (gData.homepage_pinned && typeof gData.homepage_pinned === 'object') {
            const data = gData.homepage_pinned;
            config = {
              enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
              pinnedSlugs: Array.isArray(data.pinnedSlugs) ? data.pinnedSlugs : [],
              badgeText: data.badgeText || DEFAULT_HOMEPAGE_PINNED.badgeText,
              updatedAt: data.updatedAt || data.updated_at,
            };
            return NextResponse.json({ success: true, config });
          }
        }
      } catch (err) {
        console.warn('Error reading homepage_pinned in storefront API:', err);
      }
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Failed to get homepage pinned settings:', error);
    return NextResponse.json({ success: false, config: DEFAULT_HOMEPAGE_PINNED }, { status: 500 });
  }
}
