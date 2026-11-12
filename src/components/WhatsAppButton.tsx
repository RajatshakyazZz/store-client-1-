'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, Sparkles, CheckCheck } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useCart } from '@/context/CartContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import {
  HARDCODED_SUPPORT_WHATSAPP,
  formatWhatsAppPhoneDigits,
  buildSupportWhatsAppUrl,
} from '@/lib/whatsappSupport';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  defaultMessage?: string;
  storeName?: string;
  productTitle?: string;
  positionClassName?: string;
  alwaysDirectOpen?: boolean;
  isResellerPage?: boolean;
}

export default function WhatsAppButton({
  phoneNumber,
  defaultMessage,
  storeName,
  productTitle,
  positionClassName,
  alwaysDirectOpen = false,
  isResellerPage = false,
}: WhatsAppButtonProps) {
  const pathname = usePathname();
  const { isCartOpen } = useCart();
  const { settings } = useStoreSettings();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show friendly floating tooltip after 3 seconds on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Hide when disabled in Admin Panel (unless overridden on reseller subpage), or on checkout / order success
  const isHidden =
    (!isResellerPage && settings?.whatsappButtonEnabled === false) ||
    isCartOpen ||
    (!isResellerPage && pathname?.startsWith('/r/')) ||
    pathname?.includes('/checkout') ||
    pathname?.includes('/order-success') ||
    pathname?.includes('/order-status');

  if (isHidden) {
    return null;
  }

  // Hardcode store support WhatsApp number (9142408286); reseller landing pages can override via phoneNumber prop
  const cleanPhone =
    isResellerPage && phoneNumber
      ? formatWhatsAppPhoneDigits(phoneNumber)
      : HARDCODED_SUPPORT_WHATSAPP;

  const effectiveStoreName = storeName || settings?.storeName || 'VaultWorld Store';
  const effectiveDefaultMessage = defaultMessage || settings?.whatsappDefaultMessage;

  // Determine intelligent positioning based on current route
  const hasMobileBottomNav =
    !pathname?.startsWith('/r/') &&
    pathname !== '/r' &&
    !pathname?.startsWith('/earn') &&
    pathname !== '/earn' &&
    !pathname?.includes('/checkout') &&
    !pathname?.includes('/order-success');

  // If on product page, float above the sticky Buy Now bar; otherwise above MobileBottomNav
  const isProductPage = pathname?.startsWith('/product/');
  const defaultPosition = isProductPage
    ? 'bottom-[144px] right-3 sm:bottom-6 sm:right-6'
    : hasMobileBottomNav
      ? 'bottom-20 right-4 sm:bottom-6 sm:right-6'
      : 'bottom-20 md:bottom-6 right-4 sm:right-6';

  const position = positionClassName || defaultPosition;

  const getTargetUrl = (messageText?: string) => {
    const textToSend =
      messageText ||
      customMsg.trim() ||
      effectiveDefaultMessage ||
      (productTitle
        ? `Hi ${effectiveStoreName}, I have a question regarding "${productTitle}". Can you assist me?`
        : `Hi ${effectiveStoreName}, I am browsing your store and need quick assistance with viral reels bundles.`);

    return buildSupportWhatsAppUrl(textToSend, cleanPhone);
  };

  const handleOpenWhatsApp = (specificText?: string) => {
    track('whatsapp_click', {
      phone: cleanPhone,
      product: productTitle || 'Store General',
      path: pathname,
    });

    const url = getTargetUrl(specificText);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setIsOpen(false);
    setShowTooltip(false);
  };

  const handleFloatingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasInteracted(true);
    setShowTooltip(false);

    if (alwaysDirectOpen) {
      handleOpenWhatsApp();
      return;
    }

    // Toggle realistic chat preview modal
    setIsOpen((prev) => !prev);
  };

  const QUICK_PROMPTS = [
    { label: '⚡ How to download reels after purchase?', text: 'Hi! How do I get Google Drive access immediately after paying?' },
    { label: '📦 Is commercial & resale license included?', text: 'Hi! Can I resell or post these reels on Instagram/YouTube without copyright issues?' },
    { label: '🤝 Help me with Resell & Earn setup', text: 'Hi! I want to earn with VaultWorld Resell & Earn. How do I start?' },
  ];

  return (
    <div className={`fixed z-[9999] pointer-events-auto ${position} print:hidden select-none font-sans`}>
      {/* 1. REALISTIC WHATSAPP CHAT POPUP WINDOW */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="WhatsApp Live Chat"
          className="absolute bottom-16 right-0 w-[320px] sm:w-[350px] max-w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl shadow-2xl bg-white border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ boxShadow: '0 20px 45px -10px rgba(18, 140, 126, 0.3), 0 8px 20px -6px rgba(0,0,0,0.15)' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] px-4 py-3.5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 p-0.5 flex items-center justify-center font-black text-white text-sm shadow-inner overflow-hidden">
                  <img
                    src="/logo.webp?v=2"
                    alt="Support"
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs font-black">VW</span>
                </div>
                {/* Active online pulse dot */}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] border-2 border-[#075E54] rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-extrabold tracking-tight leading-tight">{effectiveStoreName}</h4>
                  <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">Verified</span>
                </div>
                <p className="text-[11px] text-white/80 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block animate-pulse" />
                  Typically replies in ~1 minute
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 transition-colors"
              aria-label="Close WhatsApp chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Bubble Area (Realistic WhatsApp Wallpaper Texture) */}
          <div
            className="p-3.5 space-y-3 max-h-[340px] overflow-y-auto bg-[#E5DDD5]/40"
            style={{
              backgroundImage: 'radial-gradient(#128C7E 0.75px, transparent 0.75px)',
              backgroundSize: '16px 16px',
            }}
          >
            {/* Date Pill */}
            <div className="text-center">
              <span className="text-[10px] font-bold text-slate-500 bg-white/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-xs">
                Today
              </span>
            </div>

            {/* Support Message Bubble */}
            <div className="flex flex-col items-start max-w-[90%]">
              <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-sm border border-slate-200/50 text-[#111B21]">
                <p className="text-xs leading-relaxed font-medium">
                  👋 <strong className="font-bold text-[#075E54]">Namaste!</strong> Welcome to {effectiveStoreName}.
                </p>
                <p className="text-xs leading-relaxed mt-1 text-slate-700">
                  {productTitle ? (
                    <>
                      Interested in <strong className="text-slate-900 font-bold">{productTitle}</strong>? Have any questions about commercial rights or instant Google Drive access?
                    </>
                  ) : (
                    settings?.whatsappPopupText || 'Need assistance with our viral reels bundles, instant download links, or Resell & Earn? We are live 24/7!'
                  )}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 font-semibold">
                  <span>Just now</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                </div>
              </div>
            </div>

            {/* Quick Inquiry Chips */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Quick Questions:</p>
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenWhatsApp(prompt.text)}
                  className="w-full text-left text-[11px] font-semibold text-slate-700 bg-white/95 hover:bg-emerald-50 hover:text-[#075E54] border border-slate-200/70 hover:border-emerald-300 rounded-xl px-2.5 py-2 transition-all shadow-xs flex items-center justify-between group active:scale-[0.98]"
                >
                  <span className="line-clamp-1">{prompt.label}</span>
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-[#25D366] shrink-0 ml-1 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-3 bg-white border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your question..."
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenWhatsApp();
                }}
                className="flex-1 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#25D366] rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 outline-none transition-all"
              />
              <button
                onClick={() => handleOpenWhatsApp()}
                className="w-9 h-9 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] active:scale-95 text-white flex items-center justify-center transition-all shrink-0 shadow-sm"
                title="Send message on WhatsApp"
              >
                <Send className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>

            <button
              onClick={() => handleOpenWhatsApp()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:brightness-105 active:scale-[0.98] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <WhatsAppSvgIcon className="w-4 h-4 fill-current" />
              <span>Continue to WhatsApp Web / App</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. FLOATING PROMO CALLOUT / TOOLTIP */}
      {!isOpen && showTooltip && !hasInteracted && (
        <div
          onClick={handleFloatingClick}
          className="absolute bottom-16 right-0 mb-1 w-64 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-emerald-100 flex items-start gap-2.5 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 group hover:shadow-2xl transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
            <WhatsAppSvgIcon className="w-4 h-4 fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-900">Need Instant Help?</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(false);
                  setHasInteracted(true);
                }}
                className="text-slate-400 hover:text-slate-600 -mr-1 -mt-1 p-1"
                aria-label="Dismiss tooltip"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
              Chat directly with our support team on WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* 3. MAIN REALISTIC FLOATING WHATSAPP BUTTON */}
      <button
        onClick={handleFloatingClick}
        aria-label="Chat on WhatsApp"
        className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#128C7E] to-[#25D366] text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none cursor-pointer"
        style={{
          boxShadow: '0 8px 24px -4px rgba(37, 211, 102, 0.45), 0 4px 10px -2px rgba(0,0,0,0.1)',
        }}
      >
        {/* Glowing pulse rings */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366]/30 animate-ping opacity-75 pointer-events-none" />
        <span className="absolute -inset-0.5 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* WhatsApp Official SVG Icon */}
        <WhatsAppSvgIcon className="w-7 h-7 sm:w-8 sm:h-8 fill-current drop-shadow-md z-10 transition-transform group-hover:rotate-6" />

        {/* Online Status Dot Badge */}
        <span
          className="absolute top-0 right-0 w-4 h-4 bg-[#25D366] border-2 border-white rounded-full flex items-center justify-center z-20 shadow-xs"
          title="Support is online"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </span>
      </button>
    </div>
  );
}

export function WhatsAppSvgIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
