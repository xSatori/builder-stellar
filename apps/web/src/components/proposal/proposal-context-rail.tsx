'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useRef, useState } from 'react';
import { Stack } from 'styled-system/jsx';
import useSWR from 'swr';

import { DaoContractList } from '@/components/dao-contract-list';
import { TreasuryAllocationChart } from '@/components/treasury-allocation-chart';
import { Badge, Button, Callout, CopyIconButton, Input, Skeleton, Text } from '@/components/ui';
import { useDaoContext } from '@/contexts/dao-context';
import { findAsset } from '@/lib/assets-config';
import { useGoldskyMemberList } from '@/lib/goldsky-queries';
import { useTreasuryBalances } from '@/lib/treasury-queries';

import type { ProposalListResponse } from './types';

type ContextTab = 'user' | 'contracts' | 'treasury' | 'members' | 'history';

type ProposalContextRailProps = {
  address: string | null;
};

const tabs: Array<{ id: ContextTab; label: string }> = [
  { id: 'user', label: 'User' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'members', label: 'Members' },
  { id: 'history', label: 'History' }
];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const json = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(json.message || 'Request failed');
  return json;
}

function formatNumber(value: string | number) {
  try {
    return new Intl.NumberFormat().format(typeof value === 'number' ? value : BigInt(value));
  } catch {
    return String(value);
  }
}

function formatBalance(balance: string) {
  const value = Number(balance);
  if (!Number.isFinite(value)) return balance;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function formatDate(timestamp: number) {
  if (!timestamp) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestamp * 1000));
}

function DataState({
  loading,
  error,
  hasData,
  loadingContent,
  children
}: {
  loading: boolean;
  error?: Error;
  hasData: boolean;
  loadingContent: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div role="status" aria-busy="true">
        {loadingContent}
      </div>
    );
  }

  if (error && !hasData) {
    return <Callout variant="error" title="Data unavailable" description={error.message} />;
  }

  return (
    <>
      {error ? <Callout variant="error" title="Some data may be out of date" description={error.message} /> : null}
      {children}
    </>
  );
}

function PanelSkeleton({ type }: { type: 'balances' | 'members' | 'history' }) {
  const count = type === 'members' ? 4 : 3;

  return (
    <div className="proposal-context-loading">
      {Array.from({ length: count }, (_, index) => (
        <div className="proposal-context-skeleton-row" key={index}>
          <Skeleton style={{ width: type === 'history' ? '68%' : '42%', height: '0.85rem' }} />
          <Skeleton style={{ width: type === 'members' ? '78%' : '34%', height: '0.7rem' }} />
        </div>
      ))}
    </div>
  );
}

function TreasuryPanel({ config }: { config: Parameters<typeof useTreasuryBalances>[0] }) {
  const { data: balances, error, isLoading, mutate } = useTreasuryBalances(config);
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);

  const copyContract = async (contractId: string) => {
    try {
      await navigator.clipboard.writeText(contractId);
      setCopiedAsset(contractId);
      window.setTimeout(() => setCopiedAsset((current) => (current === contractId ? null : current)), 1500);
    } catch {
      setCopiedAsset(null);
    }
  };

  return (
    <Stack gap="3">
      <div className="proposal-context-panel-actions">
        <Text className="proposal-context-detail">Contract-held balances</Text>
        <Button type="button" variant="outline" size="sm" onClick={() => void mutate()} disabled={isLoading}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </Button>
      </div>
      <DataState
        loading={isLoading && !balances}
        error={error}
        hasData={Boolean(balances)}
        loadingContent={<PanelSkeleton type="balances" />}
      >
        {balances ? <TreasuryAllocationChart balances={balances} /> : null}
        <div className="proposal-context-list">
          {balances?.length ? (
            balances.map((asset) => {
              const contractId = findAsset(config.name, asset.assetCode)?.contractId;
              return (
                <div
                  className="proposal-context-row proposal-context-asset"
                  key={`${asset.assetCode}-${asset.assetIssuer ?? 'native'}`}
                >
                  <div>
                    <strong>{asset.assetCode}</strong>
                    <Text className="proposal-context-detail">
                      {formatBalance(asset.balance)} {asset.assetCode}
                    </Text>
                  </div>
                  {contractId ? (
                    <CopyIconButton
                      copied={copiedAsset === contractId}
                      onClick={() => void copyContract(contractId)}
                      label={`Copy ${asset.assetCode} contract address`}
                    />
                  ) : (
                    <Text className="proposal-context-detail">Address unavailable</Text>
                  )}
                </div>
              );
            })
          ) : (
            <Text className="proposal-context-detail">No assets are configured for this treasury.</Text>
          )}
        </div>
      </DataState>
    </Stack>
  );
}

