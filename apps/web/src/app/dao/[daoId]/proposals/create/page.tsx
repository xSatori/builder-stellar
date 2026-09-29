// New simplified proposals/create page using the new architecture

'use client';

import { Client as GovernorClient } from '@builder-stellar/governor-bindings';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack } from 'styled-system/jsx';

import { PageSection } from '@/components/page-section';
import { ProposalActionConfirmDialog } from '@/components/proposal/proposal-action-confirm-dialog';
import { ProposalContextRail } from '@/components/proposal/proposal-context-rail';
import { Badge, Button, Callout, Card, Heading, Input, Skeleton, Text, Textarea } from '@/components/ui';
import { useDaoContext } from '@/contexts/dao-context';
import { daoRoute } from '@/lib/dao-routes';
import { analyzeProposalAction } from '@/lib/proposal-action-identity';
import { ActionFormProvider, ActionFormWrapper, ProposalActionQueue } from '@/lib/proposal-actions';
import { buildProposalCallVectors, encodeProposalCallArgs, getProposalActionSummary } from '@/lib/proposal-call';
import { useProposalEligibility } from '@/lib/proposal-eligibility';
import { proposalIdToRouteId } from '@/lib/proposal-id';
import { encodeProposalMetadata, validateProposalMetadataDraft } from '@/lib/proposal-metadata';
import { waitForConfirmation } from '@/lib/transaction-confirmation';
import { useTransactionFeedback } from '@/lib/transaction-feedback';
import { useAuthSessionStore } from '@/stores/auth-session-store';
import { selectDraft, selectHasDraft, useProposalComposerStore } from '@/stores/proposal-composer-store';

