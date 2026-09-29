// src/lib/proposal-actions/components/action-form-shell.tsx

'use client';

import type { ReactNode } from 'react';
import { Stack } from 'styled-system/jsx';

import { Badge, Button, Callout, Card, FieldLabel, Select, Skeleton, Text } from '@/components/ui';

import { getAllActionHandlers } from '../registry';
import type { PreconditionResult, ProposalActionType, ValidationResult } from '../types';

export interface ActionFormShellProps {
  mode: 'create' | 'edit';
  actionType: ProposalActionType;
  actionLabel: string;
  disabled: boolean;
  busy: boolean;
  preconditionResult?: PreconditionResult;
  validationErrors?: ValidationResult | null;
  onActionTypeChange: (type: ProposalActionType) => void;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export function ActionFormShell({
  mode,
  actionType,
  disabled,
  busy,
  preconditionResult,
  validationErrors,
  onActionTypeChange,
  onSave,
  onCancel,
  children
}: ActionFormShellProps) {
  const allHandlers = getAllActionHandlers();

  return (
    <Card p="5">
      <Stack gap="3">
        {/* Precondition blocking message */}
        {preconditionResult && !preconditionResult.canExecute && preconditionResult.loading ? (
          <div role="status" aria-busy="true" className="inline-loading">
            <span className="sr-only">Checking action requirements</span>
            <Skeleton style={{ width: '220px', height: '1.1em' }} />
          </div>
        ) : null}
        {preconditionResult && !preconditionResult.canExecute && !preconditionResult.loading ? (
          <Callout variant="error" title={preconditionResult.reason} />
        ) : null}
        {validationErrors && !validationErrors.valid ? (
          <Callout variant="error" title={validationErrors.message} />
        ) : null}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'flex-start'
          }}
        >
          <Stack gap="1">
            <Badge>{mode === 'edit' ? 'Editing' : 'Action builder'}</Badge>
            <Text className="lede" style={{ margin: 0, fontSize: '1rem' }}>
              {mode === 'edit' ? 'Edit action' : 'New action'}
            </Text>
          </Stack>
        </div>

        {/* Action Type Selector */}
        <Stack gap="2">
          <FieldLabel htmlFor="proposal-action-type">Action type</FieldLabel>
          <Select
            id="proposal-action-type"
            value={actionType}
            onChange={(event) => onActionTypeChange(event.target.value as ProposalActionType)}
            disabled={disabled}
            aria-label="Action type"
          >
            {allHandlers.map((handler) => (
              <option key={handler.type} value={handler.type}>
                {handler.label}
              </option>
            ))}
          </Select>
          <Text style={{ fontSize: '0.875rem', color: 'var(--gray-11)' }}>
            Each saved action becomes a separate governor call in the final proposal.
          </Text>
        </Stack>

        {/* Form Content (children) */}
        {children}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {mode === 'edit' ? 'Cancel edit' : 'Cancel new action'}
          </Button>
          <Button type="button" onClick={onSave} disabled={disabled}>
            Save action
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
