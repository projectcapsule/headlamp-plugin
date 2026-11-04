import { getAppliedObjectsForTable } from '../../resources/tenantResources.helpers';
import { parseKubernetesQuantity, usageSeverity } from '../../utils/quantity';
import { getTenantSpaces } from '../../utils/tenantSpaces';
import type { ResourceData } from './overviewClient';

export type DashboardState =
  | 'ready'
  | 'failed'
  | 'warning'
  | 'reconciling'
  | 'cordoned'
  | 'unknown';
export const DASHBOARD_STATES: DashboardState[] = [
  'ready',
  'failed',
  'warning',
  'reconciling',
  'cordoned',
  'unknown',
];
export const STATE_LABELS = {
  ready: 'Ready',
  failed: 'Not Ready',
  warning: 'Warning',
  reconciling: 'Reconciling',
  cordoned: 'Cordoned',
  unknown: 'Unknown',
};
export const STATE_COLORS = {
  ready: '#4caf50',
  failed: '#f44336',
  warning: '#ff9800',
  reconciling: '#2196f3',
  cordoned: '#ff9800',
  unknown: '#9e9e9e',
};

/** Peak of independent resource ratios; CPU and memory quantities are never added. */
export function quotaPeak(item: ResourceData): number | undefined {
  const data = item.jsonData || item;
  const allocation = data.status?.total || data.status?.allocation;
  const pairs = allocation
    ? Object.keys(allocation.hard || {})
        .filter(key => allocation.used?.[key] !== undefined)
        .map(key => [allocation.used[key], allocation.hard[key]])
    : data.spec?.limit !== undefined && data.status?.usage?.used !== undefined
    ? [[data.status.usage.used, data.spec.limit]]
    : [];
  if (!pairs.length) return undefined;
  return Math.max(
    ...pairs.map(([used, hard]) => {
      const limit = parseKubernetesQuantity(hard);
      const value = parseKubernetesQuantity(used);
      return limit > 0 ? (value / limit) * 100 : value > 0 ? 100 : 0;
    })
  );
}

export function resourceState(item: ResourceData): DashboardState {
  const data = item.jsonData || item;
  if (data.spec?.cordoned || String(data.status?.state).toLowerCase() === 'cordoned')
    return 'cordoned';
  const conditions = data.status?.conditions || [];
  const ready = conditions.find((condition: any) => condition.type === 'Ready');
  const observed = ready?.observedGeneration ?? data.status?.observedGeneration;
  if (
    observed !== undefined &&
    data.metadata?.generation !== undefined &&
    observed < data.metadata.generation
  )
    return 'reconciling';
  if (
    conditions.some(
      (condition: any) =>
        ['Stalled', 'Exhausted'].includes(condition.type) &&
        String(condition.status).toLowerCase() === 'true'
    )
  )
    return 'failed';
  if (String(ready?.status).toLowerCase() === 'false') return 'failed';
  if (
    conditions.some(
      (condition: any) =>
        condition.type === 'Reconciling' && String(condition.status).toLowerCase() === 'true'
    )
  )
    return 'reconciling';
  const peak = quotaPeak(data);
  if (peak !== undefined) {
    const severity = usageSeverity(peak);
    if (severity === 'critical') return 'failed';
    if (severity === 'warning') return 'warning';
  }
  if (String(ready?.status).toLowerCase() === 'true') return 'ready';
  if (data.kind === 'Tenant' && String(data.status?.state).toLowerCase() === 'active')
    return 'ready';
  if (
    data.kind === 'ResourcePoolClaim' &&
    conditions.some(
      (condition: any) =>
        condition.type === 'Bound' && String(condition.status).toLowerCase() === 'true'
    )
  )
    return 'ready';
  return 'unknown';
}

