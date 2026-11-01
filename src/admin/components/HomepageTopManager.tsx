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
} from 'lucide-react';
import { Product } from '../api/types';
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

  // Load pinned config on mount
  useEffect(() => {
    setLoading(true);
    fetchHomepagePinned(true)
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          if (onPinnedChange) onPinnedChange(cfg.pinnedSlugs || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Map of products for fast lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.slug) map.set(p.slug.toLowerCase().trim(), p);
      if (p.id) map.set(String(p.id).toLowerCase().trim(), p);
    }
    return map;
  }, [products]);

  // Pinned products list in exact order
  const pinnedProductList = useMemo(() => {
    return config.pinnedSlugs
      .map((slug, idx) => {
        const prod = productMap.get(slug.toLowerCase().trim());
        return {
          slug,
          rank: idx + 1,
          product: prod || null,
        };
      })
      .filter((it) => it.product !== null);
  }, [config.pinnedSlugs, productMap]);

  // Available products for the search selector (excluding already pinned ones)
  const productOptions = useMemo(() => {
    const pinnedSet = new Set(config.pinnedSlugs.map((s) => s.toLowerCase().trim()));
    return products
      .filter((p) => p.slug && !pinnedSet.has(p.slug.toLowerCase().trim()))
      .map((p) => ({
        id: String(p.id),
        slug: p.slug,
        name: p.name,
      }));
  }, [products, config.pinnedSlugs]);

  const handlePinProduct = (slug: string) => {
    if (!slug) return;
    const cleanSlug = slug.toLowerCase().trim();
    if (config.pinnedSlugs.map((s) => s.toLowerCase().trim()).includes(cleanSlug)) {
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
      const ok = await saveHomepagePinned(config);
      if (ok) {
        success(
          'Homepage Top Saved!',
          `${config.pinnedSlugs.length} products pinned to top of homepage.`
        );
      } else {
        error('Save Failed', 'Could not sync pinned settings to cloud.');
      }
    } catch (err: any) {
      error('Error', err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-purple-950/40 border border-amber-500/30 p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                Homepage Top Spotlight (Featured Bundles)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pinnedProductList.length} Pinned
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Yahan se aap kisi bhi product ko select karke store ke homepage par <strong>Top Position</strong> par laga sakte hain. Buyers ko ye product sabse pehle dikhega.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Top Order'}</span>
          </button>
        </div>
      </div>

      {/* Product Selector with Search */}
      <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <span>🔍 Search and Pin Any Store Product to Top:</span>
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
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Pin to Homepage Top</span>
          </button>
        </div>
      </div>

      {/* Pinned Products List */}
      {pinnedProductList.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-400 text-xs space-y-1">
          <p className="font-semibold text-slate-300">No products currently pinned to top.</p>
          <p className="text-[11px] text-slate-500">
            Search any product above and click &ldquo;Pin to Homepage Top&rdquo; to place it in the #1 position on the store homepage!
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-all"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === pinnedProductList.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition-all"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUnpin(slug)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all ml-1"
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
