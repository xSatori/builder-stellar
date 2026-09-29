import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthSessionStore } from '@/stores/auth-session-store';
import { useProposalComposerStore } from '@/stores/proposal-composer-store';

import { ActionFormShell } from './action-form-shell';
import { ProposalActionQueue, ProposalActionQueueItems } from './proposal-action-queue';

vi.mock('./action-form-wrapper', () => ({ ActionFormWrapper: () => 'Action editor' }));

const address = 'GINLINEACTIONTEST';
const daoId = 'dao-inline-action-test';
const firstAction = { id: 'first', type: 'mint-governance-token' as const, recipient: 'GFIRST', amount: '1' };
const secondAction = { id: 'second', type: 'mint-governance-token' as const, recipient: 'GSECOND', amount: '2' };

beforeEach(() => {
  vi.stubGlobal('React', React);
  useAuthSessionStore.getState().setAuthenticatedAddress(address);
});

afterEach(() => {
  useProposalComposerStore.getState().reset(address, daoId);
  useAuthSessionStore.getState().resetAuth();
  vi.unstubAllGlobals();
});

describe('ProposalActionQueue inline editor', () => {
  it('starts with Add action and no separate queue empty state', () => {
    const markup = renderToStaticMarkup(<ProposalActionQueue daoId={daoId} />);

    expect(markup).toContain('Add action');
    expect(markup).not.toContain('No actions queued yet');
  });

  it('places a new editor after saved cards and hides Add action until save', () => {
    const markup = renderToStaticMarkup(
      <ProposalActionQueueItems
        daoId={daoId}
        editable
        queuedActions={[firstAction, secondAction]}
        editingState={{ mode: 'create', actionType: 'mint-governance-token', draftData: {} }}
        onEdit={() => {}}
        onRemove={() => {}}
        onAdd={() => {}}
      />
    );

    expect(markup.indexOf('GSECOND')).toBeLessThan(markup.indexOf('Action editor'));
    expect(markup).not.toContain('Add action');
  });

  it('replaces an edited card in place without duplicating the saved card', () => {
    const markup = renderToStaticMarkup(
      <ProposalActionQueueItems
        daoId={daoId}
        editable
        queuedActions={[firstAction, secondAction]}
        editingState={{ mode: 'edit', actionType: 'mint-governance-token', index: 0, draftData: {} }}
        onEdit={() => {}}
        onRemove={() => {}}
        onAdd={() => {}}
      />
    );

    expect(markup.indexOf('Action editor')).toBeLessThan(markup.indexOf('GSECOND'));
    expect(markup).not.toContain('GFIRST');
    expect(markup).not.toContain('Add action');
  });

  it('saves successive actions in order and closes each new editor', async () => {
    const store = useProposalComposerStore.getState();
    await store.beginCreate(address, daoId);
    expect(useProposalComposerStore.getState().draftsByWallet[address][daoId].editingState?.mode).toBe('create');

    store.saveAction(address, daoId, firstAction);
    expect(useProposalComposerStore.getState().draftsByWallet[address][daoId].editingState).toBeNull();
    await store.beginCreate(address, daoId);
    store.saveAction(address, daoId, secondAction);

    const savedActions = useProposalComposerStore.getState().draftsByWallet[address][daoId].queuedActions;
    expect(savedActions.map((action) => action.id)).toEqual(['first', 'second']);
    expect(useProposalComposerStore.getState().draftsByWallet[address][daoId].editingState).toBeNull();
  });

  it('cancels an edit without changing the saved action', async () => {
    const store = useProposalComposerStore.getState();
    store.replaceDraft(address, daoId, {
      metadata: { title: '', description: '', url: '' },
      action: firstAction
    });
    store.addAdminAction({
      address,
      daoId,
      metadata: { title: '', description: '', url: '' },
      action: secondAction
    });

    await store.beginEdit(address, daoId, 0);
    store.updateDraft(address, daoId, { recipient: 'GCHANGED', amount: '3' });
    expect(useProposalComposerStore.getState().draftsByWallet[address][daoId].editingState?.index).toBe(0);

    store.cancelEdit(address, daoId);
    const draft = useProposalComposerStore.getState().draftsByWallet[address][daoId];
    expect(draft.queuedActions.map((action) => action.recipient)).toEqual(['GFIRST', 'GSECOND']);
    expect(draft.editingState).toBeNull();
  });

  it('keeps the old read-only empty state for draft panel consumers', () => {
    const markup = renderToStaticMarkup(<ProposalActionQueue daoId={daoId} editable={false} />);
    expect(markup).toContain('No actions queued yet');
    expect(markup).not.toContain('Add action');
  });

  it('labels the editor save control and shows validation errors inside its card', () => {
    const markup = renderToStaticMarkup(
      <ActionFormShell
        mode="create"
        actionType="mint-governance-token"
        actionLabel="Mint governance token"
        disabled={false}
        busy={false}
        validationErrors={{ valid: false, message: 'Recipient is required' }}
        onActionTypeChange={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
      >
        <div>Fields</div>
      </ActionFormShell>
    );

    expect(markup).toContain('Save action');
    expect(markup).toContain('Recipient is required');
    expect(markup).toContain('Cancel new action');
  });
});
