'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import CartDrawer from '@/components/CartDrawer';
import FreeBundlesModal from '@/components/FreeBundlesModal';
import ViralBundlesModal from '@/components/ViralBundlesModal';
import WhatsAppButton from '@/components/WhatsAppButton';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import MaintenanceGate from '@/components/MaintenanceGate';
import { CartProvider } from '@/context/CartContext';
import { StoreSettingsProvider, useStoreSettings } from '@/context/StoreSettingsContext';
import { ResellerAuthProvider } from '@/context/ResellerAuthContext';

function StoreLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useStoreSettings();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const isAuth =
        localStorage.getItem('rb_portal_api_key') === 'vaultworld_admin_token' ||
        Boolean(localStorage.getItem('rb_portal_admin_profile'));

      const urlParams = new URLSearchParams(window.location.search);
      const hasPreviewParam =
        urlParams.get('preview') === 'admin' ||
        urlParams.get('admin') === 'true';

      setIsAdminLoggedIn(isAuth || hasPreviewParam);
    }
  }, []);

  const isMaintenance = settings?.siteMode?.mode === 'MAINTENANCE';
  const isAllowedPathDuringMaintenance =
    pathname === '/my-order' || pathname?.startsWith('/my-order/');

  // When maintenance is active and visitor is NOT an authenticated admin
  if (isMounted && isMaintenance && !isAdminLoggedIn && !isAllowedPathDuringMaintenance) {
    return (
      <MaintenanceGate
        message={settings?.siteMode?.maintenance_message}
        storeName={settings?.storeName}
        supportEmail={settings?.supportEmail}
      />
    );
  }

  return (
    <ResellerAuthProvider>
      <CartProvider>
        {isMounted && isMaintenance && isAdminLoggedIn && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black text-center sticky top-0 z-[9999] shadow-md flex items-center justify-center gap-2">
            <span>⚠️ MAINTENANCE MODE IS ACTIVE: Public visitors currently see the maintenance gate. You are viewing as Administrator.</span>
            <a
              href="/asdf/site-mode"
              className="underline hover:text-white transition-colors ml-1 font-bold"
            >
              Site Mode Settings →
            </a>
          </div>
        )}
        <Header />
        <main className="flex-grow pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </main>
        <Footer />
        <CartDrawer />
        <FreeBundlesModal />
        <ViralBundlesModal />
        <MobileBottomNav />
        <WhatsAppButton />
        <CookieConsentBanner />
      </CartProvider>
    </ResellerAuthProvider>
  );
}

export default function StoreLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/asdf');

  if (isAdminRoute) {
    return (
      <div className="admin-root min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <StoreSettingsProvider>
      <StoreLayoutInner>{children}</StoreLayoutInner>
    </StoreSettingsProvider>
  );
}
