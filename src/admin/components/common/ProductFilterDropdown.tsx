import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Package, Filter, Check, ChevronDown, Globe, Sparkles } from 'lucide-react';

export interface ProductOption {
  id: string;
  slug: string;
  name: string;
}

interface ProductFilterDropdownProps {
  products: ProductOption[];
  selectedFilter: string; // 'all' | 'global' | productSlug
  onSelectFilter: (filter: string) => void;
  items: Array<{ productSlug?: string }>;
  isLight?: boolean;
}

export default function ProductFilterDropdown({
  products,
  selectedFilter,
  onSelectFilter,
  items,
  isLight = false,
}: ProductFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute counts
  const totalCount = items.length;
  const globalCount = items.filter((it) => !it.productSlug).length;

  const productCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.productSlug) {
        map.set(it.productSlug, (map.get(it.productSlug) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  // Selected label computation
  const selectedLabel = useMemo(() => {
    if (selectedFilter === 'all') {
      return `📁 All Screenshots (${totalCount})`;
    }
    if (selectedFilter === 'global') {
      return `🌐 General / Unassigned (${globalCount})`;
    }
    const matched = products.find((p) => p.slug === selectedFilter);
    if (matched) {
      const count = productCounts.get(matched.slug) || 0;
      return `📦 ${matched.name} ${count > 0 ? `(${count})` : ''}`;
    }
    return `📦 Filtered: ${selectedFilter}`;
  }, [selectedFilter, totalCount, globalCount, products, productCounts]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (filterVal: string) => {
    onSelectFilter(filterVal);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full sm:w-auto">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto min-w-[200px] sm:max-w-xs px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2.5 transition-all shadow-sm ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/30 bg-slate-900 text-white'
            : selectedFilter !== 'all'
            ? 'border-purple-500/60 bg-purple-950/40 text-purple-200 hover:border-purple-400'
            : isLight
            ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
          <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <Search className="w-3 h-3 text-purple-400" />
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-purple-300' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:right-0 left-0 sm:left-auto top-full mt-2 w-full sm:w-80 md:w-96 z-50 rounded-2xl bg-slate-900 border border-purple-500/40 shadow-2xl overflow-hidden backdrop-blur-xl animate-fadeIn">
          {/* 1. Sticky Search Input */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/95 sticky top-0 z-10 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product to filter proofs..."
                className="w-full pl-9 pr-7 py-2 rounded-xl bg-slate-900 border border-purple-500/30 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                {searchQuery
                  ? `${filteredProducts.length} matching products`
                  : `Browse all ${products.length} products`}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-purple-400 hover:underline text-[10px]"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* 2. Scrollable Options List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-0.5">
            {/* Standard Global Options (Show when search query is empty or matches) */}
            {(!searchQuery || 'all screenshots'.includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left text-xs transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-purple-950/70 text-purple-200 border border-purple-500/40 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">📁</span>
                  <div>
                    <div className="font-semibold text-white">All Screenshots</div>
                    <div className="text-[10px] text-slate-400">View every uploaded proof ({totalCount})</div>
                  </div>
                </div>
                {selectedFilter === 'all' && (
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                )}
              </button>
            )}

            {(!searchQuery || 'general unassigned main'.includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect('global')}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left text-xs transition-colors ${
                  selectedFilter === 'global'
                    ? 'bg-purple-950/70 text-purple-200 border border-purple-500/40 font-bold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">🌐</span>
                  <div>
                    <div className="font-semibold text-white">General / Unassigned</div>
                    <div className="text-[10px] text-slate-400">Shows on main /proofs page ({globalCount})</div>
                  </div>
                </div>
                {selectedFilter === 'global' && (
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                )}
              </button>
            )}

            {/* Separator if global options are visible */}
            {filteredProducts.length > 0 && (
              <div className="px-2 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Products with Dedicated Proofs
              </div>
            )}

            {/* Product Options */}
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Package className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  No products found matching &ldquo;<span className="text-purple-300 font-semibold">{searchQuery}</span>&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-purple-400 hover:text-purple-300 underline"
                >
                  View all products
                </button>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedFilter === p.slug;
                const count = productCounts.get(p.slug) || 0;

                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => handleSelect(p.slug)}
                    className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-purple-950/80 text-purple-200 border border-purple-500/50 font-bold'
                        : 'text-slate-200 hover:bg-slate-800/90'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base shrink-0">📦</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          /product/{p.slug}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black">
                          {count} {count === 1 ? 'proof' : 'proofs'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          0 proofs
                        </span>
                      )}

                      {isSelected && (
                        <Check className="w-4 h-4 text-purple-400 shrink-0 ml-1" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
