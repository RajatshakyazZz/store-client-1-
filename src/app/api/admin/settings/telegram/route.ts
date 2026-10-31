import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
};

export interface TelegramSettingsConfig {
  enabled: boolean;
  bot_token: string;
  admin_chat_ids: string;
  new_order_alert: boolean;
  product_alert: boolean;
  daily_summary_alert: boolean;
  last_test_status?: string;
  last_test_at?: string;
  updated_at?: string;
}

const DEFAULT_CONFIG: TelegramSettingsConfig = {
  enabled: true,
  bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
  admin_chat_ids: process.env.TELEGRAM_ALLOWED_USER_IDS || process.env.TELEGRAM_CHAT_ID || '',
  new_order_alert: true,
  product_alert: true,
  daily_summary_alert: true,
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    let config = { ...DEFAULT_CONFIG };

    if (db) {
      try {
        const [genSnap, telSnap] = await Promise.all([
          getDoc(doc(db, 'store_settings', 'general')).catch(() => null),
          getDoc(doc(db, 'store_settings', 'telegram')).catch(() => null),
        ]);

        const genTelegram =
          genSnap && genSnap.exists() && genSnap.data().telegram && typeof genSnap.data().telegram === 'object'
            ? genSnap.data().telegram
            : null;
        const telDoc = telSnap && telSnap.exists() ? telSnap.data() : null;

        // Choose the one that has valid credentials, prioritizing general or whichever has values
        const sourceData =
          (genTelegram && (genTelegram.bot_token || genTelegram.admin_chat_ids))
            ? genTelegram
            : (telDoc && (telDoc.bot_token || telDoc.admin_chat_ids))
            ? telDoc
            : (genTelegram || telDoc || {});

        config = {
          enabled: typeof sourceData.enabled === 'boolean' ? sourceData.enabled : true,
          bot_token: String(sourceData.bot_token || '').trim() || DEFAULT_CONFIG.bot_token,
          admin_chat_ids: String(sourceData.admin_chat_ids || '').trim() || DEFAULT_CONFIG.admin_chat_ids,
          new_order_alert: typeof sourceData.new_order_alert === 'boolean' ? sourceData.new_order_alert : true,
          product_alert: typeof sourceData.product_alert === 'boolean' ? sourceData.product_alert : true,
          daily_summary_alert: typeof sourceData.daily_summary_alert === 'boolean' ? sourceData.daily_summary_alert : true,
          last_test_status: sourceData.last_test_status,
          last_test_at: sourceData.last_test_at,
          updated_at: sourceData.updated_at,
        };

        return NextResponse.json({ success: true, config }, { headers: CORS_HEADERS });
      } catch (err) {
        console.warn('Error reading store_settings telegram config in admin API:', err);
      }
    }

    return NextResponse.json({ success: true, config }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
    const bot_token = String(body.bot_token || DEFAULT_CONFIG.bot_token).trim();
    const admin_chat_ids = String(body.admin_chat_ids || DEFAULT_CONFIG.admin_chat_ids).trim();
    const new_order_alert = typeof body.new_order_alert === 'boolean' ? body.new_order_alert : true;
    const product_alert = typeof body.product_alert === 'boolean' ? body.product_alert : true;
    const daily_summary_alert = typeof body.daily_summary_alert === 'boolean' ? body.daily_summary_alert : true;
    const updated_at = new Date().toISOString();

    const payload: Record<string, any> = {
      enabled,
      bot_token,
      admin_chat_ids,
      new_order_alert,
      product_alert,
      daily_summary_alert,
      updated_at,
    };

    if (body.last_test_status) payload.last_test_status = body.last_test_status;
    if (body.last_test_at) payload.last_test_at = body.last_test_at;

    if (db) {
      let savedToFirestore = false;
      let lastError: any = null;

      // 1. Primary write to store_settings/general (telegram field)
      // This is 100% permitted by Firestore rules and synced across all storefront & admin processes
      try {
        await setDoc(
          doc(db, 'store_settings', 'general'),
          { telegram: payload },
          { merge: true }
        );
        savedToFirestore = true;
      } catch (err: any) {
        console.error('Error saving telegram config to store_settings/general:', err);
        lastError = err;
      }

      // 2. Best-effort mirror write to store_settings/telegram
      try {
        await setDoc(doc(db, 'store_settings', 'telegram'), payload, { merge: true });
        savedToFirestore = true;
      } catch (err: any) {
        console.warn('Optional store_settings/telegram mirror write skipped (rules restricted):', err?.message);
      }

      if (!savedToFirestore && lastError) {
        return NextResponse.json(
          { success: false, error: `Firestore write error: ${lastError.message}` },
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // Record audit log
    if (db) {
      try {
        await addDoc(collection(db, 'admin_audit_logs'), {
          adminEmail: 'admin@vaultzet.com',
          action: 'UPDATE_TELEGRAM_CONFIG',
          module: 'Telegram Alerts',
          details: `Updated Telegram bot token & admin chat IDs (${admin_chat_ids}, Status: ${enabled ? 'ACTIVE' : 'DISABLED'})`,
          createdAt: serverTimestamp(),
        });
      } catch (auditErr) {
        console.warn('Failed to record audit log for telegram update:', auditErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        config: payload,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
