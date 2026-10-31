'use client';

import React from 'react';
import Hero from '@/components/Hero';
import FreeBundleOfferBanner from '@/components/FreeBundleOfferBanner';
import TrendingMarquee from '@/components/TrendingMarquee';
import ReelsVideoPreview from '@/components/ReelsVideoPreview';
import FreshReelsGrid from '@/components/FreshReelsGrid';
import MembershipPlans from '@/components/MembershipPlans';
import UpcomingBundles from '@/components/UpcomingBundles';
import CreatorProof from '@/components/CreatorProof';
import GrowthProofSection from '@/components/GrowthProofSection';

export default function HomePage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vaultworld.shop').replace(/\/+$/, '');

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VaultWorld Store',
    url: siteUrl,
    logo: `${siteUrl}/icon.png`,
    description: "India's leading marketplace for viral ready-to-post vertical reels bundles with commercial rights.",
    sameAs: [
      'https://www.instagram.com/vaultworld.shop',
      'https://t.me/vaultworld',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    },
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'VaultWorld Store',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div className="space-y-4">
      {/* JSON-LD Structured Data: Organization & WebSite SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Hero with Typewriter & 3D Cards */}
      <Hero />

      {/* Special Free Bundles Offer Banner */}
      <FreeBundleOfferBanner variant="home" />

      {/* Trending Bundles Auto-Marquee */}
      <TrendingMarquee />

      {/* Interactive Smartphone Video Preview Section */}
      <ReelsVideoPreview />

      {/* Fresh Reels Grid */}
      <FreshReelsGrid />

      {/* All Access Personal vs Reseller Plans */}
      <MembershipPlans />

      {/* Upcoming Bundles & Notify Me */}
      <UpcomingBundles />

      {/* 3D Creator Growth Proofs (febric-style 3D Coverflow) */}
      <div id="growth-proofs">
        <GrowthProofSection />
      </div>

      {/* Creator Growth Analytics & Testimonials */}
      <CreatorProof />
    </div>
  );
}
