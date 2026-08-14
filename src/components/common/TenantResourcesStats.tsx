import { useMemo } from 'react';
import {
  getAppliedObjectsForTable,
  getManagedObjectReadyStatus,
  isResourceReady,
} from '../../resources/tenantResources';
import { useFetchedResources } from './ManagedResources';
import { StatCard } from './StatCard';
import { SummaryCardGrid } from './SummaryCardGrid';

export interface TenantResourcesStatsProps {
  items: any[];
  /** 'tenant' | 'global' affects the labels for the CRs card. */
  scope?: 'tenant' | 'global';
}

/**
 * Shared summary tiles for Tenant Resources and Global Tenant Resources lists.
 * - Card 1: Count of the TenantResource/GlobalTenantResource CRs + pie of their own Ready condition.
 * - Card 2: Total replicated (managed) objects across them + pie of Ready status of those objects (live-fetched conditions).
 *
 * Reuses the fetching logic from ManagedResources (via useFetchedResources) to avoid duplication.
 */
export function TenantResourcesStats({ items, scope = 'tenant' }: TenantResourcesStatsProps) {
  const isGlobal = scope === 'global';
  const crTitle = isGlobal ? 'GLOBAL TENANT RESOURCES' : 'TENANT RESOURCES';

  // 1) Own CR readiness (cheap, from conditions in the listed items)
  const own = useMemo(() => {
    let ready = 0;
    (items || []).forEach(it => {
      if (isResourceReady(it)) ready++;
    });
    const total = items?.length || 0;
    return { ready, notReady: total - ready, total };
  }, [items]);

  // 2) All replicated objects from these CRs, fetched live for accurate Ready (conditions)
  const allApplied = useMemo(
    () => (items || []).flatMap(it => getAppliedObjectsForTable(it)),
    [items]
  );
  const liveObjects = useFetchedResources(allApplied);

  const repl = useMemo(() => {
    let ready = 0;
    let notReady = 0;
    let unknown = 0;

    (liveObjects || []).forEach((obj: any) => {
      if (!obj?.metadata) {
        unknown++;
        return;
      }
      if (!obj.metadata.creationTimestamp) {
        // stub: could not be fetched (not found or error)
        unknown++;
        return;
      }
      const statusInfo = getManagedObjectReadyStatus(obj, allApplied);
      if (statusInfo.color === 'success' || statusInfo.label.toLowerCase() === 'true') {
        ready++;
      } else if (statusInfo.color === 'error') {
        notReady++;
      } else {
        unknown++;
      }
    });

    return {
      ready,
      notReady,
      unknown,
      total: liveObjects?.length || 0,
    };
  }, [liveObjects, allApplied]);

  const hasOwn = own.total > 0;
  const hasRepl = repl.total > 0 || allApplied.length > 0;

  return (
    <SummaryCardGrid columns={2} marginBottom={2} inset>
      <StatCard
        label={crTitle}
        total={own.total}
        segments={
          hasOwn
            ? [
                { name: 'Ready', value: own.ready, color: '#4caf50' },
                { name: 'Not Ready', value: own.notReady, color: '#f44336' },
              ]
            : []
        }
        chips={[
          { label: `${own.ready} Ready`, color: 'success' },
          { label: `${own.notReady} Not Ready`, color: 'error' },
        ]}
      />

      <StatCard
        label="REPLICATED RESOURCES"
        total={repl.total || allApplied.length}
        segments={
          hasRepl
            ? [
                { name: 'Ready', value: repl.ready, color: '#4caf50' },
                { name: 'Not Ready', value: repl.notReady, color: '#f44336' },
                { name: 'Unknown', value: repl.unknown, color: '#9e9e9e' },
              ]
            : []
        }
        chips={[
          { label: `${repl.ready} Ready`, color: 'success' },
          { label: `${repl.notReady} Not Ready`, color: 'error' },
          ...(repl.unknown > 0
            ? [{ label: `${repl.unknown} Unknown`, color: 'default' as const }]
            : []),
        ]}
      />
    </SummaryCardGrid>
  );
}

export default TenantResourcesStats;
