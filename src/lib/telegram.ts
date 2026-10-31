// Telegram Instant Alert & Command Center Bot
// Dynamically configured via Admin Panel (/asdf/settings -> Telegram) and environment variables

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUNDLE_PRODUCTS } from '@/data/bundles';

// Master toggle: Enabled by default, dynamically synced with store_settings/telegram in Firestore
export let TELEGRAM_ALERTS_ENABLED = true;

export interface ServerTelegramConfig {
  enabled: boolean;
  botToken: string;
  adminChatIds: string[];
  newOrderAlert: boolean;
  productAlert: boolean;
  dailySummaryAlert: boolean;
  leadAlert?: boolean;
  resellerAlert?: boolean;
}

export const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
export const OWNER_CHAT_ID = (process.env.TELEGRAM_OWNER_CHAT_ID || '').trim();

const ENV_ADMIN_IDS = [
  ...(process.env.TELEGRAM_ALLOWED_USER_IDS ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(',') : []),
  process.env.TELEGRAM_CHAT_ID,
  process.env.TELEGRAM_OWNER_CHAT_ID,
]
  .map((s) => String(s || '').trim())
  .filter(Boolean);

export let AUTHORIZED_TELEGRAM_ADMINS: string[] = Array.from(new Set(ENV_ADMIN_IDS));

let cachedServerTelegramConfig: ServerTelegramConfig | null = null;
let lastServerTelegramFetch = 0;

function parseConfigBool(val: any, fallback = true): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'off' || s === 'disabled') return false;
    if (s === 'true' || s === '1' || s === 'on' || s === 'enabled') return true;
  }
  return fallback;
}

