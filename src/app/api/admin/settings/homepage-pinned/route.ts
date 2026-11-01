import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_HOMEPAGE_PINNED, HomepagePinnedConfig } from '@/lib/homepagePinnedSettings';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
            popupTitle: data.popupTitle || DEFAULT_HOMEPAGE_PINNED.popupTitle,
            popupSubtitle: data.popupSubtitle || DEFAULT_HOMEPAGE_PINNED.popupSubtitle,
            autoPopup: typeof data.autoPopup === 'boolean' ? data.autoPopup : true,
            updatedAt: data.updatedAt || data.updated_at,
          };
          return NextResponse.json({ success: true, config }, { headers: CORS_HEADERS });
        }
      } catch (err) {
        console.warn('Error reading homepage_pinned in admin API:', err);
      }
    }

    return NextResponse.json({ success: true, config }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('Failed to get homepage pinned settings:', error);
    return NextResponse.json(
      { success: false, config: DEFAULT_HOMEPAGE_PINNED, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const config: HomepagePinnedConfig = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      pinnedSlugs: Array.isArray(body.pinnedSlugs)
        ? body.pinnedSlugs.map((s: any) => String(s || '').trim()).filter(Boolean)
        : [],
      badgeText: String(body.badgeText || 'VIRAL BUNDLE').trim(),
      popupTitle: String(body.popupTitle || 'Viral Bundles').trim(),
      popupSubtitle: String(
        body.popupSubtitle || 'Handpicked viral reels packs curated to scale your reach 10x.'
      ).trim(),
      autoPopup: typeof body.autoPopup === 'boolean' ? body.autoPopup : true,
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      try {
        await setDoc(doc(db, 'store_settings', 'homepage_pinned'), config, { merge: true });

        // Dual write to general settings document for cross-compatibility
        await setDoc(
          doc(db, 'store_settings', 'general'),
          { homepage_pinned: config, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => null);

        // Also update individual product docs if needed
        for (const slug of config.pinnedSlugs) {
          try {
            await setDoc(doc(db, 'products', slug), { is_homepage_top: true }, { merge: true });
          } catch {}
        }

        // Add audit log
        await addDoc(collection(db, 'audit_logs'), {
          action: 'HOMEPAGE_PINNED_SETTINGS_UPDATE',
          details: `Updated homepage top pinned products count: ${config.pinnedSlugs.length}`,
          timestamp: serverTimestamp(),
          performedBy: 'admin',
          metadata: { pinnedSlugs: config.pinnedSlugs },
        }).catch(() => null);
      } catch (firestoreErr) {
        console.warn('Firestore write failed for homepage_pinned:', firestoreErr);
      }
    }

    return NextResponse.json({ success: true, config }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('Failed to save homepage pinned settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