export default function ProposalCreatePage() {
  const { daoId } = useDaoContext();
  const router = useRouter();
  const session = useAuthSessionStore();
  const { daoConfig: config } = useDaoContext();
  const draftAddress = session.address || '';

  // Zustand store hooks
  const draft = useProposalComposerStore(selectDraft(draftAddress, daoId));
  const { metadata, queuedActions, editingState } = draft;
  const hasDraft = useProposalComposerStore(selectHasDraft(draftAddress, daoId));

  const updateMetadata = useProposalComposerStore((s) => s.updateMetadata);
  const beginCreate = useProposalComposerStore((s) => s.beginCreate);
  const reset = useProposalComposerStore((s) => s.reset);

  // Queries
  const eligibility = useProposalEligibility(config, session.address);

  // Transaction feedback
  const txFeedback = useTransactionFeedback(config.name);
  const [transactionBusy, setTransactionBusy] = useState(false);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('proposal-title');
  const [contextRailOpen, setContextRailOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewCloseRef = useRef<HTMLButtonElement>(null);
  const reviewDialogRef = useRef<HTMLDivElement>(null);
  const closeContextRail = useCallback(() => setContextRailOpen(false), []);
  const closeReview = useCallback(() => setReviewOpen(false), []);

  const proposalCreationError = eligibility.error?.message;
  const proposalCreationLocked = !eligibility.eligible;
  const proposalCreationDisabledMessage = eligibility.message;
  const draftFindings = queuedActions.flatMap((action, index) =>
    analyzeProposalAction(action, queuedActions.slice(0, index)).filter((finding) => finding.severity === 'error')
  );
  const hasBlockingDraftFindings = draftFindings.length > 0;

  // Metadata validation
  const metadataValidation = validateProposalMetadataDraft(metadata);

  const canReview = metadataValidation.valid && queuedActions.length > 0 && !editingState && !hasBlockingDraftFindings;

  useEffect(() => {
    const sectionIds = ['proposal-title', 'proposal-description', 'proposal-discussion', 'proposal-actions'];
    const updateActiveSection = () => {
      const threshold = Math.min(220, window.innerHeight * 0.35);
      let current = sectionIds[0];
      for (const id of sectionIds) {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= threshold) current = id;
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  useEffect(() => {
    if (!reviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const reviewTrigger = reviewTriggerRef.current;
    document.body.style.overflow = 'hidden';
    reviewCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !transactionBusy) closeReview();
      if (event.key !== 'Tab') return;
      const focusable = reviewDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!reviewDialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      reviewTrigger?.focus();
    };
  }, [closeReview, reviewOpen, transactionBusy]);

  const handleOpenConfirmDialog = () => {
    setReviewOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!session.address) return;

    try {
      setTransactionBusy(true);
      setConfirmDialogOpen(false);
      txFeedback.start('Preparing proposal...');

      // Build call vectors
      const { targets, functions, args } = buildProposalCallVectors(
        queuedActions,
        config.tokenContractId,
        config.treasuryContractId,
        config
      );

      // Encode args and metadata
      const encodedArgs = encodeProposalCallArgs(functions, args);
      const description = encodeProposalMetadata(metadata);

      // Create governor client
      const governor = new GovernorClient({
        contractId: config.governorContractId,
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.passphrase,
        publicKey: session.address,
        signTransaction: async (xdr: string, opts?: { networkPassphrase?: string; address?: string }) =>
          StellarWalletsKit.signTransaction(xdr, {
            networkPassphrase: opts?.networkPassphrase ?? config.passphrase,
            address: opts?.address ?? session.address
          })
      });

      // Submit proposal
      const assembled = await governor.propose({
        targets,
        functions,
        args: encodedArgs,
        description,
        proposer: session.address
      });

      const proposalId = assembled.result ? proposalIdToRouteId(assembled.result) : '';
      const sent = await assembled.signAndSend();
      const hash = sent.sendTransactionResponse?.hash ?? '';

      txFeedback.submitted('Proposal submitted', hash);
      await waitForConfirmation(hash, config.rpcUrl);

      txFeedback.success('Proposal created', hash);

      // Reset store and navigate
      reset(session.address, daoId);
      router.push(proposalId ? daoRoute(daoId, `proposals/${proposalId}`) : daoRoute(daoId, 'proposals'));
    } catch (err: any) {
      console.error('Proposal creation error:', err);
      txFeedback.fail(err, 'Proposal failed');
    } finally {
      setTransactionBusy(false);
    }
  };

  return (
    <>
      <PageSection
        title="Proposal Studio"
        description="Draft the decision, reference the DAO's current state, and verify every on-chain action before asking the wallet to sign."
      >
        <div className="proposal-studio-layout">
          <Stack gap="6">
            {draftAddress && eligibility.loading ? (
              <div role="status" aria-live="polite" aria-busy="true" className="loading-card">
                <span className="sr-only">Checking proposal eligibility</span>
                <Card p="4">
                  <Stack gap="2">
                    <Skeleton style={{ width: '190px', height: '1.1em' }} />
                    <Skeleton style={{ width: '320px', maxWidth: '100%', height: '0.9em' }} />
                  </Stack>
                </Card>
              </div>
            ) : proposalCreationError && !hasDraft ? (
              <Callout
                variant="error"
                title="Unable to check proposal eligibility"
                description={proposalCreationError}
              />
            ) : proposalCreationLocked && !hasDraft ? (
              <Callout
                variant="warning"
                title="Cannot Create Proposals"
                description={proposalCreationDisabledMessage}
              />
            ) : (
              <>
                {proposalCreationError ? (
                  <Callout
                    variant="warning"
                    title="Proposal eligibility could not be checked"
                    description={proposalCreationError}
                  />
                ) : null}
                {proposalCreationLocked && !proposalCreationError ? (
                  <Callout
                    variant="warning"
                    title="Proposal submission is currently unavailable"
                    description={proposalCreationDisabledMessage}
                  />
                ) : null}
                <div className="proposal-composer-layout">
                  <nav className="proposal-composer-nav" aria-label="Proposal fields">
                    <Text className="label">On this page</Text>
                    {[
                      ['proposal-title', 'Title'],
                      ['proposal-description', 'Description'],
                      ['proposal-discussion', 'Discussion'],
                      ['proposal-actions', 'Actions']
                    ].map(([id, label]) => (
                      <a
                        key={id}
                        href={`#${id}`}
                        className={activeSection === id ? 'is-active' : undefined}
                        aria-current={activeSection === id ? 'location' : undefined}
                        onClick={() => setActiveSection(id)}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>

                  <div className="proposal-composer-form">
                    <Heading as="h2" style={{ fontSize: '1.25rem' }}>
                      Proposal details
                    </Heading>
                    <Text className="proposal-composer-intro">
                      Write the decision, then add the on-chain actions it will perform if approved.
                    </Text>

                    <section
                      id="proposal-title"
                      className="proposal-composer-section"
                      aria-labelledby="proposal-title-label"
                    >
                      <label id="proposal-title-label" htmlFor="title">
                        <Text style={{ fontWeight: 600 }}>Title</Text>
                      </label>
                      <Input
                        id="title"
                        value={metadata.title}
                        onChange={(event) => updateMetadata(draftAddress, daoId, { title: event.target.value })}
                        placeholder="Proposal title"
                      />
                      {!metadataValidation.valid && metadataValidation.message ? (
                        <Text className="proposal-composer-validation">{metadataValidation.message}</Text>
                      ) : null}
                    </section>

                    <section
                      id="proposal-description"
                      className="proposal-composer-section"
                      aria-labelledby="proposal-description-label"
                    >
                      <label id="proposal-description-label" htmlFor="description">
                        <Text style={{ fontWeight: 600 }}>Description</Text>
                      </label>
                      <Textarea
                        id="description"
                        value={metadata.description}
                        onChange={(event) => updateMetadata(draftAddress, daoId, { description: event.target.value })}
                        placeholder="Describe what this proposal does"
                        rows={8}
                      />
                    </section>

                    <section
                      id="proposal-discussion"
                      className="proposal-composer-section"
                      aria-labelledby="proposal-discussion-label"
                    >
                      <label id="proposal-discussion-label" htmlFor="url">
                        <Text style={{ fontWeight: 600 }}>Discussion URL (optional)</Text>
                      </label>
                      <Input
                        id="url"
                        value={metadata.url}
                        onChange={(event) => updateMetadata(draftAddress, daoId, { url: event.target.value })}
                        placeholder="https://forum.example.com/proposal-discussion"
                      />
                    </section>

                    <section
                      id="proposal-actions"
                      className="proposal-composer-section"
                      aria-labelledby="proposal-actions-label"
                    >
                      <Heading as="h2" id="proposal-actions-label" style={{ fontSize: '1.25rem' }}>
                        Proposal actions
                      </Heading>
                      <Text className="proposal-composer-intro">
                        Add one or more actions that will execute if this proposal passes.
                      </Text>
                      <ActionFormProvider
                        config={config}
                        session={{ address: session.address, kit: StellarWalletsKit }}
                      >
                        <Stack gap="4">
                          {!editingState ? (
                            <Button onClick={() => beginCreate(draftAddress, daoId)}>Add Action</Button>
                          ) : null}
                          <ActionFormWrapper daoId={daoId} />
                          <Heading as="h3" style={{ fontSize: '1.125rem' }}>
                            Queued Actions ({queuedActions.length})
                          </Heading>
                          <ProposalActionQueue daoId={daoId} />
                        </Stack>
                      </ActionFormProvider>
                    </section>

                    {hasBlockingDraftFindings ? (
                      <Callout
                        variant="error"
                        title="This draft contains duplicate or conflicting actions"
                        description="Remove or replace the flagged action before reviewing the proposal."
                      />
                    ) : null}
                    <div className="form-actions form-actions--split">
                      <Button variant="outline" onClick={() => router.back()}>
                        Cancel
                      </Button>
                      <Button ref={reviewTriggerRef} onClick={() => setReviewOpen(true)} disabled={!canReview}>
                        Review proposal
                      </Button>
                    </div>
                    {!canReview ? (
                      <Text className="proposal-composer-hint">
                        Add a valid title, description, and at least one completed action to review.
                      </Text>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </Stack>
          {!reviewOpen ? (
            <>
              <ProposalContextRail
                key={editingState?.actionType ?? 'no-action'}
                activeActionType={editingState?.actionType}
                mobileOpen={contextRailOpen}
                onMobileClose={closeContextRail}
                mobileTriggerRef={contextTriggerRef}
              />
              <Button
                type="button"
                variant="outline"
                className="proposal-context-mobile-trigger"
                onClick={() => setContextRailOpen(true)}
                ref={contextTriggerRef}
                aria-expanded={contextRailOpen}
                aria-controls="proposal-context-rail"
              >
                Reference DAO context
              </Button>
            </>
          ) : null}
        </div>
      </PageSection>

      {reviewOpen ? (
        <div className="proposal-review-backdrop" role="presentation" onClick={closeReview}>
          <div
            ref={reviewDialogRef}
            className="proposal-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-review-title"
            aria-describedby="proposal-review-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="proposal-review-header">
              <div>
                <Text className="label">Proposal preview</Text>
                <Heading as="h2" id="proposal-review-title">
                  {metadata.title || 'Untitled proposal'}
                </Heading>
                <Text id="proposal-review-description" className="proposal-composer-intro">
                  Review before creating this on-chain proposal
                </Text>
              </div>
              <Button ref={reviewCloseRef} type="button" variant="outline" onClick={closeReview}>
                Close
              </Button>
            </div>
            <div className="proposal-review-body">
              <div className="proposal-review-status">
                <Badge>Draft</Badge>
                <Text>
                  {queuedActions.length} action{queuedActions.length === 1 ? '' : 's'} queued
                </Text>
              </div>
              <Callout
                variant="warning"
                badge="Wallet transaction"
                title="Submitting creates an on-chain governance proposal"
                description="Your wallet will show the final transaction for review. Confirm the contracts, recipients, and amounts before signing."
              />
              <section className="proposal-review-section" aria-labelledby="proposal-review-description-heading">
                <Heading as="h3" id="proposal-review-description-heading">
                  Description
                </Heading>
                <Text className="proposal-review-description-text">{metadata.description}</Text>
                {metadata.url ? (
                  <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="proposal-review-link">
                    Discussion <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </section>
              <section className="proposal-review-section" aria-labelledby="proposal-review-actions-heading">
                <Heading as="h3" id="proposal-review-actions-heading">
                  Actions ({queuedActions.length})
                </Heading>
                <ol className="proposal-review-actions">
                  {queuedActions.map((action) => (
                    <li key={action.id}>{getProposalActionSummary(action)}</li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="proposal-review-footer">
              <Button type="button" variant="outline" onClick={closeReview}>
                Back to edit
              </Button>
              <Button
                type="button"
                onClick={handleOpenConfirmDialog}
                disabled={!canReview || proposalCreationLocked || transactionBusy}
              >
                Submit proposal
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm Dialog */}
      <ProposalActionConfirmDialog
        open={confirmDialogOpen}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmDialogOpen(false)}
        title="Confirm Proposal Creation"
        message={`This will submit ${queuedActions.length} action${queuedActions.length === 1 ? '' : 's'} to the blockchain as a governance proposal. Your wallet will show the final transaction for review before signing.`}
        confirmLabel="Create Proposal"
        busy={transactionBusy}
      />
    </>
  );
}
