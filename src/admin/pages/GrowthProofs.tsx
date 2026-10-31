import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Package,
  Layers,
  Filter,
  CheckCircle2,
  ExternalLink,
  Info,
  Search,
  X,
} from 'lucide-react';
import { portalApi } from '../api/client';
import { AdminGrowthProofsConfig, AdminGrowthProofItem } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useAdminTheme } from '../context/AdminThemeContext';
import ImageUploadField from '../components/common/ImageUploadField';
import ProductSearchSelector from '../components/common/ProductSearchSelector';

const DEFAULT_CONFIG: AdminGrowthProofsConfig = {
  enabled: true,
  badge: 'REAL GROWTH PROOF',
  headline: 'Real Growth By Our Bundle Users',
  subheadline: 'These creators acquired our bundles, scaled to 100K+ followers, and monetize daily.',
  autoplay: true,
  autoplayInterval: 4000,
  items: [],
};

export default function GrowthProofsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { isLight } = useAdminTheme();

  // 1. Fetch Growth Proofs config
  const { data: remoteConfig, isLoading } = useQuery({
    queryKey: ['growth-proofs-admin'],
    queryFn: () => portalApi.getGrowthProofs(),
  });

  // 2. Fetch Catalog Products for the dropdown selector
  const { data: rawProducts = [] } = useQuery({
    queryKey: ['products-for-growth-proofs'],
    queryFn: () => portalApi.getProducts(),
  });

  const products = useMemo(() => {
    if (!Array.isArray(rawProducts)) return [];
    const map = new Map<string, { id: string; slug: string; name: string }>();
    for (const p of rawProducts) {
      const slug = String(p.slug || '').trim();
      if (slug && !map.has(slug)) {
        map.set(slug, {
          id: String(p.id || slug),
          slug,
          name: String(p.name || (p as any).title || slug).trim(),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawProducts]);

  const [form, setForm] = useState<AdminGrowthProofsConfig>(DEFAULT_CONFIG);
  const [productFilter, setProductFilter] = useState<string>('all');
  const [screenshotSearch, setScreenshotSearch] = useState<string>('');

  useEffect(() => {
    if (remoteConfig) {
      setForm({
        ...remoteConfig,
        items: Array.isArray(remoteConfig.items) ? remoteConfig.items : [],
      });
    }
  }, [remoteConfig]);

  const mutation = useMutation({
    mutationFn: (data: AdminGrowthProofsConfig) => portalApi.updateGrowthProofs(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['growth-proofs-admin'], data);
      success('Growth Proofs Saved', `Updated ${data.items.length} screenshots. Storefront updated!`);
    },
    onError: (err: any) => {
      error('Failed to Save', err.message || 'Could not save growth proof configuration.');
    },
  });

  const handleAddItem = () => {
    const preselectedProduct =
      productFilter !== 'all' && productFilter !== 'global'
        ? products.find((p) => p.slug === productFilter)
        : null;

    const newItem: AdminGrowthProofItem = {
      id: `gp-${Date.now()}`,
      image: '',
      title: '@creator_handle',
      followers: '150K Followers',
      metric: '+100K in 30 Days',
      tag: preselectedProduct ? 'Bundle Result' : 'AI Reels',
      productId: preselectedProduct ? preselectedProduct.id : '',
      productSlug: preselectedProduct ? preselectedProduct.slug : '',
      productTitle: preselectedProduct ? preselectedProduct.name : '',
    };

    setForm((prev) => ({
      ...prev,
      items: [newItem, ...prev.items],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const copy = [...prev.items];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return { ...prev, items: copy };
    });
  };

  const handleUpdateItem = (index: number, patch: Partial<AdminGrowthProofItem>) => {
    setForm((prev) => {
      const copy = [...prev.items];
      copy[index] = { ...copy[index], ...patch };
      return { ...prev, items: copy };
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    mutation.mutate(form);
  };

  // Filter items for the admin view list by both product and search keywords
  const filteredItemsWithIndices = useMemo(() => {
    const textQuery = screenshotSearch.toLowerCase().trim();
    return form.items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        // Product dropdown filter
        if (productFilter === 'global' && item.productSlug) return false;
        if (productFilter !== 'all' && productFilter !== 'global' && item.productSlug !== productFilter) {
          return false;
        }
        // Live search bar filter (creator handle, product name, slug, metric, tag)
        if (textQuery) {
          const matchHandle = (item.title || '').toLowerCase().includes(textQuery);
          const matchProd = (item.productTitle || '').toLowerCase().includes(textQuery);
          const matchSlug = (item.productSlug || '').toLowerCase().includes(textQuery);
          const matchTag = (item.tag || '').toLowerCase().includes(textQuery);
          const matchFollowers = (item.followers || '').toLowerCase().includes(textQuery);
          const matchMetric = (item.metric || '').toLowerCase().includes(textQuery);
          return matchHandle || matchProd || matchSlug || matchTag || matchFollowers || matchMetric;
        }
        return true;
      });
  }, [form.items, productFilter, screenshotSearch]);

  const globalItemsCount = useMemo(() => {
    return form.items.filter((it) => !it.productSlug).length;
  }, [form.items]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Growth Proofs Showcase
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Upload Instagram follower growth screenshots. Assign to a <strong>specific product page</strong> or display across the main Growth Proofs page.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Screenshot</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{mutation.isPending ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Helpful Feature Note */}
      <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3 text-xs text-purple-200">
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-white text-xs sm:text-sm">
            🎯 Dedicated Product Screenshots Feature:
          </div>
          <p className="leading-relaxed">
            Aap kisi bhi screenshot card me <strong>"Assign To Specific Product Page"</strong> select kar sakte hain. Wo screenshot sirf usi product page per 3D coverflow me dikhega.
            <strong> Jab tak kisi product per screenshot add nahi karenge, us product page per koi section ya dummy photo nahi dikhega.</strong> Saare screenshots menu ke main Growth Proofs page (<strong>/proofs</strong>) per ek saath show honge.
          </p>
        </div>
      </div>

      {/* Global Section Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Section Visibility</h3>
            <p className="text-xs text-slate-400">Enable or disable the 3D Growth Proofs showcase globally.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            <span className="ml-3 text-xs font-bold text-slate-300">
              {form.enabled ? 'ACTIVE (Visible)' : 'DISABLED (Hidden)'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Section Badge</label>
            <input
              type="text"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              placeholder="REAL GROWTH PROOF"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Main Headline</label>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder="Real Growth By Our Bundle Users"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Main Subheadline</label>
            <input
              type="text"
              value={form.subheadline}
              onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
              placeholder="These creators acquired our bundles, scaled to 100K+ followers, and monetize daily."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Autoplay setting */}
        <div className="flex flex-wrap items-center gap-6 pt-2 text-xs">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoplay}
              onChange={(e) => setForm({ ...form, autoplay: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <span>Auto-Rotate Carousel (3D Fan-out)</span>
          </label>

          {form.autoplay && (
            <div className="flex items-center gap-2 text-slate-400">
              <span>Speed:</span>
              <select
                value={form.autoplayInterval}
                onChange={(e) => setForm({ ...form, autoplayInterval: Number(e.target.value) })}
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-xs"
              >
                <option value={3000}>3 Seconds (Fast)</option>
                <option value={4000}>4 Seconds (Standard)</option>
                <option value={5000}>5 Seconds (Relaxed)</option>
                <option value={6000}>6 Seconds (Slow)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar & Header */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Proof Screenshots ({form.items.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filter, search, or assign screenshots to any product in your store.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Live Search Input Bar */}
            <div className="relative min-w-[240px] sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400 pointer-events-none" />
              <input
                type="text"
                value={screenshotSearch}
                onChange={(e) => setScreenshotSearch(e.target.value)}
                placeholder="Search by product, handle..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
              />
              {screenshotSearch && (
                <button
                  type="button"
                  onClick={() => setScreenshotSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Product Filter Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter:</span>
              </span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">📁 All Screenshots ({form.items.length})</option>
                <option value="global">🌐 General / Unassigned ({globalItemsCount})</option>
                {products.map((p) => {
                  const count = form.items.filter((it) => it.productSlug === p.slug).length;
                  return (
                    <option key={p.slug} value={p.slug}>
                      📦 {p.name} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* List of Screenshots */}
        {form.items.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900 border border-dashed border-slate-800 space-y-3">
            <TrendingUp className="w-10 h-10 text-purple-400/50 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-white">No Screenshots Uploaded Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Add your first Instagram follower growth screenshot. Once uploaded, it will show on the store!
            </p>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Upload First Screenshot</span>
            </button>
          </div>
        ) : filteredItemsWithIndices.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900 border border-dashed border-slate-800 space-y-3">
            <Package className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs sm:text-sm text-slate-400">
              No screenshots found for this filter.
            </p>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Screenshot for this Product</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItemsWithIndices.map(({ item, originalIndex }) => (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition-all flex flex-col md:flex-row gap-5 items-start ${
                  item.productSlug
                    ? 'border-purple-500/40 hover:border-purple-500/70 shadow-lg shadow-purple-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Screenshot Upload / Preview */}
                <div className="w-full md:w-56 shrink-0">
                  <ImageUploadField
                    label={`Screenshot #${originalIndex + 1}`}
                    value={item.image}
                    onChange={(url) => handleUpdateItem(originalIndex, { image: url })}
                    placeholder="https://... upload screenshot"
                    helperText="Upload mobile screenshot (PNG/JPG)"
                  />
                </div>

                {/* Details Fields */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                  {/* DEDICATED PRODUCT SELECTOR BOX WITH SEARCH BAR */}
                  <div className="sm:col-span-2 p-3 sm:p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-2">
                    <ProductSearchSelector
                      products={products}
                      selectedSlug={item.productSlug}
                      selectedTitle={item.productTitle}
                      onSelect={(selectedProduct) => {
                        if (!selectedProduct) {
                          handleUpdateItem(originalIndex, {
                            productSlug: '',
                            productId: '',
                            productTitle: '',
                          });
                        } else {
                          handleUpdateItem(originalIndex, {
                            productSlug: selectedProduct.slug,
                            productId: selectedProduct.id,
                            productTitle: selectedProduct.name,
                          });
                        }
                      }}
                      isLight={isLight}
                    />

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-700/60">
                      {item.productSlug ? (
                        <span className="text-emerald-400 font-medium">
                          ✓ Ye screenshot sirf <strong>"{item.productTitle || item.productSlug}"</strong> ke product page per aur menu ke Growth Proofs page per dikhega.
                        </span>
                      ) : (
                        <span>
                          ℹ️ Ye screenshot main menu ke Growth Proofs page (<strong>/proofs</strong>) per show hoga.
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Creator Account Handle
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(originalIndex, { title: e.target.value })}
                      placeholder="@giggle.toons_"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Followers / Reach Tag
                    </label>
                    <input
                      type="text"
                      value={item.followers || ''}
                      onChange={(e) => handleUpdateItem(originalIndex, { followers: e.target.value })}
                      placeholder="170K Followers"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Growth Metric Pill
                    </label>
                    <input
                      type="text"
                      value={item.metric || ''}
                      onChange={(e) => handleUpdateItem(originalIndex, { metric: e.target.value })}
                      placeholder="+120K in 30 Days"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Bundle / Niche Badge
                    </label>
                    <input
                      type="text"
                      value={item.tag || ''}
                      onChange={(e) => handleUpdateItem(originalIndex, { tag: e.target.value })}
                      placeholder="AI Animation"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Actions (Move & Delete) */}
                <div className="flex md:flex-col items-center gap-1.5 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleMove(originalIndex, 'up')}
                    disabled={originalIndex === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(originalIndex, 'down')}
                    disabled={originalIndex === form.items.length - 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(originalIndex)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    title="Delete Screenshot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
