export type QuickBuyPreviewToken = {
  tokenId: number;
  priceStroops: bigint;
};

/** Preview inventory only. These tokens are not verified escrow holdings. */
export const QUICK_BUY_PREVIEW_TOKENS: QuickBuyPreviewToken[] = [
  { tokenId: 8, priceStroops: 25_000_000n },
  { tokenId: 9, priceStroops: 30_000_000n },
  { tokenId: 10, priceStroops: 25_000_000n },
  { tokenId: 11, priceStroops: 40_000_000n },
  { tokenId: 12, priceStroops: 30_000_000n },
  { tokenId: 13, priceStroops: 35_000_000n }
];

export function formatPreviewXlm(stroops: bigint) {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''} sample XLM`;
}

export function previewSelectionTotal(tokens: QuickBuyPreviewToken[], selectedIds: number[]) {
  const selected = new Set(selectedIds);
  return tokens.reduce((total, token) => total + (selected.has(token.tokenId) ? token.priceStroops : 0n), 0n);
}
