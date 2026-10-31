import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Package, Check, ChevronDown, Globe, Sparkles } from 'lucide-react';

export interface ProductOption {
  id: string;
  slug: string;
  name: string;
}

interface ProductSearchSelectorProps {
  products: ProductOption[];
  selectedSlug?: string;
  selectedTitle?: string;
  onSelect: (product: ProductOption | null) => void;
  isLight?: boolean;
  label?: string;
  placeholder?: string;
  allowGeneral?: boolean;
  generalLabel?: string;
}

export default function ProductSearchSelector({
  products,
  selectedSlug = '',
  selectedTitle = '',
  onSelect,
  isLight = false,
  label = 'Assign to Specific Product Page (Dedicated):',
  placeholder = 'Type to search products (e.g. mad scientist, kids, ai)...',
  allowGeneral = true,
  generalLabel = 'All / General (Shows on Main Growth Proofs page from Menu)',
}: ProductSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently active product
  const currentProduct = useMemo(() => {
    if (!selectedSlug) return null;
    return products.find((p) => p.slug === selectedSlug) || {
      id: '',
      slug: selectedSlug,
      name: selectedTitle || selectedSlug,
    };
  }, [products, selectedSlug, selectedTitle]);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Click outside listener to close dropdown
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

  // Focus input automatically when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelectProduct = (product: ProductOption | null) => {
    onSelect(product);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Top Header Label */}
      {label && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-purple-400" />
            <span>{label}</span>
          </label>
          {currentProduct ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
              🎯 Dedicated: {currentProduct.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full self-start sm:self-auto">
              🌐 General / Main Menu Only
            </span>
          )}
        </div>
      )}

      {/* Trigger Bar (Click to Open Search) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/30 bg-slate-900 shadow-md'
            : currentProduct
            ? 'border-purple-500/50 hover:border-purple-400 bg-slate-900/90 shadow-sm'
            : isLight
            ? 'border-slate-300 hover:border-slate-400 bg-white'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {currentProduct ? (
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
              <Package className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-slate-700">
              <Globe className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              {currentProduct ? currentProduct.name : generalLabel}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              {currentProduct
                ? `Assigned to: /product/${currentProduct.slug}`
                : 'Shows on main /proofs page. Click to search and assign to a specific product.'}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentProduct && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Reset to General / Unassigned"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="px-2 py-1 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1">
            <Search className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">Search</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-purple-300' : 'text-slate-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* DROPDOWN POPOVER WITH LIVE SEARCH BAR */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-slate-900 border border-purple-500/40 shadow-2xl overflow-hidden animate-fadeIn backdrop-blur-xl">
          {/* 1. Instant Search Input Bar */}
          <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-purple-500/30 text-white text-xs sm:text-sm font-medium placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
              <span>
                {searchQuery
                  ? `Found ${filteredProducts.length} matching products`
                  : `Browse all ${products.length} catalog products`}
              </span>
              <span className="text-[10px] text-slate-500">
                Click any product to assign
              </span>
            </div>
          </div>

          {/* 2. Scrollable Products Results List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-1">
            {/* Option A: General / Unassigned */}
            {allowGeneral && (
              <div
                onClick={() => handleSelectProduct(null)}
                className={`p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  !currentProduct
                    ? 'bg-purple-950/60 border border-purple-500/40 text-purple-200'
                    : 'hover:bg-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-xs font-bold text-white">
                      {generalLabel}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Shows on main /proofs showcase page (not restricted to a single product)
                    </div>
                  </div>
                </div>

                {!currentProduct && (
                  <span className="p-1 rounded-full bg-purple-500/20 text-purple-300 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            )}

            {/* Option B: Filtered Product Results */}
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">
                  No products found matching &ldquo;<span className="text-purple-300 font-bold">{searchQuery}</span>&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-semibold"
                >
                  Clear search and view all products
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = currentProduct?.slug === product.slug;
                return (
                  <div
                    key={product.slug}
                    onClick={() => handleSelectProduct(product)}
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-950/70 border border-purple-500/50 text-purple-200'
                        : 'hover:bg-slate-800/90 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 text-left flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-white truncate">
                          {product.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          /product/{product.slug}
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        <span>Selected</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-purple-400 font-semibold opacity-0 group-hover:opacity-100 shrink-0">
                        Select →
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
