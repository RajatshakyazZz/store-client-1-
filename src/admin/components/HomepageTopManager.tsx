import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  Flame,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Product } from '../api/types';
import { portalApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  HomepagePinnedConfig,
  fetchHomepagePinned,
  saveHomepagePinned,
  DEFAULT_HOMEPAGE_PINNED,
} from '@/lib/homepagePinnedSettings';
import ProductSearchSelector from './common/ProductSearchSelector';

interface HomepageTopManagerProps {
  products: Product[];
  onPinnedChange?: (pinnedSlugs: string[]) => void;
}

export default function HomepageTopManager({
  products,
  onPinnedChange,
}: HomepageTopManagerProps) {
  const { success, error } = useToast();
  const [config, setConfig] = useState<HomepagePinnedConfig>(DEFAULT_HOMEPAGE_PINNED);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string>('');

  // Load pinned config on mount from portalApi (Firestore + local cache)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    portalApi
      .getHomepagePinned()
      .then((cfg) => {
        if (isMounted && cfg) {
          setConfig(cfg);
          if (onPinnedChange) onPinnedChange(cfg.pinnedSlugs || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to load pinned config via portalApi:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Map of products for fast lookup (handles prefix rb- and ID/slug variations)
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.slug) {
        const s = p.slug.toLowerCase().trim();
        map.set(s, p);
        map.set(s.replace(/^rb-/, ''), p);
        map.set(`rb-${s}`, p);
      }
      if (p.id) {
        const id = String(p.id).toLowerCase().trim();
        map.set(id, p);
        map.set(id.replace(/^rb-/, ''), p);
        map.set(`rb-${id}`, p);
      }
    }
    return map;
  }, [products]);

  // Pinned products list in exact order (with fallback object so items never vanish while products load)
  const pinnedProductList = useMemo(() => {
    return config.pinnedSlugs.map((slug, idx) => {
      const clean = slug.toLowerCase().trim();
      const prod =
        productMap.get(clean) ||
        productMap.get(clean.replace(/^rb-/, '')) ||
        productMap.get(`rb-${clean}`);

      return {
        slug,
        rank: idx + 1,
        product:
          prod ||
          ({
            id: slug,
            name: slug.replace(/^rb-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            slug: slug,
            price: 99,
            regular_price: 499,
            featured_image:
              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
            status: 'publish',
            stock_status: 'instock',
          } as Product),
      };
    });
  }, [config.pinnedSlugs, productMap]);

  // Available products for the search selector (excluding already pinned ones)
  const productOptions = useMemo(() => {
    const pinnedSet = new Set(
      config.pinnedSlugs.flatMap((s) => {
        const c = s.toLowerCase().trim();
        return [c, c.replace(/^rb-/, ''), `rb-${c}`];
      })
    );

    return products
      .filter((p) => {
        if (!p.slug) return false;
        const s = p.slug.toLowerCase().trim();
        const id = String(p.id || '').toLowerCase().trim();
        return !pinnedSet.has(s) && !pinnedSet.has(id);
      })
      .map((p) => ({
        id: String(p.id),
        slug: p.slug,
        name: p.name,
      }));
  }, [products, config.pinnedSlugs]);

  const handlePinProduct = (slug: string) => {
    if (!slug) return;
    const cleanSlug = slug.toLowerCase().trim();
    const existing = config.pinnedSlugs.map((s) => s.toLowerCase().trim());
    if (existing.includes(cleanSlug)) {
      return;
    }

    const nextSlugs = [...config.pinnedSlugs, cleanSlug];
    const nextConfig = { ...config, pinnedSlugs: nextSlugs };
    setConfig(nextConfig);
    setSelectedToAdd('');
    if (onPinnedChange) onPinnedChange(nextSlugs);
  };

  const handleUnpin = (slug: string) => {
    const cleanSlug = slug.toLowerCase().trim();
    const nextSlugs = config.pinnedSlugs.filter((s) => s.toLowerCase().trim() !== cleanSlug);
    const nextConfig = { ...config, pinnedSlugs: nextSlugs };
    setConfig(nextConfig);
    if (onPinnedChange) onPinnedChange(nextSlugs);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextSlugs = [...config.pinnedSlugs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextSlugs.length) return;

    const temp = nextSlugs[index];
    nextSlugs[index] = nextSlugs[targetIndex];
    nextSlugs[targetIndex] = temp;

    const nextConfig = { ...config, pinnedSlugs: nextSlugs };
    setConfig(nextConfig);
    if (onPinnedChange) onPinnedChange(nextSlugs);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save directly to Cloud Firestore & localStorage via portalApi
      const updated = await portalApi.updateHomepagePinned(config);
      // 2. Also trigger sync helper
      await saveHomepagePinned(config);

      success(
        'Viral Bundles Saved to Cloud!',
        `${config.pinnedSlugs.length} products pinned & spotlight saved in Firestore database.`
      );
    } catch (err: any) {
      error('Save Failed', err.message || 'Could not save pinned settings to database.');
    } finally {
      setIsSaving(false);
    }
  };

  // Find details of the product currently selected in the dropdown
  const selectedProductDetail = useMemo(() => {
    if (!selectedToAdd) return null;
    return (
      productMap.get(selectedToAdd.toLowerCase().trim()) ||
      productMap.get(selectedToAdd.toLowerCase().replace(/^rb-/, '').trim()) ||
      productOptions.find((p) => p.slug === selectedToAdd)
    );
  }, [selectedToAdd, productMap, productOptions]);

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-purple-950/40 border border-amber-500/30 p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                🔥 Viral Bundles (Homepage Top &amp; Popup Spotlight)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                {pinnedProductList.length} BUNDLES ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Aap jis product ko yahan pin karenge, store par uska ek <strong>&ldquo;Viral Bundles&rdquo;</strong> ka pop-up modal aur floating pill banke aayega, aur homepage par bhi ye products sabse top par show honge.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Viral Bundles</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Popup Settings Quick Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">
            Popup Title (Customer Display)
          </label>
          <input
            type="text"
            value={config.popupTitle || 'Viral Bundles'}
            onChange={(e) => setConfig({ ...config, popupTitle: e.target.value })}
            placeholder="Viral Bundles"
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 font-bold"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoPopup !== false}
              onChange={(e) => setConfig({ ...config, autoPopup: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-400"
            />
            <span className="font-semibold text-xs">Auto-Open Popup on Store Visit</span>
          </label>
        </div>
      </div>

      {/* Product Selector with Search */}
      <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-xs font-bold text-purple-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            🔍 Search and Pin Any Store Product to Top:
          </span>
          {selectedToAdd && (
            <span className="text-[11px] text-amber-300 font-semibold animate-pulse">
              ✓ Ready to pin below! Click button →
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <ProductSearchSelector
              products={productOptions}
              selectedSlug={selectedToAdd}
              onSelect={(p) => setSelectedToAdd(p ? p.slug : '')}
              label=""
              placeholder="Search product by title (e.g. art & craft, kids, mad scientist)..."
              allowGeneral={false}
            />
          </div>

          <button
            type="button"
            onClick={() => handlePinProduct(selectedToAdd)}
            disabled={!selectedToAdd}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer ${
              selectedToAdd
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white ring-2 ring-purple-400 shadow-purple-500/30 active:scale-95 animate-pulse'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{selectedToAdd ? '+ Pin Selected Bundle' : '+ Pin to Homepage Top'}</span>
          </button>
        </div>

        {selectedProductDetail && (
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
            <span className="truncate">
              Selected: <strong>{selectedProductDetail.name}</strong>
            </span>
            <span className="text-[11px] text-amber-400 font-semibold shrink-0 ml-2">
              Click &ldquo;+ Pin Selected Bundle&rdquo; to add to top list
            </span>
          </div>
        )}
      </div>

      {/* Pinned Products List */}
      {pinnedProductList.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-400 text-xs space-y-1">
          <p className="font-semibold text-slate-300">No products currently pinned to top.</p>
          <p className="text-[11px] text-slate-500">
            Search any product above and click &ldquo;+ Pin Selected Bundle&rdquo; to place it in the #1 position on the store homepage!
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between px-1">
            <span>Currently Showing at Top of Homepage ({pinnedProductList.length}):</span>
            <span className="text-amber-400 text-[10px]">#1 appears first on Home</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pinnedProductList.map(({ slug, rank, product }, idx) => {
              if (!product) return null;

              return (
                <div
                  key={slug}
                  className="p-3 rounded-xl bg-slate-950 border border-amber-500/20 hover:border-amber-500/50 flex items-center justify-between gap-3 shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                      #{rank}
                    </div>

                    {/* Thumbnail */}
                    <img
                      src={product.featured_image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'}
                      alt={product.name}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-800 shrink-0"
                    />

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate max-w-[200px] sm:max-w-[240px]">
                          {product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                        <span className="text-emerald-400 font-bold">₹{product.price}</span>
                        <span>•</span>
                        <span className="truncate">/product/{product.slug}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-all cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === pinnedProductList.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-all cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUnpin(slug)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all ml-1 cursor-pointer"
                      title="Unpin from Top"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
