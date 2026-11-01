'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  FolderOpen,
  Download,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  KeyRound,
  ExternalLink,
  Search,
  MessageCircle,
  Package,
  Clock,
} from 'lucide-react';
import { getCustomerOrders } from '@/lib/firebase';

function MyOrdersContent() {
  const searchParams = useSearchParams();
  const urlEmail = searchParams?.get('email') || '';

  const [email, setEmail] = useState(urlEmail);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search if email query param is present
  useEffect(() => {
    if (urlEmail && urlEmail.trim()) {
      setEmail(urlEmail.trim());
      handleLookup(urlEmail.trim());
    } else {
      // Check local device storage for any recent orders on this device
      try {
        const purchasedRaw = localStorage.getItem('vaultzet_purchased_orders');
        const ordersRaw = localStorage.getItem('vaultzet_orders');
        let combined: any[] = [];

        if (purchasedRaw) {
          const parsed = JSON.parse(purchasedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            combined = [...combined, ...parsed];
          }
        }

        if (ordersRaw) {
          const parsed = JSON.parse(ordersRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((o: any) => {
              const oNum = o.orderNumber || o.order_number || o.id;
              if (!combined.some((c: any) => (c.orderNumber || c.order_id || c.id) === oNum)) {
                combined.push(o);
              }
            });
          }
        }

        if (combined.length > 0) {
          setOrders(combined);
          setHasSearched(true);
          const firstEmail = combined[0]?.customer?.email || '';
          if (firstEmail) setEmail(firstEmail);
        }
      } catch (e) {
        console.warn('Error reading local orders:', e);
      }
    }
  }, [urlEmail]);

  const handleLookup = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);
    setHasSearched(true);

    try {
      // 1. Fetch from Firestore
      const firestoreOrders = await getCustomerOrders(cleanEmail);

      // 2. Fetch from local storage fallback
      let localOrders: any[] = [];
      try {
        const storedPurchased = JSON.parse(
          localStorage.getItem('vaultzet_purchased_orders') || '[]'
        );
        const storedAll = JSON.parse(localStorage.getItem('vaultzet_orders') || '[]');
        const combined = [...storedPurchased, ...storedAll];

        localOrders = combined.filter((o: any) => {
          const custEmail = (o?.customer?.email || o?.customerEmail || '').toLowerCase();
          return custEmail === cleanEmail;
        });
      } catch {}

      // 3. Deduplicate
      const mergedMap = new Map<string, any>();
      [...firestoreOrders, ...localOrders].forEach((ord: any) => {
        const key = String(ord.orderNumber || ord.orderId || ord.order_id || ord.id || '');
        if (key && !mergedMap.has(key)) {
          mergedMap.set(key, ord);
        }
      });

      const finalOrders = Array.from(mergedMap.values());
      // Sort newest first
      finalOrders.sort((a, b) => {
        const dateA = new Date(a.date_created || a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date_created || b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setOrders(finalOrders);
    } catch (err) {
      console.warn('Failed to lookup orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(email);
  };

  return (
    <div className="py-8 sm:py-16 bg-slate-50/60 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-black uppercase tracking-wider shadow-xs">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>Customer Instant Download Portal</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
            My Orders &amp; Downloads
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
            Apna checkout email niche dalein aur bina kisi password ya OTP ke turant apne Google Drive download links access karein.
          </p>

          <div className="flex items-center justify-center gap-3 sm:gap-6 text-[11px] sm:text-xs font-bold text-slate-500 pt-1 flex-wrap">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Direct Email Access
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> No Password Required
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Google Drive Cloud Delivery
            </span>
          </div>
        </div>

        {/* Email Lookup Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-xl space-y-4">
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Checkout Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
            >
              {loading ? (
                <span>Fetching Your Downloads...</span>
              ) : (
                <>
                  <Search className="w-4 h-4 stroke-[2.5]" />
                  <span>Access My Downloads &amp; Orders</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {hasSearched && email && (
            <div className="text-[11px] text-slate-500 text-center">
              Showing download access for: <strong className="text-slate-800 font-bold">{email}</strong>
            </div>
          )}
        </div>

        {/* Orders Results Section */}
        {hasSearched && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-lg text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 mx-auto flex items-center justify-center">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    No Orders Found for &ldquo;{email}&rdquo;
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    Kripya check karein ki aapne vahi email dala hai jo payment ke waqt PayU checkout par enter kiya tha.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setEmail('');
                      setHasSearched(false);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
                  >
                    Try Another Email
                  </button>

                  <a
                    href="https://wa.me/918126048100?text=Hi%20VaultWorld%20Support,%20I%20need%20help%20accessing%20my%20purchased%20reels%20bundle."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Support Help</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    <span>Your Orders &amp; Download Access ({orders.length})</span>
                  </h2>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    ✓ Verified Active
                  </span>
                </div>

                {orders.map((ord: any, idx: number) => {
                  const orderId =
                    ord.orderNumber || ord.orderId || ord.order_id || ord.id || `VZ-${idx + 1}`;
                  const dateStr = ord.date_created || ord.date || ord.createdAt || '';
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Recent Purchase';

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-6 space-y-4"
                    >
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Order ID:</span>
                            <span className="font-mono font-black text-sm text-slate-950">
                              #{orderId}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formattedDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[11px] font-black uppercase">
                            Payment Confirmed
                          </span>
                          {ord.totalAmount && (
                            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              ₹{ord.totalAmount}.00
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items & Drive Links */}
                      <div className="space-y-3">
                        {ord.items?.map((item: any, i: number) => {
                          const itemFiles: Array<{
                            id?: string;
                            name: string;
                            file_url?: string;
                            url?: string;
                          }> =
                            Array.isArray(item.files) && item.files.length > 0
                              ? item.files
                              : [
                                  {
                                    name: item.title || item.name || 'Complete Reels Bundle',
                                    file_url:
                                      item.googleDriveLink ||
                                      item.driveLink ||
                                      'https://drive.google.com',
                                  },
                                ];

                          const primaryDrive =
                            item.googleDriveLink || item.driveLink || itemFiles[0]?.file_url || '';

                          return (
                            <div
                              key={i}
                              className="p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <h4 className="font-extrabold text-sm sm:text-base text-slate-950">
                                    {item.title || item.name}
                                  </h4>
                                  <span className="text-[11px] text-purple-700 font-bold">
                                    License:{' '}
                                    {item.license === 'reseller'
                                      ? 'Reseller & Commercial Rights Included'
                                      : 'Personal Commercial Rights'}
                                  </span>
                                </div>

                                {primaryDrive && (
                                  <a
                                    href={primaryDrive}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
                                  >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Open Google Drive Folder</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              {/* Drive files breakdown if multiple parts */}
                              {itemFiles.length > 1 && (
                                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                                  <div className="text-[11px] font-bold text-slate-600">
                                    Individual Download Links:
                                  </div>
                                  {itemFiles.map((f, fIdx) => (
                                    <div
                                      key={f.id || fIdx}
                                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 gap-2 text-xs"
                                    >
                                      <span className="font-semibold text-slate-800 truncate">
                                        {f.name || `Drive Part #${fIdx + 1}`}
                                      </span>
                                      <a
                                        href={f.file_url || f.url || primaryDrive}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-700 hover:underline font-bold shrink-0 flex items-center gap-1"
                                      >
                                        <Download className="w-3 h-3" />
                                        <span>Download</span>
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Order Bump Bonus */}
                        {ord.hasBump && (
                          <div className="p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                                ★ Included Bonus Pack
                              </div>
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-950">
                                {ord.orderBump?.title || '1500+ Ultimate Twisted World AI Reels'}
                              </h4>
                            </div>

                            <a
                              href={
                                ord.orderBump?.googleDriveLink ||
                                'https://drive.google.com/drive/folders/bonus-pack-twisted-world'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm transition-all shrink-0 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Bonus Drive</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500 font-medium">
          Loading My Orders &amp; Downloads Portal...
        </div>
      }
    >
      <MyOrdersContent />
    </Suspense>
  );
}