function parseConfigChatIds(val: any): string[] {
  if (Array.isArray(val)) {
    return val.map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function fetchDynamicTelegramConfig(force = false): Promise<ServerTelegramConfig> {
  const now = Date.now();
  if (!force && cachedServerTelegramConfig && now - lastServerTelegramFetch < 30000) {
    return cachedServerTelegramConfig;
  }

  const envAdmins = [
    ...(process.env.TELEGRAM_ALLOWED_USER_IDS ? process.env.TELEGRAM_ALLOWED_USER_IDS.split(',') : []),
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_OWNER_CHAT_ID,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  let resolvedConfig: ServerTelegramConfig = {
    enabled: true,
    botToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    adminChatIds: envAdmins,
    newOrderAlert: true,
    productAlert: true,
    dailySummaryAlert: true,
    leadAlert: true,
    resellerAlert: true,
  };

  if (db) {
    try {
      const [genSnap, telSnap] = await Promise.all([
        getDoc(doc(db, 'store_settings', 'general')).catch(() => null),
        getDoc(doc(db, 'store_settings', 'telegram')).catch(() => null),
      ]);

      const gData = genSnap && genSnap.exists() ? genSnap.data() : null;
      const genTelegram = gData && gData.telegram && typeof gData.telegram === 'object' ? gData.telegram : null;
      const telData = telSnap && telSnap.exists() ? telSnap.data() : null;

      // Pick source with active credentials, prioritizing store_settings/general
      const data =
        (genTelegram && (genTelegram.bot_token || genTelegram.admin_chat_ids))
          ? genTelegram
          : (telData && (telData.bot_token || telData.admin_chat_ids))
          ? telData
          : (genTelegram || telData || null);

      if (data) {
        const customAdmins = parseConfigChatIds(data.admin_chat_ids);

        // Strictly prioritize custom admins set in Admin Panel
        const effectiveAdmins = customAdmins.length > 0 ? customAdmins : envAdmins;

        resolvedConfig = {
          enabled: parseConfigBool(data.enabled, true),
          botToken: String(data.bot_token || '').trim() || resolvedConfig.botToken,
          adminChatIds: effectiveAdmins,
          newOrderAlert: parseConfigBool(data.new_order_alert, true),
          productAlert: parseConfigBool(data.product_alert, true),
          dailySummaryAlert: parseConfigBool(data.daily_summary_alert, true),
          leadAlert: parseConfigBool(data.lead_alert, true),
          resellerAlert: parseConfigBool(data.reseller_alert, true),
        };
      }
    } catch (err) {
      console.warn('Error reading store_settings telegram config in fetchDynamicTelegramConfig:', err);
    }
  }

  TELEGRAM_ALERTS_ENABLED = resolvedConfig.enabled;
  AUTHORIZED_TELEGRAM_ADMINS = resolvedConfig.adminChatIds;
  cachedServerTelegramConfig = resolvedConfig;
  lastServerTelegramFetch = now;
  return resolvedConfig;
}

export type TelegramInlineButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getIstTimestamp(): string {
  try {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return new Date().toISOString();
  }
}

function getIstDateKey(dateInput?: string | number | Date): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
  } catch {
    return '';
  }
}

export function buildWhatsAppFollowUpUrl(phone: string, message: string): string {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }
  if (!digits || digits.length < 10) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function sendTelegramMessage(
  htmlText: string,
  inlineButtons?: Array<Array<TelegramInlineButton>>,
  targetChatId?: string,
  replyMarkup?: any
): Promise<boolean> {
  const config = await fetchDynamicTelegramConfig().catch(() => null);
  const isEnabled = config ? config.enabled !== false : TELEGRAM_ALERTS_ENABLED;
  if (!isEnabled) {
    console.log('[Telegram Alert] Suppressed: Telegram alerts are disabled in store settings.');
    return false;
  }

  const token = (config?.botToken || TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.warn('[Telegram Alert] Missing bot token, cannot dispatch message.');
    return false;
  }

  const authorizedList =
    config?.adminChatIds && config.adminChatIds.length > 0
      ? config.adminChatIds
      : AUTHORIZED_TELEGRAM_ADMINS;

  const targets = targetChatId ? [String(targetChatId).trim()] : authorizedList;
  const validTargets = Array.from(new Set(targets.map((s) => String(s || '').trim()).filter(Boolean)));
  if (validTargets.length === 0) {
    console.warn('[Telegram Alert] No valid target chat IDs found.');
    return false;
  }

  const results = await Promise.allSettled(
    validTargets.map(async (chatId) => {
      try {
        const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload: Record<string, any> = {
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        };

        if (inlineButtons && inlineButtons.length > 0) {
          payload.reply_markup = {
            inline_keyboard: inlineButtons,
          };
        } else if (replyMarkup) {
          payload.reply_markup = replyMarkup;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          return true;
        } else {
          const errText = await res.text();
          console.warn(`Telegram API error for chat ${chatId}:`, errText);

          // If chat not found, the user has not started the bot
          if (errText.includes('chat not found')) {
            console.warn(`[Telegram Alert] Chat ${chatId} not found. The user must click /start on the bot in Telegram first.`);
            return false;
          }

          // Resilient Fallback 1: Plain text with buttons
          const plainText = htmlText
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '');

          try {
            const retryPayload: Record<string, any> = {
              chat_id: chatId,
              text: plainText,
              disable_web_page_preview: true,
            };
            if (payload.reply_markup) {
              retryPayload.reply_markup = payload.reply_markup;
            }
            const retryRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(retryPayload),
            });
            if (retryRes.ok) return true;
          } catch {}

          // Resilient Fallback 2: Plain text WITHOUT buttons (in case inline keyboard button URL was rejected)
          try {
            const fallbackNoButtons = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: plainText,
                disable_web_page_preview: true,
              }),
            });
            if (fallbackNoButtons.ok) return true;
          } catch {}

          return false;
        }
      } catch (err) {
        console.warn(`Failed to dispatch Telegram alert to ${chatId}:`, err);
        return false;
      }
    })
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  return successCount > 0;
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number | string,
  htmlText: string,
  inlineButtons?: Array<Array<TelegramInlineButton>>
): Promise<boolean> {
  const config = await fetchDynamicTelegramConfig().catch(() => null);
  const isEnabled = config ? config.enabled !== false : TELEGRAM_ALERTS_ENABLED;
  if (!isEnabled) {
    return false;
  }

  const token = (config?.botToken || TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return false;

  try {
    const endpoint = `https://api.telegram.org/bot${token}/editMessageText`;
    const payload: Record<string, any> = {
      chat_id: chatId,
      message_id: messageId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (inlineButtons && inlineButtons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineButtons,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If message is not modified, treat as success
      if (errText.includes('message is not modified')) {
        return true;
      }
      console.warn('editMessageText failed, falling back to sendMessage:', errText);
      return await sendTelegramMessage(htmlText, inlineButtons, chatId);
    }

    return true;
  } catch (err) {
    console.warn('editTelegramMessage exception, falling back:', err);
    return await sendTelegramMessage(htmlText, inlineButtons, chatId);
  }
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<boolean> {
  if (!callbackQueryId) return false;
  const config = await fetchDynamicTelegramConfig().catch(() => null);
  const isEnabled = config ? config.enabled !== false : TELEGRAM_ALERTS_ENABLED;
  if (!isEnabled) return false;

  const token = (config?.botToken || TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return false;

  try {
    const endpoint = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || undefined,
        show_alert: showAlert,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface OrderAlertData {
  orderNumber: string;
  customer: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    id?: string;
    title: string;
    license?: string;
    price: number;
    googleDriveLink?: string;
  }>;
  orderBump?: {
    title: string;
    price: number;
  } | null;
  totalAmount: number;
  paymentStatus?: string;
  paymentMethod?: string;
  reason?: string;
}

function resolveDriveLinkForItem(item: { id?: string; title?: string; googleDriveLink?: string }): string {
  if (item.googleDriveLink && item.googleDriveLink.startsWith('http') && !item.googleDriveLink.includes('/demo-')) {
    return item.googleDriveLink;
  }
  try {
    const serverProductLinks = require('@/data/productDriveLinks.server.json');
    const cleanId = (item.id || '').replace(/^rb-/, '');
    const pdl =
      serverProductLinks?.byId?.[item.id || ''] ||
      serverProductLinks?.byId?.[cleanId] ||
      serverProductLinks?.byId?.[`rb-${cleanId}`];
    if (pdl && pdl.primaryLink && !pdl.primaryLink.includes('/demo-')) {
      return pdl.primaryLink;
    }
  } catch {}
  const matched = BUNDLE_PRODUCTS.find(
    (b) =>
      (item.id && b.id === item.id) ||
      (item.title && b.title.toLowerCase() === item.title.toLowerCase())
  );
  return matched?.googleDriveLink || 'https://vaultworld.shop/my-order';
}

/**
 * 1. Alert for Checkout Initiated OR Payment Abandoned / Incomplete
 *    Includes:
 *    - 1-Click Standard WhatsApp Follow-Up Button
 *    - 1-Click "Offer 20% Discount on WhatsApp" Recovery Button
 */
export async function sendAbandonedOrPendingTelegramAlert(
  data: OrderAlertData,
  mode: 'checkout_initiated' | 'payment_abandoned' = 'payment_abandoned'
): Promise<boolean> {
  const customerName = data.customer?.fullName?.trim() || 'Valued Customer';
  const customerEmail = data.customer?.email?.trim() || 'N/A';
  const customerPhone = data.customer?.phone?.trim() || 'N/A';
  const items = data.items || [];
  const totalAmount = Number(data.totalAmount || 49);
  const discountedAmount = Math.max(19, Math.round(totalAmount * 0.8));
  const discountSaved = Math.max(10, totalAmount - discountedAmount);

  const productNamesList =
    items.map((i) => i.title).join(', ') +
    (data.orderBump ? ` + ${data.orderBump.title}` : '');

  const itemsFormatted =
    items.length > 0
      ? items
          .map(
            (it, idx) =>
              `   ${idx + 1}. <b>${escapeHtml(it.title)}</b> (${escapeHtml(
                it.license || 'personal'
              )}) — ₹${it.price}`
          )
          .join('\n')
      : '   • Viral Reels Bundle';

  const bumpLine = data.orderBump
    ? `\n🎁 <b>Bonus Bump:</b> ${escapeHtml(data.orderBump.title)} (+₹${data.orderBump.price})`
    : '';

  const reasonLine = data.reason
    ? `\n📝 <b>Note:</b> ${escapeHtml(data.reason)}`
    : '';

  const header =
    mode === 'payment_abandoned'
      ? `⚠️🚨 <b>PAYMENT ABANDONED / INCOMPLETE!</b> 🚨⚠️\n━━━━━━━━━━━━━━━━━━━━━━`
      : `🛒🔔 <b>NEW CHECKOUT STARTED (PENDING)!</b> 🔔🛒\n━━━━━━━━━━━━━━━━━━━━━━`;

  const statusBadge =
    mode === 'payment_abandoned'
      ? `❌ <b>ABANDONED / NOT PAID (${escapeHtml(data.paymentStatus || 'INCOMPLETE')})</b>`
      : `⏳ <b>AWAITING PAYMENT (Checkout Opened)</b>`;

  const text = `${header}

🆔 <b>Order ID:</b> <code>${escapeHtml(data.orderNumber)}</code>
📌 <b>Status:</b> ${statusBadge}
💰 <b>Cart Value:</b> <b>₹${totalAmount}.00</b> (20% Off Recovery: <b>₹${discountedAmount}</b>)

👤 <b>Customer Details:</b>
   • <b>Name:</b> ${escapeHtml(customerName)}
   • <b>Phone / WhatsApp:</b> <code>${escapeHtml(customerPhone)}</code>
   • <b>Email:</b> <code>${escapeHtml(customerEmail)}</code>

📦 <b>Selected Products:</b>
${itemsFormatted}${bumpLine}${reasonLine}

🕒 <b>Time (IST):</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━
👇 <i>Tap below to follow up or send an instant 20% discount offer on WhatsApp:</i>`;

  const followUpMsg = `Hi ${customerName}! 👋\n\nWe noticed you were checking out on *VaultWorld Store* (Order #${data.orderNumber}), but your payment of *₹${totalAmount}* was not completed.\n\n📦 *Your Selected Bundle(s):*\n• ${productNamesList || 'Viral Reels Bundle'}\n\n✨ Complete your order now to get *100% Instant Google Drive Download Access*:\n👉 https://vaultworld.shop/checkout\n\nReply here if you need any help with UPI or payment! 🚀`;

  const discountOfferMsg = `Hi ${customerName}! 🎁 *Special 15-Minute Offer from VaultWorld Store!*\n\nComplete your order (#${data.orderNumber}) for *${productNamesList || 'Viral Reels Bundle'}* in the next 15 minutes and get an *EXTRA 20% DISCOUNT (Save ₹${discountSaved}!)* 🔥\n\n💰 *Special Price for You:* Just *₹${discountedAmount}* (instead of ₹${totalAmount})\n📂 *Delivery:* 100% Instant Google Drive Link\n\n👉 Complete your order now:\nhttps://vaultworld.shop/checkout\n\nOr reply *YES* here to get a direct ₹${discountedAmount} UPI payment link right now! ⚡`;

  const waFollowUpUrl = buildWhatsAppFollowUpUrl(customerPhone, followUpMsg);
  const waDiscountUrl = buildWhatsAppFollowUpUrl(customerPhone, discountOfferMsg);

  return sendTelegramMessage(text, [
    [{ text: `💬 Follow Up on WhatsApp (${customerPhone})`, url: waFollowUpUrl }],
    [{ text: `🎁 Offer 20% Discount (₹${discountedAmount}) on WhatsApp`, url: waDiscountUrl }],
    [
      { text: '📊 Today Stats', callback_data: 'cmd_today' },
      { text: '⏳ All Pending Leads', callback_data: 'cmd_pending' },
    ],
  ]);
}

/**
 * 2. Alert for Confirmed Sale / Successful Payment
 *    Includes:
 *    - 1-Click "Send Google Drive Link on WhatsApp" Button with exact bundle Drive URLs
 *    - 1-Click "Send Thank You & Order Summary on WhatsApp" Button
 */
export async function sendSaleSuccessTelegramAlert(data: OrderAlertData): Promise<boolean> {
  const config = await fetchDynamicTelegramConfig().catch(() => null);
  if (config && (config.enabled === false || config.newOrderAlert === false)) {
    console.log('[Telegram Alert] Order alert suppressed by store setting (new_order_alert is disabled).');
    return false;
  }
  const customerName = data.customer?.fullName?.trim() || 'Customer';
  const customerEmail = data.customer?.email?.trim() || 'N/A';
  const customerPhone = data.customer?.phone?.trim() || 'N/A';
  const items = data.items || [];

  const productNamesList =
    items.map((i) => i.title).join(', ') +
    (data.orderBump ? ` + ${data.orderBump.title}` : '');

  const itemsWithLinks =
    items.length > 0
      ? items.map((it) => {
          const itAny = it as any;
          const filesList: Array<{ id?: string; name: string; file_url?: string; url?: string }> =
            Array.isArray(itAny.files) && itAny.files.length > 0
              ? itAny.files
              : [{ name: it.title || 'Google Drive Access', file_url: resolveDriveLinkForItem(it) }];

          return {
            ...it,
            resolvedDriveLink: resolveDriveLinkForItem(it),
            files: filesList,
          };
        })
      : [
          {
            title: 'Viral Reels Bundle',
            license: 'personal',
            price: data.totalAmount,
            resolvedDriveLink: 'https://vaultworld.shop/my-order',
            files: [{ name: 'Viral Reels Bundle Access', file_url: 'https://vaultworld.shop/my-order' }],
          },
        ];

  const itemsFormatted = itemsWithLinks
    .map((it, idx) => {
      const header = `   ${idx + 1}. <b>${escapeHtml(it.title)}</b> [${escapeHtml(
        (it.license || 'personal').toUpperCase()
      )}] — ₹${it.price}`;

      if (it.files && it.files.length > 1) {
        const subFiles = it.files
          .map(
            (f: any, fIdx: number) =>
              `      📂 <b>${escapeHtml(f.name || `Part ${fIdx + 1}`)}:</b> <a href="${escapeHtml(
                f.file_url || f.url || it.resolvedDriveLink
              )}">Open Google Drive</a>`
          )
          .join('\n');
        return `${header}\n${subFiles}`;
      } else {
        return `${header}\n      📂 <a href="${escapeHtml(it.resolvedDriveLink)}">Open Google Drive Folder</a>`;
      }
    })
    .join('\n');

  const bumpLine = data.orderBump
    ? `\n🎁 <b>Order Bump Included:</b> ${escapeHtml(data.orderBump.title)} (+₹${data.orderBump.price})`
    : '';

  const text = `🎉💰 <b>NEW SALE CONFIRMED — VAULTWORLD!</b> 🚀🔥
━━━━━━━━━━━━━━━━━━━━━━

🆔 <b>Order ID:</b> <code>${escapeHtml(data.orderNumber)}</code>
✅ <b>Payment Status:</b> <b>PAID &amp; VERIFIED</b>
💵 <b>Total Paid:</b> <b>₹${data.totalAmount}.00</b>
💳 <b>Gateway:</b> ${escapeHtml(data.paymentMethod || 'Cashfree UPI / Card')}

👤 <b>Buyer Information:</b>
   • <b>Name:</b> ${escapeHtml(customerName)}
   • <b>Phone / WhatsApp:</b> <code>${escapeHtml(customerPhone)}</code>
   • <b>Email:</b> <code>${escapeHtml(customerEmail)}</code>

📦 <b>Purchased Bundles &amp; Drive Links:</b>
${itemsFormatted}${bumpLine}

🕒 <b>Time (IST):</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━
👇 <i>Tap below to send the buyer their direct Google Drive download link on WhatsApp in 1 click!</i>`;

  const driveLinksText = itemsWithLinks
    .map((it, idx) => {
      if (it.files && it.files.length > 1) {
        const subLinks = it.files
          .map(
            (f: any, fIdx: number) =>
              `   • ${f.name || `Part ${fIdx + 1}`}: ${f.file_url || f.url || it.resolvedDriveLink}`
          )
          .join('\n');
        return `${idx + 1}. *${it.title}* (${it.files.length} Files):\n${subLinks}`;
      }
      return `${idx + 1}. *${it.title}*\n📂 Drive Link: ${it.resolvedDriveLink}`;
    })
    .join('\n\n');

  const driveDeliveryMsg = `Hi ${customerName}! 🎉\n\nThank you for your purchase on *VaultWorld Store*! Your payment of *₹${data.totalAmount}.00* (Order #${data.orderNumber}) is confirmed. ✅\n\n📂 *Here is your Instant Google Drive Download Access:*\n\n${driveLinksText}\n\n🔑 You can also access all your orders anytime at:\n👉 https://vaultworld.shop/my-order (Email: ${customerEmail})\n\nEnjoy your reels & grow fast! Reply here if you need any assistance. 🚀`;

  const thankYouMsg = `Hi ${customerName}! 🎉\n\nThank you for your order (#${data.orderNumber}) of *${productNamesList || 'Viral Reels Bundle'}* on *VaultWorld Store*!\n\nLet me know if you were able to open your Google Drive folder smoothly. Happy creating! 🚀`;

  const waDriveUrl = buildWhatsAppFollowUpUrl(customerPhone, driveDeliveryMsg);
  const waThankYouUrl = buildWhatsAppFollowUpUrl(customerPhone, thankYouMsg);

  return sendTelegramMessage(text, [
    [{ text: `📂 Send Drive Link on WhatsApp (${customerPhone})`, url: waDriveUrl }],
    [{ text: `💬 Send Thank-You Check-In on WhatsApp`, url: waThankYouUrl }],
    [
      { text: '📊 Today Revenue (/today)', callback_data: 'cmd_today' },
      { text: '📦 Recent Orders (/orders)', callback_data: 'cmd_orders' },
    ],
  ]);
}

/**
 * 3. Alert for Live High-Intent Visitor / Lead on Checkout Page
 *    Triggered as soon as buyer enters their phone number on /checkout
 */
export async function sendLeadCapturedTelegramAlert(data: OrderAlertData): Promise<boolean> {
  const customerName = data.customer?.fullName?.trim() || 'Checkout Visitor';
  const customerEmail = data.customer?.email?.trim() || 'Typing...';
  const customerPhone = data.customer?.phone?.trim() || 'N/A';
  const items = data.items || [];
  const totalAmount = Number(data.totalAmount || 49);
  const discountedAmount = Math.max(19, Math.round(totalAmount * 0.8));

  const productNamesList =
    items.map((i) => i.title).join(', ') +
    (data.orderBump ? ` + ${data.orderBump.title}` : '');

  const itemsFormatted =
    items.length > 0
      ? items
          .map((it, idx) => `   ${idx + 1}. <b>${escapeHtml(it.title)}</b> — ₹${it.price}`)
          .join('\n')
      : '   • Viral Reels Bundle';

  const text = `🔥👀 <b>LIVE HIGH-INTENT BUYER ON CHECKOUT!</b> 👀🔥
━━━━━━━━━━━━━━━━━━━━━━
<i>A customer just entered their WhatsApp number on the checkout page!</i>

👤 <b>Lead Details:</b>
   • <b>Name:</b> ${escapeHtml(customerName)}
   • <b>WhatsApp / Phone:</b> <code>${escapeHtml(customerPhone)}</code>
   • <b>Email:</b> <code>${escapeHtml(customerEmail)}</code>

🛍️ <b>Cart Items (₹${totalAmount}.00):</b>
${itemsFormatted}

🕒 <b>Time (IST):</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━
👇 <i>If they don't complete payment in 2 minutes, tap below to close the sale on WhatsApp:</i>`;

  const helpMsg = `Hi ${customerName}! 👋\n\nI saw you are checking out *${productNamesList || 'our Viral Reels Bundle'}* (₹${totalAmount}) on *VaultWorld Store*.\n\nDo you need any help with UPI payment or have any questions about the Google Drive download link? Just reply here! 🚀`;

  const discountMsg = `Hi ${customerName}! 🎁 *Special Live Offer from VaultWorld Store!*\n\nComplete your checkout for *${productNamesList || 'Viral Reels Bundle'}* in the next 15 minutes and get *20% OFF* — pay just *₹${discountedAmount}* instead of ₹${totalAmount}!\n\n👉 Checkout now: https://vaultworld.shop/checkout\nOr reply *YES* here for a direct ₹${discountedAmount} UPI link! ⚡`;

  return sendTelegramMessage(text, [
    [{ text: `💬 Message Lead on WhatsApp (${customerPhone})`, url: buildWhatsAppFollowUpUrl(customerPhone, helpMsg) }],
    [{ text: `🎁 Offer 20% Off (₹${discountedAmount}) on WhatsApp`, url: buildWhatsAppFollowUpUrl(customerPhone, discountMsg) }],
  ]);
}

/**
 * 4. Alert for New Product Added
 */
export async function sendProductAddedTelegramAlert(product: {
  id?: string;
  name: string;
  slug?: string;
  price: number;
  regular_price?: number;
  categories?: string[];
  reel_count?: number;
  resolution?: string;
  googleDriveLink?: string;
}): Promise<boolean> {
  const config = await fetchDynamicTelegramConfig().catch(() => null);
  if (config && (config.enabled === false || config.productAlert === false)) {
    console.log('[Telegram Alert] Product upload alert suppressed by store setting (product_alert is disabled).');
    return false;
  }
  const slug = product.slug || '';
  const productUrl = slug ? `https://vaultworld.shop/product/${slug}` : 'https://vaultworld.shop/shop';
  const categoryStr = (product.categories || ['Viral Reels']).join(', ');

  const text = `🚀📦 <b>NEW PRODUCT UPLOADED TO STORE!</b> ✨🔥
━━━━━━━━━━━━━━━━━━━━━━

🏷️ <b>Bundle Name:</b> <b>${escapeHtml(product.name)}</b>
📂 <b>Category:</b> ${escapeHtml(categoryStr)}
💰 <b>Sale Price:</b> <b>₹${product.price}.00</b> (MRP: ₹${product.regular_price || product.price * 5}.00)
🎬 <b>Reels Count:</b> ${product.reel_count || 1000}+ Reels (${escapeHtml(product.resolution || '1080P HD')})
☁️ <b>Google Drive Delivery:</b> ${product.googleDriveLink ? '✅ Configured &amp; Active' : '✅ Ready'}

🕒 <b>Uploaded At (IST):</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━`;

  return sendTelegramMessage(text, [
    [{ text: '🔗 View New Bundle on VaultWorld Store', url: productUrl }],
    [{ text: '📊 Check Today Stats (/today)', callback_data: 'cmd_today' }],
  ]);
}

/**
 * 5. Fetch Live Firestore Orders (excluding deleted/cancelled tombstones) for Bot Commands & Night Summary
 *    100% synced with Admin Panel (store_settings/meta_pixel + status === 'cancelled')
 */
export async function fetchActiveFirestoreOrders(): Promise<any[]> {
  if (!db) return [];
  try {
    const deletedSet = new Set<string>();
    try {
      const [metaPixelSnap, dnpMetaSnap] = await Promise.all([
        getDoc(doc(db, 'store_settings', 'meta_pixel')),
        getDoc(doc(db, 'store_settings', 'dnp_meta')),
      ]);

      for (const snap of [metaPixelSnap, dnpMetaSnap]) {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.maintenance_message) {
            try {
              const parsed = JSON.parse(data.maintenance_message);
              if (Array.isArray(parsed)) {
                parsed.forEach((id: any) => deletedSet.add(String(id)));
              }
            } catch {}
          }
          if (Array.isArray(data?.deleted_order_ids)) {
            data.deleted_order_ids.forEach((id: any) => deletedSet.add(String(id)));
          }
        }
      }
    } catch {}

    const snap = await getDocs(collection(db, 'orders'));
    const orders: any[] = [];

    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const docId = String(docSnap.id);
      const orderNum = String(d.orderNumber || docSnap.id);
      const status = String(d.status || 'pending').toLowerCase();

      // Exclude internal database sync records, test orders, and cancelled/deleted orders
      // so Telegram Bot and Admin Panel show 100% clean, verified customer sales data
      if (
        status === 'cancelled' ||
        deletedSet.has(docId) ||
        deletedSet.has(orderNum) ||
        orderNum.startsWith('VZ-TEST') ||
        orderNum.startsWith('VZ-SYNC') ||
        orderNum.startsWith('VZ-DEL') ||
        orderNum.startsWith('VZ-LISTING') ||
        docId.includes('TEST') ||
        String(d.paymentMethod || '').startsWith('system_sync') ||
        String(d.customer?.email || '').toLowerCase().includes('test') ||
        String(d.customer?.fullName || '').toLowerCase().includes('test') ||
        String(d.customer?.email || '').toLowerCase().includes('sync@')
      ) {
        return;
      }

      orders.push({
        id: docId,
        orderNumber: orderNum,
        customer: d.customer || {},
        items: Array.isArray(d.items) ? d.items : [],
        orderBump: d.orderBump || null,
        totalAmount: Number(d.totalAmount || 0),
        status,
        paymentMethod: d.paymentMethod || 'Cashfree',
        timestampIso: d.timestampIso || new Date().toISOString(),
      });
    });

    orders.sort(
      (a, b) => new Date(b.timestampIso).getTime() - new Date(a.timestampIso).getTime()
    );
    return orders;
  } catch (err) {
    console.warn('Error fetching orders for Telegram bot:', err);
    return [];
  }
}

export function getCommandCenterButtons(): Array<Array<TelegramInlineButton>> {
  return [
    [
      { text: '📊 Today Report (/today)', callback_data: 'cmd_today' },
      { text: '✅ Paid Orders (/orders)', callback_data: 'cmd_orders' },
    ],
    [
      { text: '⏳ Abandoned Leads (/pending)', callback_data: 'cmd_pending' },
      { text: '🌙 Night Summary (/summary)', callback_data: 'cmd_summary' },
    ],
    [{ text: '🛍️ Open VaultWorld Store', url: 'https://vaultworld.shop' }],
  ];
}

function isPendingOrAbandonedStatus(status: string): boolean {
  return status === 'pending' || status === 'processing' || status === 'failed';
}

/**
 * 6. Interactive Command & Night Summary Generator
 *    Modes: 'today' | 'orders' | 'pending' | 'night_summary' | 'help'
 */
export async function sendStoreCommandReport(
  mode: 'today' | 'orders' | 'pending' | 'night_summary' | 'help'
): Promise<boolean> {
  if (mode === 'night_summary') {
    const config = await fetchDynamicTelegramConfig().catch(() => null);
    if (config && (config.enabled === false || config.dailySummaryAlert === false)) {
      console.log('[Telegram Alert] Night summary alert skipped (daily_summary_alert is disabled).');
      return false;
    }
  }

  if (mode === 'help') {
    const helpText = `🤖 <b>VAULTWORLD STORE COMMAND CENTER</b> ⚡
━━━━━━━━━━━━━━━━━━━━━━
Welcome <b>Rajat Shakya</b>! Use these commands anytime to manage your store directly from Telegram:

📊 <b>/today</b> — Live Store Report (Synced 100% with Admin Panel)
✅ <b>/orders</b> — Paid orders + 1-click Google Drive WhatsApp buttons
⏳ <b>/pending</b> — Abandoned / Pending checkouts + 1-click 20% discount recovery
🌙 <b>/summary</b> — Full Daily Night Report + All-Time store performance
❓ <b>/help</b> — Show this command menu

<i>💡 Or simply tap any quick-action button below:</i>`;

    return sendTelegramMessage(helpText, getCommandCenterButtons());
  }

  const orders = await fetchActiveFirestoreOrders();
  const todayKey = getIstDateKey();

  const paidOrders = orders.filter((o) => o.status === 'completed');
  const pendingOrders = orders.filter((o) => isPendingOrAbandonedStatus(o.status));
  const verifiedCustomers = new Set(
    paidOrders.map((o) => o.customer?.email).filter(Boolean)
  ).size;

  const todayOrders = orders.filter((o) => getIstDateKey(o.timestampIso) === todayKey);
  const todayPaid = todayOrders.filter((o) => o.status === 'completed');
  const todayPending = todayOrders.filter((o) => isPendingOrAbandonedStatus(o.status));

  const todayRevenue = todayPaid.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
  const allTimeRevenue = paidOrders.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);

  // Compute Top Selling Bundle (strictly from paid orders, matching Admin Panel)
  const bundleCounts = new Map<string, { count: number; revenue: number }>();
  paidOrders.forEach((o) => {
    (o.items || []).forEach((it: any) => {
      const title = it.title || it.name || 'Viral Reels Bundle';
      const cur = bundleCounts.get(title) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(it.price || o.totalAmount || 0);
      bundleCounts.set(title, cur);
    });
  });

  let topBundleText = 'No bundle sales recorded yet';
  if (bundleCounts.size > 0) {
    const sorted = Array.from(bundleCounts.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
    const [topName, stats] = sorted[0];
    topBundleText = `${escapeHtml(topName)} (${stats.count} sold — ₹${stats.revenue})`;
  }

  if (mode === 'today') {
    const convRate =
      orders.length > 0
        ? `${Math.round((paidOrders.length / orders.length) * 100)}%`
        : '0%';

    const text = `📊⚡ <b>LIVE STORE REPORT (${escapeHtml(todayKey)})</b> ⚡📊
<i>(100% Synced with Admin Panel)</i>
━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Net Revenue:</b> <b>₹${allTimeRevenue}.00</b> <i>(Today: ₹${todayRevenue}.00)</i>
✅ <b>Total Paid Orders:</b> <b>${paidOrders.length}</b> <i>(Today: ${todayPaid.length})</i>
👥 <b>Active Customers:</b> <b>${verifiedCustomers}</b>
⏳ <b>Pending / Abandoned:</b> <b>${pendingOrders.length}</b> <i>(Today: ${todayPending.length})</i>
📈 <b>Conversion Rate:</b> <b>${convRate}</b>

🏆 <b>Top Selling Bundle:</b>
   • ${topBundleText}

🕒 <b>Updated (IST):</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━`;

    return sendTelegramMessage(text, getCommandCenterButtons());
  }

  if (mode === 'orders') {
    const recentPaid = paidOrders.slice(0, 5);
    const listText =
      recentPaid.length > 0
        ? recentPaid
            .map((o, i) => {
              const name = o.customer?.fullName || 'Customer';
              const phone = o.customer?.phone || 'N/A';
              const bundle = o.items?.[0]?.title || 'Viral Reels Bundle';
              return `${i + 1}. <b>#${escapeHtml(o.orderNumber)}</b> — <b>₹${o.totalAmount}</b>\n   👤 ${escapeHtml(name)} (<code>${escapeHtml(phone)}</code>)\n   📦 ${escapeHtml(bundle)}`;
            })
            .join('\n\n')
        : '<i>No completed orders found yet.</i>';

    const buttons: Array<Array<TelegramInlineButton>> = [];
    recentPaid.slice(0, 3).forEach((o) => {
      const phone = o.customer?.phone || '';
      const name = o.customer?.fullName || 'Customer';
      const firstItem = o.items?.[0] || { title: 'Viral Reels Bundle' };
      const driveLink = resolveDriveLinkForItem(firstItem);
      const msg = `Hi ${name}! 🎉 Here is your Google Drive download link for Order #${o.orderNumber} (*${firstItem.title}*):\n📂 ${driveLink}\n\nThank you for shopping at VaultWorld Store! 🚀`;
      buttons.push([
        {
          text: `📂 Send Drive Link: #${o.orderNumber} (${name})`,
          url: buildWhatsAppFollowUpUrl(phone, msg),
        },
      ]);
    });

    buttons.push(...getCommandCenterButtons());

    const text = `✅📦 <b>RECENT PAID ORDERS (Total: ${paidOrders.length})</b> 📦✅
━━━━━━━━━━━━━━━━━━━━━━
💵 <b>Net Revenue:</b> <b>₹${allTimeRevenue}.00</b>

${listText}

━━━━━━━━━━━━━━━━━━━━━━
👇 <i>Tap any order button below to send its Google Drive link on WhatsApp:</i>`;

    return sendTelegramMessage(text, buttons);
  }

  if (mode === 'pending') {
    const recentPending = pendingOrders.slice(0, 5);
    const listText =
      recentPending.length > 0
        ? recentPending
            .map((o, i) => {
              const name = o.customer?.fullName || 'Customer';
              const phone = o.customer?.phone || 'N/A';
              const bundle = o.items?.[0]?.title || 'Viral Reels Bundle';
              const disc = Math.max(19, Math.round(Number(o.totalAmount || 49) * 0.8));
              const statusTag = o.status === 'failed' ? 'ABANDONED' : 'PENDING';
              return `${i + 1}. <b>#${escapeHtml(o.orderNumber)}</b> [${statusTag}] — <b>₹${o.totalAmount}</b> (20% Off: ₹${disc})\n   👤 ${escapeHtml(name)} (<code>${escapeHtml(phone)}</code>)\n   📦 ${escapeHtml(bundle)}`;
            })
            .join('\n\n')
        : '🎉 <i>Zero abandoned checkouts right now!</i>';

    const buttons: Array<Array<TelegramInlineButton>> = [];
    recentPending.slice(0, 3).forEach((o) => {
      const phone = o.customer?.phone || '';
      const name = o.customer?.fullName || 'Customer';
      const bundle = o.items?.[0]?.title || 'Viral Reels Bundle';
      const total = Number(o.totalAmount || 49);
      const disc = Math.max(19, Math.round(total * 0.8));
      const msg = `Hi ${name}! 🎁 Complete your VaultWorld Store order (#${o.orderNumber}) for *${bundle}* in the next 15 mins and get *20% OFF* — pay just *₹${disc}* instead of ₹${total}!\n\n👉 https://vaultworld.shop/checkout\nReply *YES* for a direct ₹${disc} UPI link! 🚀`;
      buttons.push([
        {
          text: `🎁 Recover #${o.orderNumber} (${name} • Offer ₹${disc})`,
          url: buildWhatsAppFollowUpUrl(phone, msg),
        },
      ]);
    });

    buttons.push(...getCommandCenterButtons());

    const text = `⏳🚨 <b>ABANDONED / PENDING CHECKOUTS (${pendingOrders.length})</b> 🚨⏳
━━━━━━━━━━━━━━━━━━━━━━

${listText}

━━━━━━━━━━━━━━━━━━━━━━
👇 <i>Tap any lead below to send an instant 20% discount recovery offer on WhatsApp:</i>`;

    return sendTelegramMessage(text, buttons);
  }

  // mode === 'night_summary'
  const potentialAbandonedValue = pendingOrders.reduce(
    (acc, o) => acc + Number(o.totalAmount || 0),
    0
  );

  const text = `🌙📊 <b>DAILY STORE SUMMARY — VAULTWORLD</b> 📊🌙
<i>(100% Synced with Admin Panel)</i>
━━━━━━━━━━━━━━━━━━━━━━
📅 <b>Date (IST):</b> ${escapeHtml(todayKey)}

🔥 <b>TODAY'S PERFORMANCE:</b>
   • 💰 <b>Today's Revenue:</b> <b>₹${todayRevenue}.00</b>
   • ✅ <b>Completed Sales Today:</b> <b>${todayPaid.length} Orders</b>
   • ⏳ <b>Abandoned / Pending Today:</b> <b>${todayPending.length} Leads</b>

🏦 <b>ADMIN PANEL TOTALS:</b>
   • 💎 <b>Net Revenue:</b> <b>₹${allTimeRevenue}.00</b>
   • 📦 <b>Total Paid Orders:</b> <b>${paidOrders.length}</b>
   • 👥 <b>Active Customers:</b> <b>${verifiedCustomers}</b>
   • ⏳ <b>Pending / Abandoned:</b> <b>${pendingOrders.length}</b> (₹${potentialAbandonedValue} recoverable)
   • 🏆 <b>Top Bundle:</b> ${topBundleText}

🕒 <b>Generated At:</b> ${escapeHtml(getIstTimestamp())}
━━━━━━━━━━━━━━━━━━━━━━
<i>Tap ⏳ Abandoned Leads below to follow up with pending buyers on WhatsApp!</i> 🚀`;

  return sendTelegramMessage(text, getCommandCenterButtons());
}
