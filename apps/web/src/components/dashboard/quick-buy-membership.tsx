'use client';

import { X } from 'lucide-react';
import { useRef, useState } from 'react';

import { formatPreviewXlm, previewSelectionTotal, QUICK_BUY_PREVIEW_TOKENS } from '@/lib/quick-buy-preview';

export function QuickBuyMembership({ placement = 'dashboard' }: { placement?: 'dashboard' | 'auction-header' }) {
  const poolRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [blockedMessage, setBlockedMessage] = useState('');
  const selectedTokens = QUICK_BUY_PREVIEW_TOKENS.filter((token) => selectedIds.includes(token.tokenId));
  const total = previewSelectionTotal(QUICK_BUY_PREVIEW_TOKENS, selectedIds);

  function openPool() {
    setSelectedIds([]);
    setBlockedMessage('');
    poolRef.current?.showModal();
  }

  function toggleToken(tokenId: number) {
    setSelectedIds((current) =>
      current.includes(tokenId) ? current.filter((id) => id !== tokenId) : [...current, tokenId]
    );
  }

  return (
    <>
      <div className={placement === 'auction-header' ? 'auction-quick-buy-slot' : 'dashboard-quick-buy-slot'}>
        <button type="button" className="dashboard-quick-buy-trigger" onClick={openPool}>
          Quick Buy Membership
        </button>
      </div>
      <dialog ref={poolRef} className="quick-buy-dialog" aria-labelledby="quick-buy-title">
        <div className="quick-buy-dialog__header">
          <div>
            <p className="label">Illustrative inventory · Read-only preview</p>
            <h2 id="quick-buy-title">Quick Buy Membership</h2>
          </div>
          <button
            type="button"
            className="quick-buy-dialog__close"
            aria-label="Close Quick Buy Membership"
            onClick={() => poolRef.current?.close()}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <p className="quick-buy-dialog__intro">
          Quick Buy is a planned pool of membership NFTs that a DAO would deposit into an escrow contract through a
          proposal. You could choose any tokens in the pool and purchase them instantly, without bidding, settling an
          auction, or waiting for one to end. The tokens and prices below are sample data; no escrow pool or purchase is
          live in this preview.
        </p>
        <div className="quick-buy-dialog__inventory" aria-label="Sample membership tokens">
          {QUICK_BUY_PREVIEW_TOKENS.map((token) => {
            const selected = selectedIds.includes(token.tokenId);
            return (
              <button
                key={token.tokenId}
                type="button"
                className="quick-buy-token"
                aria-pressed={selected}
                onClick={() => toggleToken(token.tokenId)}
              >
                <span className="quick-buy-token__art" aria-hidden="true">
                  Membership preview
                </span>
                <span className="quick-buy-token__details">
                  <strong>Token #{token.tokenId}</strong>
                  <span>{formatPreviewXlm(token.priceStroops)}</span>
                </span>
                <span className="quick-buy-token__state">{selected ? 'Selected' : 'Select token'}</span>
              </button>
            );
          })}
        </div>
        {selectedTokens.length > 0 ? (
          <div className="quick-buy-selection" role="status" aria-live="polite">
            <div>
              <strong>
                {selectedTokens.length} {selectedTokens.length === 1 ? 'token' : 'tokens'} selected
              </strong>
              <span>IDs: {selectedTokens.map((token) => `#${token.tokenId}`).join(', ')}</span>
              <span>Total: {formatPreviewXlm(total)}</span>
            </div>
            <button
              type="button"
              className="quick-buy-selection__action"
              onClick={() => confirmRef.current?.showModal()}
            >
              Buy Now
            </button>
          </div>
        ) : null}
      </dialog>
      <dialog ref={confirmRef} className="quick-buy-confirm" aria-labelledby="quick-buy-confirm-title">
        <div className="quick-buy-dialog__header">
          <h2 id="quick-buy-confirm-title">Review purchase</h2>
          <button
            type="button"
            className="quick-buy-dialog__close"
            aria-label="Close purchase review"
            onClick={() => confirmRef.current?.close()}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <p className="quick-buy-confirm__note">Sample transaction preview. No wallet request will be sent.</p>
        <dl className="quick-buy-confirm__summary">
          <div>
            <dt>Tokens</dt>
            <dd>{selectedTokens.length}</dd>
          </div>
          <div>
            <dt>Token IDs</dt>
            <dd>{selectedTokens.map((token) => `#${token.tokenId}`).join(', ')}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatPreviewXlm(total)}</dd>
          </div>
        </dl>
        {blockedMessage ? (
          <p className="quick-buy-confirm__blocked" role="alert">
            {blockedMessage}
          </p>
        ) : null}
        <div className="quick-buy-confirm__actions">
          <button type="button" className="dashboard-auction__action" onClick={() => confirmRef.current?.close()}>
            Back
          </button>
          <button
            type="button"
            className="quick-buy-selection__action"
            onClick={() => setBlockedMessage('Quick Buy is a preview. No wallet request or purchase will be sent.')}
          >
            Confirm purchase
          </button>
        </div>
      </dialog>
    </>
  );
}
