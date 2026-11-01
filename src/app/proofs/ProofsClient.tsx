'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const GrowthProofSection = dynamic(() => import('@/components/GrowthProofSection'), {
  ssr: false,
});

export default function ProofsClient() {
  return (
    <div className="rounded-3xl overflow-hidden">
      <GrowthProofSection />
    </div>
  );
}