export function resourceMessage(item: ResourceData): string {
  const data = item.jsonData || item;
  const conditions = data.status?.conditions || [];
  const problem =
    conditions.find(
      (condition: any) =>
        ['Ready', 'Bound'].includes(condition.type) &&
        String(condition.status).toLowerCase() !== 'true'
    ) ||
    conditions.find(
      (condition: any) =>
        ['Exhausted', 'Stalled', 'Reconciling', 'Cordoned'].includes(condition.type) &&
        String(condition.status).toLowerCase() === 'true'
    );
  if (problem?.message || problem?.reason) return problem.message || problem.reason;
  const peak = quotaPeak(data);
  if (peak !== undefined && peak >= 85) return `Peak quota utilization: ${peak.toFixed(1)}%.`;
  return STATE_LABELS[resourceState(data)];
}

export function summarize(items: ResourceData[]) {
  const counts: Record<DashboardState, number> = {
    ready: 0,
    failed: 0,
    warning: 0,
    reconciling: 0,
    cordoned: 0,
    unknown: 0,
  };
  for (const item of items) counts[resourceState(item)]++;
  return { ...counts, total: items.length };
}

export function controllerReady(item: ResourceData): boolean {
  const desired = item.spec?.replicas ?? 1;
  return (
    desired === 0 ||
    ((item.status?.readyReplicas || 0) >= desired &&
      (item.status?.observedGeneration || 0) >= (item.metadata?.generation || 0))
  );
}

export function tenantNamespaceRows(
  tenants: ResourceData[],
  namespaces: string[] = [],
  excludeNamespaced = false
) {
  return tenants
    .map(tenant => {
      const spaces = getTenantSpaces(tenant);
      const names = Array.isArray(tenant.status?.namespaces) ? tenant.status.namespaces : [];
      const rows = [...new Set([...spaces.map(space => space.name), ...names])]
        .filter(
          name => !excludeNamespaced && name && (!namespaces.length || namespaces.includes(name))
        )
        .map(name => {
          const space = spaces.find(value => value.name === name);
          const condition = space?.conditions?.find(value => value.type === 'Ready');
          const state: DashboardState =
            String(condition?.status).toLowerCase() === 'true'
              ? 'ready'
              : String(condition?.status).toLowerCase() === 'false'
              ? 'failed'
              : 'unknown';
          return {
            name,
            state,
            message: condition?.message || condition?.reason || STATE_LABELS[state],
          };
        });
      return {
        tenant,
        spaces: rows,
        ready: rows.filter(space => space.state === 'ready').length,
        failed: rows.filter(space => space.state === 'failed').length,
      };
    })
    .sort(
      (left, right) =>
        right.failed - left.failed ||
        right.spaces.length - left.spaces.length ||
        left.tenant.metadata.name.localeCompare(right.tenant.metadata.name)
    );
}

/** Controller-reported inventory only; the dashboard does not GET every replicated object. */
export function managedInventory(
  resources: ResourceData[],
  namespaces: string[] = [],
  excludeNamespaced = false
) {
  const entries = new Map<string, ResourceData>();
  for (const resource of resources)
    for (const descriptor of getAppliedObjectsForTable(resource)) {
      if (
        !descriptor.name ||
        (descriptor.namespace &&
          (excludeNamespaced || (namespaces.length && !namespaces.includes(descriptor.namespace))))
      )
        continue;
      const reported = descriptor._processedItem?.status;
      const status = String(
        typeof reported === 'object' ? reported?.status : reported
      ).toLowerCase();
      const state: DashboardState = ['true', 'success', 'applied', 'ready', 'succeeded'].includes(
        status
      )
        ? 'ready'
        : ['false', 'error', 'failed', 'fail'].includes(status)
        ? 'failed'
        : 'unknown';
      const key = `${resource.cluster}/${descriptor.apiVersion}/${descriptor.kind}/${
        descriptor.namespace || ''
      }/${descriptor.name}`;
      const existing = entries.get(key);
      if (!existing || state === 'failed' || (existing.state === 'ready' && state === 'unknown'))
        entries.set(key, { ...descriptor, cluster: resource.cluster, state });
    }
  return [...entries.values()];
}
