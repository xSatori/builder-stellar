// src/lib/proposal-actions/components/proposal-action-queue.tsx

'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Stack } from 'styled-system/jsx';

import { ProposalActionConfirmDialog } from '@/components/proposal/proposal-action-confirm-dialog';
import { Button, Card, Text } from '@/components/ui';
import { getProposalActionSummary } from '@/lib/proposal-call';
import { useAuthSessionStore } from '@/stores/auth-session-store';
import {
  type EditingState,
  normalizeWalletAddress,
  selectQueuedActions,
  useProposalComposerStore
} from '@/stores/proposal-composer-store';

import { getActionHandler } from '../registry';
import type { ProposalQueuedAction } from '../types';
import { ActionFormWrapper } from './action-form-wrapper';

type ConfirmDialogState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

type ProposalActionQueueItemsProps = {
  daoId: string;
  editable: boolean;
  queuedActions: ProposalQueuedAction[];
  editingState: EditingState | null;
  onEdit: (index: number) => void;
  onRemove: (index: number, actionLabel: string) => void;
  onAdd: () => void;
};

export function ProposalActionQueueItems({
  daoId,
  editable,
  queuedActions,
  editingState,
  onEdit,
  onRemove,
  onAdd
}: ProposalActionQueueItemsProps) {
  return (
    <Stack gap="3" className="proposal-action-list">
      {queuedActions.map((action, index) => {
        const handler = getActionHandler(action.type);

        if (editable && editingState?.mode === 'edit' && editingState.index === index) {
          return <ActionFormWrapper key={action.id} daoId={daoId} />;
        }

        return (
          <Card key={action.id} p="4" className="proposal-action-card">
            <Stack gap="3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <Text style={{ fontWeight: 600, marginBottom: '4px' }}>{handler.label}</Text>
                  <Text
                    className="proposal-action-card__summary"
                    style={{ fontSize: '0.875rem', color: 'var(--gray-11)' }}
                  >
                    {getProposalActionSummary(action)}
                  </Text>
                </div>
                <div style={{ display: 'flex', flex: 'none', gap: '8px' }}>
                  {editable ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(index)}>
                      Edit
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRemove(index, handler.label)}
                    aria-label={`Remove action ${index + 1}: ${handler.label}`}
                    title="Remove action"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Stack>
          </Card>
        );
      })}
      {editable && editingState?.mode === 'create' ? <ActionFormWrapper daoId={daoId} /> : null}
      {editable && !editingState ? (
        <Button type="button" onClick={onAdd}>
          Add action
        </Button>
      ) : null}
    </Stack>
  );
}

export function ProposalActionQueue({ daoId, editable = true }: { daoId: string; editable?: boolean }) {
  const address = useAuthSessionStore((state) => state.address);
  const walletKey = normalizeWalletAddress(address);
  const queuedActions = useProposalComposerStore(selectQueuedActions(address, daoId));
  const editingState = useProposalComposerStore((s) => s.draftsByWallet[walletKey]?.[daoId]?.editingState ?? null);
  const beginEdit = useProposalComposerStore((s) => s.beginEdit);
  const beginCreate = useProposalComposerStore((s) => s.beginCreate);
  const removeAction = useProposalComposerStore((s) => s.removeAction);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  const handleEdit = (index: number) => {
    // If already editing a different action, confirm before switching
    if (editingState && editingState.index !== index) {
      setConfirmDialog({
        open: true,
        title: 'Switch to editing this action?',
        message:
          editingState.mode === 'edit'
            ? 'Your unsaved changes will be discarded. The original saved action will remain unchanged.'
            : 'Your unsaved action will be discarded.',
        confirmLabel: 'Switch',
        onConfirm: () => {
          beginEdit(address, daoId, index);
          setConfirmDialog(null);
        }
      });
      return;
    }
    beginEdit(address, daoId, index);
  };

  const handleRemove = (index: number, actionLabel: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remove action?',
      message: `Are you sure you want to remove this ${actionLabel} action?`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        removeAction(address, daoId, index);
        setConfirmDialog(null);
      }
    });
  };

  if (!editable && queuedActions.length === 0) {
    return (
      <Card p="4">
        <Text style={{ color: 'var(--gray-11)' }}>No actions queued yet. Add an action above to get started.</Text>
      </Card>
    );
  }

  return (
    <>
      <ProposalActionQueueItems
        daoId={daoId}
        editable={editable}
        queuedActions={queuedActions}
        editingState={editingState}
        onEdit={handleEdit}
        onRemove={handleRemove}
        onAdd={() => beginCreate(address, daoId)}
      />
      <ProposalActionConfirmDialog
        open={confirmDialog?.open ?? false}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel ?? 'Confirm'}
        busy={false}
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}
