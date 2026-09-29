import { describe, expect, it } from 'vitest';

import { formatPreviewXlm, previewSelectionTotal, QUICK_BUY_PREVIEW_TOKENS } from './quick-buy-preview';

describe('Quick Buy preview inventory', () => {
  it('has distinct token IDs beyond the sample auction and positive prices', () => {
    const ids = QUICK_BUY_PREVIEW_TOKENS.map((token) => token.tokenId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 7)).toBe(true);
    expect(QUICK_BUY_PREVIEW_TOKENS.every((token) => token.priceStroops > 0n)).toBe(true);
  });

  it('totals only selected tokens, without charging twice for a duplicate selection', () => {
    expect(previewSelectionTotal(QUICK_BUY_PREVIEW_TOKENS, [8, 10, 10])).toBe(50_000_000n);
    expect(formatPreviewXlm(previewSelectionTotal(QUICK_BUY_PREVIEW_TOKENS, [8, 9]))).toBe('5.5 sample XLM');
  });
});
