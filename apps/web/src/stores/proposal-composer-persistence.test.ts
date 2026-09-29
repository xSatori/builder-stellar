import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persisted proposal actions', () => {
  it('restores saved actions in order after reloading the store', async () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    };
    vi.stubGlobal('window', { localStorage });
    vi.resetModules();

    const { useProposalComposerStore: firstStore } = await import('./proposal-composer-store');
    const wallet = 'GPERSISTEDACTIONTEST';
    const daoId = 'dao-persisted-action-test';
    const firstAction = { id: 'first', type: 'mint-governance-token' as const, recipient: 'GFIRST', amount: '1' };
    const secondAction = { id: 'second', type: 'mint-governance-token' as const, recipient: 'GSECOND', amount: '2' };

    firstStore.getState().replaceDraft(wallet, daoId, {
      metadata: { title: 'Persisted proposal', description: 'Description', url: '' },
      action: firstAction
    });
    firstStore.getState().addAdminAction({
      address: wallet,
      daoId,
      metadata: { title: '', description: '', url: '' },
      action: secondAction
    });
    expect(values.has('dao.proposal-drafts.v3')).toBe(true);

    vi.resetModules();
    const { selectDraft, useProposalComposerStore: reloadedStore } = await import('./proposal-composer-store');
    await reloadedStore.persist.rehydrate();
    const restored = selectDraft(wallet, daoId)(reloadedStore.getState());

    expect(restored.queuedActions.map((action) => action.id)).toEqual(['first', 'second']);
    expect(restored.editingState).toBeNull();
    expect(restored.metadata.title).toBe('Persisted proposal');
  });
});
