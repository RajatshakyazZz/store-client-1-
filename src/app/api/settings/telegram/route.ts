import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export interface TelegramSettingsConfig {
  enabled: boolean;
  bot_token: string;
  admin_chat_ids: string;
  new_order_alert: boolean;
  product_alert: boolean;
  daily_summary_alert: boolean;
  last_test_status?: string;
  last_test_at?: string;
}

const DEFAULT_CONFIG: TelegramSettingsConfig = {
  enabled: true,
  bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
  admin_chat_ids: process.env.TELEGRAM_ALLOWED_USER_IDS || process.env.TELEGRAM_CHAT_ID || '',
  new_order_alert: true,
  product_alert: true,
  daily_summary_alert: true,
};

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
        };

        return NextResponse.json({ success: true, config });
      } catch (err) {
        console.warn('Error reading store_settings telegram config in public settings API:', err);
      }
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