function MemberPanel({ daoTokenAddress }: { daoTokenAddress: string }) {
  const { daoId } = useDaoContext();
  const [query, setQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useGoldskyMemberList(daoTokenAddress, 100);
  const normalizedQuery = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (data?.items ?? []).filter(
        (member) => !normalizedQuery || member.address.toLowerCase().includes(normalizedQuery)
      ),
    [data?.items, normalizedQuery]
  );
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress((current) => (current === address ? null : current)), 1200);
    } catch {
      setCopiedAddress(null);
    }
  };

  return (
    <div className="proposal-context-members">
      <div className="proposal-context-search">
        <Search size={15} aria-hidden="true" />
        <Input
          aria-label="Search DAO members"
          placeholder="Search address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="proposal-context-panel-actions">
        <Text className="proposal-context-detail">{data ? `${data.total} members indexed` : 'Member directory'}</Text>
        <Button type="button" variant="outline" size="sm" onClick={() => void mutate()} disabled={isLoading}>
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </Button>
      </div>
      <DataState
        loading={isLoading && !data}
        error={error}
        hasData={Boolean(data)}
        loadingContent={<PanelSkeleton type="members" />}
      >
        {rows.length ? (
          <div className="proposal-context-list">
            {rows.slice(0, 12).map((member, index) => (
              <div className="proposal-context-member" key={member.address}>
                <div className="proposal-context-member-heading">
                  <Badge>#{index + 1}</Badge>
                  <Link
                    href={`/dao/${encodeURIComponent(daoId)}/members/${encodeURIComponent(member.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={member.address}
                    className="proposal-context-member-link"
                  >
                    {member.address.length > 16
                      ? `${member.address.slice(0, 6)}…${member.address.slice(-6)}`
                      : member.address}
                  </Link>
                  <CopyIconButton
                    copied={copiedAddress === member.address}
                    onClick={() => void copyAddress(member.address)}
                    label={`Copy ${member.address}`}
                  />
                </div>
                <Text className="proposal-context-detail">
                  {formatNumber(member.voting_power)} voting power · {member.owned_token_count} tokens
                </Text>
              </div>
            ))}
            {rows.length > 12 ? <Text className="proposal-context-detail">Showing the top 12 matches.</Text> : null}
          </div>
        ) : (
          <Text className="proposal-context-detail">No members match that address.</Text>
        )}
      </DataState>
    </div>
  );
}

function HistoryPanel({ daoId }: { daoId: string }) {
  const { data, error, isLoading } = useSWR<ProposalListResponse>(
    `/api/dao/${encodeURIComponent(daoId)}/proposals?limit=8`,
    fetchJson,
    { keepPreviousData: true }
  );

  return (
    <DataState
      loading={isLoading && !data}
      error={error}
      hasData={Boolean(data)}
      loadingContent={<PanelSkeleton type="history" />}
    >
      <div className="proposal-context-list">
        {data?.items.length ? (
          data.items.map((proposal) => (
            <Link
              className="proposal-context-history-row"
              href={`/dao/${daoId}/proposals/${proposal.proposalNumber}`}
              key={proposal.proposalId}
            >
              <div>
                <Text className="proposal-context-detail">
                  #{proposal.proposalNumber} · {formatDate(proposal.timestamp)}
                </Text>
                <strong>{proposal.metadata.title || 'Untitled proposal'}</strong>
              </div>
              <Badge>{proposal.stateLabel}</Badge>
            </Link>
          ))
        ) : (
          <Text className="proposal-context-detail">
            No proposals yet. This could be the DAO&apos;s first decision.
          </Text>
        )}
      </div>
    </DataState>
  );
}

export function ProposalContextRail({ address }: ProposalContextRailProps) {
  const { daoId, daoTokenAddress, daoConfig: config } = useDaoContext();
  const [activeTab, setActiveTab] = useState<ContextTab | null>(null);
  const [copiedUser, setCopiedUser] = useState(false);
  const buttonsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const suppressFocusOpen = useRef(false);

  const closeFlyout = () => {
    const trigger = activeTab ? buttonsRef.current[activeTab] : null;
    setActiveTab(null);
    if (trigger && document.activeElement !== trigger) {
      suppressFocusOpen.current = true;
      trigger.focus();
    }
  };

  const copyUserAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedUser(true);
      window.setTimeout(() => setCopiedUser(false), 1500);
    } catch {
      setCopiedUser(false);
    }
  };

  return (
    <div className="proposal-workspace-sidebar">
      <Text className="label">DAO workspace</Text>
      <div className="proposal-workspace-buttons" aria-label="DAO workspace views">
        {tabs.map((tab) => (
          <Fragment key={tab.id}>
            <button
              className={activeTab === tab.id ? 'is-active' : undefined}
              type="button"
              ref={(element) => {
                buttonsRef.current[tab.id] = element;
              }}
              onMouseEnter={() => {
                if (window.matchMedia('(min-width: 1920px) and (hover: hover)').matches) setActiveTab(tab.id);
              }}
              onFocus={() => {
                if (suppressFocusOpen.current) {
                  suppressFocusOpen.current = false;
                  return;
                }
                if (window.matchMedia('(min-width: 1920px)').matches) setActiveTab(tab.id);
              }}
              onClick={() => setActiveTab(tab.id)}
              aria-expanded={activeTab === tab.id}
              aria-controls="proposal-workspace-flyout"
            >
              {tab.label}
            </button>
            {tab.id === 'user' ? <div className="proposal-workspace-user-divider" role="separator" /> : null}
          </Fragment>
        ))}
      </div>
      {activeTab ? (
        <>
          <div className="proposal-workspace-backdrop" aria-hidden="true" />
          <aside
            className="proposal-workspace-flyout"
            id="proposal-workspace-flyout"
            aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label} context`}
          >
            <div className="proposal-workspace-flyout__header">
              <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
              <button type="button" onClick={closeFlyout} aria-label="Close DAO workspace panel">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="proposal-workspace-flyout__body">
              {activeTab === 'user' ? (
                <Stack gap="2">
                  <Text className="proposal-context-kicker">Connected wallet</Text>
                  {address ? (
                    <>
                      <div className="proposal-workspace-address-row">
                        <Text className="proposal-workspace-address">{address}</Text>
                        <CopyIconButton
                          copied={copiedUser}
                          onClick={() => void copyUserAddress()}
                          label="Copy wallet address"
                        />
                      </div>
                    </>
                  ) : (
                    <Text className="proposal-context-detail">Connect a wallet to see and copy its address.</Text>
                  )}
                </Stack>
              ) : null}
              {activeTab === 'treasury' ? (
                <Stack gap="4">
                  <div>
                    <Text className="proposal-context-kicker">Available resources</Text>
                    <Text className="proposal-context-intro">
                      Check balances before proposing a transfer or funding change.
                    </Text>
                  </div>
                  <TreasuryPanel config={config} />
                </Stack>
              ) : null}
              {activeTab === 'members' ? (
                <Stack gap="4">
                  <div>
                    <Text className="proposal-context-kicker">People in the DAO</Text>
                    <Text className="proposal-context-intro">Find a recipient or verify voting power.</Text>
                  </div>
                  <MemberPanel daoTokenAddress={daoTokenAddress} />
                </Stack>
              ) : null}
              {activeTab === 'contracts' ? (
                <Stack gap="4">
                  <div>
                    <Text className="proposal-context-kicker">On-chain addresses</Text>
                    <Text className="proposal-context-intro">Copy the contracts this proposal can interact with.</Text>
                  </div>
                  <DaoContractList config={config} className="proposal-context-list" compact />
                </Stack>
              ) : null}
              {activeTab === 'history' ? (
                <Stack gap="4">
                  <div>
                    <Text className="proposal-context-kicker">Past decisions</Text>
                    <Text className="proposal-context-intro">See how this DAO has handled similar proposals.</Text>
                  </div>
                  <HistoryPanel daoId={daoId} />
                </Stack>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
