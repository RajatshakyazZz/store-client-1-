import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let token = String(body.bot_token || '').trim();
    let rawIds = String(body.admin_chat_ids || '').trim();

    // If not provided in body, load from Firestore
    if (!token || !rawIds) {
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

          const data =
            (genTelegram && (genTelegram.bot_token || genTelegram.admin_chat_ids))
              ? genTelegram
              : (telDoc && (telDoc.bot_token || telDoc.admin_chat_ids))
              ? telDoc
              : (genTelegram || telDoc || {});

          if (!token) token = String(data.bot_token || '').trim();
          if (!rawIds) rawIds = String(data.admin_chat_ids || '').trim();
        } catch {}
      }
    }

    if (!token) {
      token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    }
    if (!rawIds) {
      rawIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || process.env.TELEGRAM_CHAT_ID || '').trim();
    }

    const targetChatIds = rawIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!token || targetChatIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter Bot Token and at least one Admin Chat ID in Admin Panel settings before testing.',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const istTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const msg = `⚡🔔 <b>VAULTWORLD STORE — TELEGRAM BOT TEST ALERT</b> 🚀
━━━━━━━━━━━━━━━━━━━━━━
✅ <b>Bot Connection:</b> Active & Verified
📱 <b>Admin Chat IDs:</b> ${targetChatIds.join(', ')}
🕒 <b>Dispatched At (IST):</b> ${istTime}
🏬 <b>Admin Panel:</b> /asdf/settings
━━━━━━━━━━━━━━━━━━━━━━
<i>If you received this message, your Telegram alerts are working 100% properly!</i>`;

    let successCount = 0;
    const errors: string[] = [];

    await Promise.allSettled(
      targetChatIds.map(async (chatId) => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: msg,
              parse_mode: 'HTML',
            }),
          });
          const json = await res.json();
          if (json.ok) {
            successCount++;
          } else {
            errors.push(`Chat ${chatId}: ${json.description || 'Failed'}`);
          }
        } catch (err: any) {
          errors.push(`Chat ${chatId}: ${err.message}`);
        }
      })
    );

    if (successCount > 0) {
      const statusText = `Verified (${successCount}/${targetChatIds.length} chats)`;
      const timestamp = new Date().toISOString();
      const note = errors.length > 0 ? ` (Note: ${errors.join('; ')} — users must click /start on @Vault_World_bot to receive messages)` : '';

      if (db) {
        try {
          await setDoc(
            doc(db, 'store_settings', 'general'),
            {
              telegram: {
                last_test_status: statusText,
                last_test_at: timestamp,
              },
            },
            { merge: true }
          );
        } catch {}

        try {
          await setDoc(
            doc(db, 'store_settings', 'telegram'),
            {
              last_test_status: statusText,
              last_test_at: timestamp,
            },
            { merge: true }
          );
        } catch {}
      }

      return NextResponse.json(
        {
          success: true,
          message: `Test alert sent successfully to ${successCount} admin chat(s)!${note}`,
          status: statusText,
          timestamp,
        },
        { headers: CORS_HEADERS }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to dispatch alert: ${errors.join('; ') || 'Telegram API error'}`,
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
