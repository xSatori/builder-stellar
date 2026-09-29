import { describe, expect, it } from 'vitest';

import { getTreasuryAllocation } from './treasury-allocation-chart';

describe('getTreasuryAllocation', () => {
  it('charts only positive finite balances as raw unit proportions', () => {
    const result = getTreasuryAllocation([
      { assetCode: 'XLM', balance: '3', isNative: true },
      { assetCode: 'USDC', balance: '1', isNative: false },
      { assetCode: 'BAD', balance: 'NaN', isNative: false },
      { assetCode: 'ZERO', balance: '0', isNative: false }
    ]);

    expect(result).toEqual([
      { code: 'XLM', amount: 3, percent: 75 },
      { code: 'USDC', amount: 1, percent: 25 }
    ]);
  });

  it('has no slices when every balance is zero or invalid', () => {
    expect(getTreasuryAllocation([{ assetCode: 'XLM', balance: '-1', isNative: true }])).toEqual([]);
  });
});
