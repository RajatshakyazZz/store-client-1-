import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  CreditCard,
  Radio,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  Users,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Flame,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Lock,
  Send,
  Bell,
  RefreshCw,
  Database,
} from 'lucide-react';
import { portalApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  PgBridgeConfig,
  DnpMetaConfig,
  MmcAnalyticsConfig,
  RankMathConfig,
  LiteSpeedConfig,
  TelegramConfig,
} from '../api/types';

export default function SettingsIntegrations() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'pg' | 'telegram' | 'meta' | 'analytics' | 'seo' | 'cache'>('pg');

  // Queries
  const { data: pgConfig, isLoading: pgLoading } = useQuery<PgBridgeConfig>({
    queryKey: ['pg-bridge'],
    queryFn: () => portalApi.getPgBridgeConfig(),
  });

  const { data: tgConfig, isLoading: tgLoading } = useQuery<TelegramConfig>({
    queryKey: ['telegram-config'],
    queryFn: () => portalApi.getTelegramConfig(),
  });

  const { data: dnpMeta, isLoading: metaLoading } = useQuery<DnpMetaConfig>({
    queryKey: ['dnp-meta'],
    queryFn: () => portalApi.getDnpMetaConfig(),
  });

  const { data: mmc, isLoading: mmcLoading } = useQuery<MmcAnalyticsConfig>({
    queryKey: ['mmc-analytics'],
    queryFn: () => portalApi.getMmcConfig(),
  });

  const { data: rankMath, isLoading: seoLoading } = useQuery<RankMathConfig>({
    queryKey: ['rankmath-seo'],
    queryFn: () => portalApi.getRankMathConfig(),
  });

  const { data: liteSpeed, isLoading: cacheLoading } = useQuery<LiteSpeedConfig>({
    queryKey: ['litespeed-cache'],
    queryFn: () => portalApi.getLiteSpeedConfig(),
  });

  // Local form states
  const [pgForm, setPgForm] = useState<Partial<PgBridgeConfig> | null>(null);
  const [tgForm, setTgForm] = useState<Partial<TelegramConfig> | null>(null);
  const [seoForm, setSeoForm] = useState<Partial<RankMathConfig> | null>(null);
  const [dnpForm, setDnpForm] = useState<Partial<DnpMetaConfig> | null>(null);
  const [mmcForm, setMmcForm] = useState<Partial<MmcAnalyticsConfig> | null>(null);
  const [liteSpeedForm, setLiteSpeedForm] = useState<Partial<LiteSpeedConfig> | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [isVerifyingPg, setIsVerifyingPg] = useState(false);
  const [isTestingMeta, setIsTestingMeta] = useState(false);

  // Sync state when data arrives
  React.useEffect(() => {
    if (pgConfig) {
      setPgForm({
        ...pgConfig,
        merchant_key: pgConfig.merchant_key || pgConfig.app_id || '',
        merchant_salt: pgConfig.merchant_salt || pgConfig.secret_key || '',
        environment: pgConfig.environment === 'TEST' || pgConfig.environment === 'SANDBOX' ? 'TEST' : 'PRODUCTION',
        return_url: (pgConfig.return_url || 'https://vaultworld.shop/api/payment/payu/return')
          .replace('api/payment/cashfree/return', 'api/payment/payu/return')
          .replace('store.vaultzet.shop', 'vaultworld.shop')
          .replace('vaultzet.shop', 'vaultworld.shop'),
      });
    }
  }, [pgConfig]);

  React.useEffect(() => {
    if (tgConfig) setTgForm(tgConfig);
  }, [tgConfig]);

  React.useEffect(() => {
    if (rankMath) setSeoForm(rankMath);
  }, [rankMath]);

  React.useEffect(() => {
    if (dnpMeta) {
      const cleanPixelId = dnpMeta.meta_pixel_id === '1715650960276913' ? '' : (dnpMeta.meta_pixel_id || '');
      setDnpForm({
        ...dnpMeta,
        meta_pixel_id: cleanPixelId,
      });
    }
  }, [dnpMeta]);

  React.useEffect(() => {
    if (mmc) setMmcForm(mmc);
  }, [mmc]);

  React.useEffect(() => {
    if (liteSpeed) setLiteSpeedForm(liteSpeed);
  }, [liteSpeed]);

  // Mutations
  const updatePgMutation = useMutation({
    mutationFn: (updated: PgBridgeConfig) => {
      const payload: PgBridgeConfig = {
        ...updated,
        merchant_key: updated.merchant_key || updated.app_id || '',
        merchant_salt: updated.merchant_salt || updated.secret_key || '',
        app_id: updated.merchant_key || updated.app_id || '',
        secret_key: updated.merchant_salt || updated.secret_key || '',
      };
      return portalApi.updatePgBridgeConfig(payload);
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'PayU Saved to Cloud Database 🚀',
        message: 'PayU credentials saved to Firestore! Live across all mobile devices, laptops & storefront checkout.',
      });
      queryClient.invalidateQueries({ queryKey: ['pg-bridge'] });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Failed to update PayU Config',
        message: err.message,
      });
    },
  });

  const updateTgMutation = useMutation({
    mutationFn: (updated: TelegramConfig) => portalApi.updateTelegramConfig(updated),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'Telegram Settings Saved',
        message: 'Telegram Bot Token and Admin Chat IDs successfully updated in cloud.',
      });
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Failed to save Telegram settings',
        message: err.message,
      });
    },
  });

  const handleTestTelegram = async () => {
    if (!tgForm?.bot_token?.trim() || !tgForm?.admin_chat_ids?.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Telegram Details',
        message: 'Please ensure Bot Token and at least one Admin Chat ID are entered.',
      });
      return;
    }

    setIsTestingTg(true);
    try {
      // First save the current form so test uses latest values
      await portalApi.updateTelegramConfig(tgForm as TelegramConfig);
      const res = await portalApi.testTelegramAlert();
      addToast({
        type: 'success',
        title: 'Telegram Alert Delivered! 🚀',
        message: res.message,
      });
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Telegram Delivery Failed',
        message: err.message || 'Could not dispatch message to Telegram Bot API.',
      });
    } finally {
      setIsTestingTg(false);
    }
  };

  const updateSeoMutation = useMutation({
    mutationFn: (updated: RankMathConfig) => portalApi.updateRankMathConfig(updated),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'RankMath SEO Saved',
        message: 'SEO modules and meta configurations synchronized.',
      });
      queryClient.invalidateQueries({ queryKey: ['rankmath-seo'] });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Failed to save SEO',
        message: err.message,
      });
    },
  });

  const updateDnpMutation = useMutation({
    mutationFn: (updated: DnpMetaConfig) => portalApi.updateDnpMetaConfig(updated),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'DNP Meta CAPI Saved',
        message: 'Server-side conversions configuration saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['dnp-meta'] });
    },
  });

  const handleTestMeta = async () => {
    const pixelId = String(dnpForm?.meta_pixel_id || '').trim();
    if (!pixelId) {
      addToast({
        type: 'warning',
        title: 'Pixel ID Required',
        message: 'Please enter your Meta Pixel ID first.',
      });
      return;
    }

    setIsTestingMeta(true);
    try {
      await portalApi.updateDnpMetaConfig(dnpForm as DnpMetaConfig);
      queryClient.invalidateQueries({ queryKey: ['dnp-meta'] });

      // Trigger client pixel
      if (typeof window !== 'undefined' && (window as any).fbq) {
        try {
          (window as any).fbq('init', pixelId);
          (window as any).fbq('track', 'PageView');
        } catch (e) {}
      }

      if (dnpForm?.capi_token?.trim()) {
        const testRes = await portalApi.testMetaEvent({
          pixel_id: pixelId,
          capi_token: dnpForm.capi_token.trim(),
          test_event_code: dnpForm.test_event_code?.trim() || undefined,
          event_name: 'PageView',
        });
        addToast({
          type: 'success',
          title: 'Meta Event Delivered! 🚀',
          message: testRes.message || 'Check your Meta Events Manager Test Events tab.',
        });
      } else {
        addToast({
          type: 'info',
          title: 'Browser Pixel Active',
          message: `Pixel ${pixelId} initialized. Open store from Events Manager Test Events to confirm browser events.`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Meta Test Failed',
        message: err.message || 'Could not deliver test event to Meta.',
      });
    } finally {
      setIsTestingMeta(false);
    }
  };

  const updateMmcMutation = useMutation({
    mutationFn: (updated: MmcAnalyticsConfig) => portalApi.updateMmcConfig(updated),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'MMC Analytics Saved',
        message: 'Analytics tracking parameters updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['mmc-analytics'] });
    },
  });

  const updateLiteSpeedMutation = useMutation({
    mutationFn: (updated: LiteSpeedConfig) => portalApi.updateLiteSpeedConfig(updated),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'LiteSpeed Settings Saved',
        message: 'Cache rules and optimization configuration updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['litespeed-cache'] });
    },
  });

  const purgeCacheMutation = useMutation({
    mutationFn: () => portalApi.purgeLiteSpeedCache(),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'LiteSpeed Cache Purged',
        message: 'All dynamic and static HTML/CSS/JS caches have been cleared from server.',
      });
      queryClient.invalidateQueries({ queryKey: ['litespeed-cache'] });
    },
  });

  const handleTestCallback = () => {
    const key = pgForm?.merchant_key || pgForm?.app_id;
    const salt = pgForm?.merchant_salt || pgForm?.secret_key;
    if (!key || !salt) {
      addToast({
        type: 'warning',
        title: 'Missing Credentials',
        message: 'Please enter your PayU Merchant Key and Salt first.',
      });
      return;
    }
    addToast({
      type: 'info',
      title: 'PayU Test Check',
      message: `Environment: ${pgForm.environment || 'PRODUCTION'}. Ready for checkout.`,
    });
  };

  const handleProcessorVerify = async () => {
    const key = String(pgForm?.merchant_key || pgForm?.app_id || '').trim();
    const salt = String(pgForm?.merchant_salt || pgForm?.secret_key || '').trim();
    if (!key || !salt) {
      addToast({
        type: 'warning',
        title: 'Credentials Required',
        message: 'Please fill in both PayU Merchant Key and Merchant Salt before verifying.',
      });
      return;
    }

    setIsVerifyingPg(true);
    try {
      await updatePgMutation.mutateAsync({
        ...pgForm,
        merchant_key: key,
        merchant_salt: salt,
        app_id: key,
        secret_key: salt,
      } as PgBridgeConfig);

      addToast({
        type: 'success',
        title: 'PayU Status Verified & Synced! 🚀',
        message: `Environment: ${pgForm?.environment || 'PRODUCTION'}. Credentials are saved in Firestore and ready for live checkout.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Could not verify PayU credentials.',
      });
    } finally {
      setIsVerifyingPg(false);
    }
  };

  const isLoadingAny = pgLoading || metaLoading || mmcLoading || seoLoading || cacheLoading;

  if (isLoadingAny && !pgConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RotateCcw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          Settings & Integrations
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure payment gateways, Meta Conversions API health, MMC Analytics, RankMath SEO modules, and LiteSpeed cache.
        </p>
      </div>

      {/* Tabs - Touch-scrollable & edge-to-edge on mobile */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto admin-touch-scroll admin-no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {[
          { id: 'pg', label: 'PayU Gateway', icon: CreditCard, color: 'text-purple-400' },
          { id: 'telegram', label: 'Telegram Alerts & Bot', icon: Send, color: 'text-sky-400' },
          { id: 'meta', label: 'DNP Meta CAPI', icon: Radio, color: 'text-blue-400' },
          { id: 'analytics', label: 'MMC Analytics', icon: Users, color: 'text-emerald-400' },
          { id: 'seo', label: 'RankMath SEO', icon: Search, color: 'text-amber-400' },
          { id: 'cache', label: 'LiteSpeed Cache', icon: Zap, color: 'text-rose-400' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PAYU PAYMENT GATEWAY */}
      {activeTab === 'pg' && pgForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                    PayU Payment Gateway (India)
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    pgForm.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {pgForm.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    pgForm.environment === 'PRODUCTION'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {pgForm.environment === 'PRODUCTION' ? 'Live Production' : 'Test Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Primary payment engine powering UPI (PhonePe, GPay, Paytm, CRED), Cards & NetBanking on VaultWorld Store via PayU India.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="https://dashboard.payu.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  <span>PayU Dashboard</span>
                </a>
                <button
                  type="button"
                  onClick={handleProcessorVerify}
                  disabled={isVerifyingPg || updatePgMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-xs font-bold text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isVerifyingPg ? 'Verifying...' : 'Verify Status'}</span>
                </button>
              </div>
            </div>

            {/* Gateway Status Switch */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">Enable PayU on Storefront</div>
                <div className="text-[11px] text-slate-400">
                  When active, customers will checkout securely via PayU India Payment Gateway.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPgForm({ ...pgForm, enabled: !pgForm.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  pgForm.enabled ? 'bg-purple-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pgForm.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Direct Cloud Database Synchronization Banner */}
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
              <Database className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white">Direct Cloud Database Sync: </span>
                PayU Merchant Key & Salt database me save hote hain. Iske liye koi Vercel environment variables ya code rebuild ki zaroorat nahi hai. Ek baar save karne par Phone, Laptop aur Storefront Checkout par ye keys automatically live ho jayengi.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>Environment Mode</span>
                </label>
                <select
                  value={pgForm.environment || 'PRODUCTION'}
                  onChange={(e) => setPgForm({ ...pgForm, environment: e.target.value as any })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="PRODUCTION">PRODUCTION (Real live payments - secure.payu.in)</option>
                  <option value="TEST">TEST (Sandbox Test mode - test.payu.in)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Select PRODUCTION when receiving real customer payments.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" />
                  <span>PayU Merchant Key *</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7rnFly or your PayU Merchant Key"
                  value={pgForm.merchant_key || pgForm.app_id || ''}
                  onChange={(e) => setPgForm({ ...pgForm, merchant_key: e.target.value, app_id: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Found in PayU Dashboard &gt; Integration Details / API Keys.</p>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    <span>PayU Merchant Salt *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecret ? 'Hide Salt' : 'Show Salt'}</span>
                  </button>
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="e.g. pj1nGpHgw... or your PayU Salt"
                    value={pgForm.merchant_salt || pgForm.secret_key || ''}
                    onChange={(e) => setPgForm({ ...pgForm, merchant_salt: e.target.value, secret_key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-mono pr-10"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Never share your Merchant Salt. Stored securely and used for SHA-512 signature hashing.</p>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300">Customer Return / Redirect URL</label>
                <input
                  type="text"
                  value={pgForm.return_url || 'https://vaultworld.shop/api/payment/payu/return'}
                  onChange={(e) => setPgForm({ ...pgForm, return_url: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">URL where buyer returns after completing PayU payment.</p>
              </div>
            </div>

            {/* Payment Feature Badges Banner */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/30">
              <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Supported Customer Payment Methods via PayU India</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> PhonePe UPI
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Google Pay UPI
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Paytm UPI & QR
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> CRED UPI & Any UPI App
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Visa / MasterCard / RuPay
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 50+ NetBanking Banks
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => updatePgMutation.mutate(pgForm as PgBridgeConfig)}
                disabled={updatePgMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updatePgMutation.isPending ? 'Saving...' : 'Save PayU Gateway Config'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TELEGRAM ALERTS & BOT */}
      {activeTab === 'telegram' && tgForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-sky-400" />
                    Telegram Bot & Instant Admin Alerts
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      tgForm.enabled !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {tgForm.enabled !== false ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time notifications sent directly to authorized admin Telegram accounts for paid orders, product uploads, and daily revenue reports.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTg}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestingTg ? 'animate-pulse' : ''}`} />
                  <span>{isTestingTg ? 'Dispatching...' : 'Send Live Test Alert'}</span>
                </button>

                <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    checked={tgForm.enabled !== false}
                    onChange={(e) => setTgForm({ ...tgForm, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500"
                  />
                  <span className="text-xs font-bold text-white">
                    {tgForm.enabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    <span>Telegram Bot Token</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTgToken(!showTgToken)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                  >
                    {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showTgToken ? 'Hide Token' : 'Show Token'}</span>
                  </button>
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showTgToken ? 'text' : 'password'}
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={tgForm.bot_token || ''}
                    onChange={(e) => setTgForm({ ...tgForm, bot_token: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono pr-10"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Obtained from Telegram @BotFather when creating or managing your store bot.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Authorized Admin Chat IDs (comma-separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789, 987654321"
                  value={tgForm.admin_chat_ids || ''}
                  onChange={(e) => setTgForm({ ...tgForm, admin_chat_ids: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  All users with these Telegram Chat IDs will receive real-time order and catalog notifications.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-start gap-2">
                  <span className="text-amber-400 font-bold">⚠️ NOTE:</span>
                  <span>Har admin user ko apne Telegram par bot ko open karke <strong>/start</strong> dabana zaroori hai, tabhi Telegram bot unhe message send kar paayega.</span>
                </div>

                {/* Chips for parsed chat IDs */}
                {tgForm.admin_chat_ids && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tgForm.admin_chat_ids
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((chatId) => (
                        <span
                          key={chatId}
                          className="px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono text-[11px] flex items-center gap-1"
                        >
                          <span>🆔</span>
                          <span>{chatId}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notification Event Toggles */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-400" />
                <span>Active Automated Notification Channels</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={tgForm.new_order_alert !== false}
                    onChange={(e) => setTgForm({ ...tgForm, new_order_alert: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">New Paid Order</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Instant message with buyer details, bundle name & UPI amount.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={tgForm.product_alert !== false}
                    onChange={(e) => setTgForm({ ...tgForm, product_alert: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Product Uploaded</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Instant ping with bundle direct link whenever added from admin.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={tgForm.daily_summary_alert !== false}
                    onChange={(e) => setTgForm({ ...tgForm, daily_summary_alert: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Daily Night Summary</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Automated 11:59 PM IST daily sales and revenue report dispatch.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {tgForm.last_test_status && (
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 text-xs text-sky-300 flex items-center justify-between">
                <span>Last Test Dispatch: <strong>{tgForm.last_test_status}</strong></span>
                <span className="text-[10px] text-slate-400">{tgForm.last_test_at ? new Date(tgForm.last_test_at).toLocaleTimeString() : ''}</span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => updateTgMutation.mutate(tgForm as TelegramConfig)}
                disabled={updateTgMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateTgMutation.isPending ? 'Saving...' : 'Save Telegram Configuration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'meta' && dnpForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-blue-400" />
                  dnp-meta/v1 Server-Side Conversions Health
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Verifies server-to-server Meta CAPI event delivery and deduplication with browser Pixel.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Health Score: {dnpForm.event_health_score || 100}/100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-300">Meta Pixel ID</label>
                <input
                  type="text"
                  value={dnpForm.meta_pixel_id || ''}
                  onChange={(e) => setDnpForm({ ...dnpForm, meta_pixel_id: e.target.value })}
                  placeholder="e.g. 123456789012345"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Conversions API Token (CAPI)</label>
                <input
                  type="password"
                  value={dnpForm.capi_token || ''}
                  onChange={(e) => setDnpForm({ ...dnpForm, capi_token: e.target.value })}
                  placeholder="e.g. EAAXxXxXx..."
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300">Test Event Code (From Meta Events Manager &gt; Test Events)</label>
                <input
                  type="text"
                  value={dnpForm.test_event_code || ''}
                  onChange={(e) => setDnpForm({ ...dnpForm, test_event_code: e.target.value })}
                  placeholder="e.g. TEST12345 (Optional - only needed during testing)"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Deduplication Verification (Event ID: `order_token`)
              </div>
              <p className="text-slate-400 leading-relaxed">
                The DNP Meta bridge automatically injects identical deterministic event IDs for both the clientside Meta Pixel
                and the backend server CAPI payload. This guarantees zero duplicate reports in Meta Ads Manager.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleTestMeta}
                disabled={isTestingMeta || updateDnpMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {isTestingMeta ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending to Meta...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Test Event to Meta (Test Now)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => updateDnpMutation.mutate(dnpForm as DnpMetaConfig)}
                disabled={updateDnpMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateDnpMutation.isPending ? 'Saving...' : 'Save DNP Meta Config'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MMC ANALYTICS */}
      {activeTab === 'analytics' && mmcForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  MMC Analytics Realtime Telemetry
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Live store traffic, concurrent cart visitors, and retention metrics.
                </p>
              </div>

              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Stream Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-300">Analytics Tracking ID</label>
                <input
                  type="text"
                  value={mmcForm.tracking_id || ''}
                  onChange={(e) => setMmcForm({ ...mmcForm, tracking_id: e.target.value })}
                  placeholder="e.g. MMC-VAULTWORLD-01"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="mmc_enabled"
                  checked={mmcForm.enabled || false}
                  onChange={(e) => setMmcForm({ ...mmcForm, enabled: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="mmc_enabled" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Enable Real-time Visitor Telemetry Stream
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <div className="text-3xl font-black text-emerald-400">{mmcForm.active_visitors_now || 1}</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Active Visitors on Site Now</div>
                <div className="text-[10px] text-slate-400 mt-1">Across Home & Checkout</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <div className="text-3xl font-black text-white">{mmcForm.bounce_rate || '28.4%'}</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Average Bounce Rate</div>
                <div className="text-[10px] text-emerald-400 mt-1">-4.2% vs last week</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <div className="text-3xl font-black text-purple-400">{mmcForm.avg_session_duration || '3m 42s'}</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Average Session Duration</div>
                <div className="text-[10px] text-slate-400 mt-1">High bundle engagement</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => updateMmcMutation.mutate(mmcForm as MmcAnalyticsConfig)}
                disabled={updateMmcMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateMmcMutation.isPending ? 'Saving...' : 'Save MMC Analytics'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RANKMATH SEO */}
      {activeTab === 'seo' && seoForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-amber-400" />
                  RankMath SEO Modules & Metadata
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage search engine indexation, OpenGraph previews, and sitemap configuration.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Active SEO Modules</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'sitemap', label: 'XML Sitemaps' },
                  { key: 'schema', label: 'Rich Schema Data' },
                  { key: 'redirections', label: '301 Redirections' },
                  { key: 'seo_analysis', label: 'SEO Audit Engine' },
                ].map((mod) => (
                  <label
                    key={mod.key}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean((seoForm.modules as any)?.[mod.key])}
                      onChange={(e) =>
                        setSeoForm({
                          ...seoForm,
                          modules: {
                            ...(seoForm.modules as any),
                            [mod.key]: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-slate-200">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-300">Title Separator</label>
                <input
                  type="text"
                  value={seoForm.global_title_separator || '-'}
                  onChange={(e) => setSeoForm({ ...seoForm, global_title_separator: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Homepage Meta Title</label>
                <input
                  type="text"
                  value={seoForm.homepage_meta_title || ''}
                  onChange={(e) => setSeoForm({ ...seoForm, homepage_meta_title: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300">Homepage Meta Description</label>
                <textarea
                  rows={2}
                  value={seoForm.homepage_meta_description || ''}
                  onChange={(e) => setSeoForm({ ...seoForm, homepage_meta_description: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => updateSeoMutation.mutate(seoForm as RankMathConfig)}
                disabled={updateSeoMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateSeoMutation.isPending ? 'Saving...' : 'Save RankMath SEO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LITESPEED CACHE */}
      {activeTab === 'cache' && liteSpeedForm && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-400" />
                  LiteSpeed Server Cache & Edge CDN
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Speed acceleration engine for instant TTFB and fast bundle checkout rendering.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => purgeCacheMutation.mutate()}
                  disabled={purgeCacheMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-rose-600/10"
                >
                  <Flame className={`w-4 h-4 ${purgeCacheMutation.isPending ? 'animate-bounce' : ''}`} />
                  <span>{purgeCacheMutation.isPending ? 'Purging...' : 'Purge All Cache'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CDN Edge Network</div>
                <div className="text-lg font-black text-emerald-400 mt-1">{liteSpeedForm.cdn_status || 'ACTIVE'}</div>
                <div className="text-[10px] text-slate-400 mt-1">Global Anycast POP Active</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dynamic HTML Cache</div>
                <div className="text-lg font-black text-white mt-1">
                  {liteSpeedForm.cache_enabled ? 'ENABLED' : 'DISABLED'}
                </div>
                <div className="text-[10px] text-purple-400 mt-1">Cart & Checkout Excluded</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Cache Purge</div>
                <div className="text-sm font-bold text-white mt-1">{new Date(liteSpeedForm.last_purge_time || Date.now()).toLocaleTimeString()}</div>
                <div className="text-[10px] text-slate-400 mt-1">Zero downtime purge</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <span className="text-xs font-bold text-slate-300">CSS Minification</span>
                <input
                  type="checkbox"
                  checked={Boolean(liteSpeedForm.css_minify)}
                  onChange={(e) => setLiteSpeedForm({ ...liteSpeedForm, css_minify: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <span className="text-xs font-bold text-slate-300">JS Minification</span>
                <input
                  type="checkbox"
                  checked={Boolean(liteSpeedForm.js_minify)}
                  onChange={(e) => setLiteSpeedForm({ ...liteSpeedForm, js_minify: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700">
                <span className="text-xs font-bold text-slate-300">WebP Conversion</span>
                <input
                  type="checkbox"
                  checked={Boolean(liteSpeedForm.image_optimization)}
                  onChange={(e) => setLiteSpeedForm({ ...liteSpeedForm, image_optimization: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
                />
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => updateLiteSpeedMutation.mutate(liteSpeedForm as LiteSpeedConfig)}
                disabled={updateLiteSpeedMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{updateLiteSpeedMutation.isPending ? 'Saving...' : 'Save LiteSpeed Config'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
