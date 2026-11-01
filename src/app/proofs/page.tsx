import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowRight, TrendingUp, CheckCircle2, ShieldCheck, Flame } from 'lucide-react';
import ProofsClient from './ProofsClient';

export const metadata: Metadata = {
  title: 'Real Creator Growth Proofs & Results | VaultWorld Store',
  description:
    'Explore real 100K+ follower growth results, viral reach screenshots and testimonials from creators using our AI & viral reels bundles.',
};

export default function ProofsPage() {
  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb & Top Indicator */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/" className="hover:text-amber-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">Growth Proofs</span>
        </nav>
      </div>

      {/* Main 3D Growth Proofs Showcase Section */}
      <ProofsClient />

      {/* Conversion Banner: Get Started Now */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/30 p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl text-white">
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-black uppercase tracking-wider border border-purple-500/30">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Start Scaling Today
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Ready to Build Your Own Viral Channel?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Get instant Google Drive access to 1000+ watermark-free, ready-to-post HD reels in your favorite niche.
            </p>
          </div>

          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <span>Explore All Bundles</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
