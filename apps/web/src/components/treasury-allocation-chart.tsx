'use client';

import type { AssetBalance } from '@/lib/treasury-queries';

const colors = ['#4aa3ff', '#53c9a8', '#f4b860', '#be8cff', '#ef8492', '#8ac9de'];

export function getTreasuryAllocation(balances: AssetBalance[]) {
  const funded = balances
    .map((asset) => ({ code: asset.assetCode, amount: Number(asset.balance) }))
    .filter((asset) => Number.isFinite(asset.amount) && asset.amount > 0);
  const total = funded.reduce((sum, asset) => sum + asset.amount, 0);
  if (!Number.isFinite(total) || total <= 0) return [];
  return funded.map((asset) => ({ ...asset, percent: (asset.amount / total) * 100 }));
}

export function TreasuryAllocationChart({ balances }: { balances: AssetBalance[] }) {
  const slices = getTreasuryAllocation(balances);
  if (!slices.length) {
    return <p className="proposal-context-detail">No positive balances to chart.</p>;
  }

  const stops = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((sum, previous) => sum + previous.percent, 0);
    const end = start + slice.percent;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className="treasury-allocation">
      <div
        className="treasury-allocation__pie"
        role="img"
        aria-label={`Raw token-unit proportions: ${slices.map((slice) => `${slice.code} ${slice.percent.toFixed(1)}%`).join(', ')}`}
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      />
      <div className="treasury-allocation__legend">
        {slices.map((slice, index) => (
          <div key={`${slice.code}-${index}`}>
            <span className="treasury-allocation__swatch" style={{ background: colors[index % colors.length] }} />
            <span>{slice.code}</span>
            <strong>{slice.percent.toFixed(1)}%</strong>
          </div>
        ))}
      </div>
      <p className="proposal-context-detail treasury-allocation__note">
        Raw token-unit proportions only. Different assets are not converted to value.
      </p>
    </div>
  );
}
