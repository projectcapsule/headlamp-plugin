import { isResourceReady } from '../../resources/tenantResources.helpers';
import { parseKubernetesQuantity, usagePercent } from '../../utils/quantity';
import type { QuotaAggregationData, QuotaAggregationMetric } from '../common/quotaAggregation';
import { formatQuantityLike } from './customQuotaAggregationHelpers';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function quantity(value: unknown, fallback = '0'): string {
  return value === undefined || value === null ? fallback : String(value);
}

function condition(item: any, type: string) {
  return objectData(item).status?.conditions?.find((entry: any) => entry.type === type);
}

function metric(
  resource: string,
  hardValues: Record<string, unknown>,
  usedValues: Record<string, unknown>,
  availableValues: Record<string, unknown>
): QuotaAggregationMetric {
  const hard = quantity(hardValues[resource]);
  const used = quantity(usedValues[resource]);
  const available = quantity(
    availableValues[resource],
    formatQuantityLike(
      Math.max(0, parseKubernetesQuantity(hard) - parseKubernetesQuantity(used)),
      hard
    )
  );
  return { available, hard, percent: usagePercent(used, hard), resource, used };
}

export function resourcePoolAllocationMetrics(item: any): QuotaAggregationMetric[] {
  const json = objectData(item);
  const hard = json.status?.allocation?.hard || json.spec?.quota?.hard || {};
  const used = json.status?.allocation?.used || {};
  const available = json.status?.allocation?.available || {};
  const resources = [...new Set([...Object.keys(hard), ...Object.keys(used)])].sort((left, right) =>
    left.localeCompare(right)
  );
  return resources.map(resource => metric(resource, hard, used, available));
}

export function resourcePoolNamespaces(item: any): string[] {
  const json = objectData(item);
  return [
    ...new Set<string>([
      ...(json.status?.namespaces || []),
      ...Object.keys(json.status?.claims || {}),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function namespaceMetrics(item: any, namespace: string): QuotaAggregationMetric[] {
  const json = objectData(item);
  const claims = json.status?.claims?.[namespace] || [];
  const aggregateMetrics = resourcePoolAllocationMetrics(item);
  const aggregateByResource = new Map(aggregateMetrics.map(entry => [entry.resource, entry]));
  const totals = new Map<string, number>();
  const references = new Map<string, string>();

  for (const claim of claims) {
    for (const [resource, value] of Object.entries(claim.claims || {})) {
      totals.set(resource, (totals.get(resource) || 0) + parseKubernetesQuantity(value as any));
      references.set(resource, aggregateByResource.get(resource)?.hard || quantity(value));
    }
  }

  return [...totals.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map(resource => {
      const hard = aggregateByResource.get(resource)?.hard || '0';
      const used = formatQuantityLike(totals.get(resource) || 0, references.get(resource) || hard);
      return {
        available: formatQuantityLike(
          Math.max(0, parseKubernetesQuantity(hard) - parseKubernetesQuantity(used)),
          hard
        ),
        hard,
        percent: usagePercent(used, hard),
        resource,
        used,
      };
    });
}

export function resourcePoolAggregation(
  item: any,
  liveClaims?: any[] | null
): QuotaAggregationData {
  const json = objectData(item);
  const claimRows = resourcePoolClaimRows(item, liveClaims);
  return {
    kind: 'ResourcePool',
    metrics: item ? resourcePoolAllocationMetrics(item) : [],
    name: json.metadata?.name || item?.getName?.() || 'ResourcePool',
    namespaces: resourcePoolNamespaces(item).map(namespace => ({
      claims: claimRows
        .filter(claim => claim.namespace === namespace)
        .map(claim => ({
          bound: claim.bound,
          exhausted: claim.exhausted,
          link: {
            cluster: claim.resource?.cluster || item?.cluster,
            name: claim.name,
            namespace: claim.namespace,
          },
          name: claim.name,
          requested: claim.requested,
        })),
      metrics: namespaceMetrics(item, namespace),
      namespace,
    })),
  };
}

export function resourcePoolPeakUsage(item: any): number {
  return Math.max(0, ...resourcePoolAllocationMetrics(item).map(entry => entry.percent));
}

export interface ResourcePoolClaimRow {
  bound?: boolean;
  exhausted?: boolean;
  message: string;
  name: string;
  namespace: string;
  resource?: any;
  ready?: boolean;
  requested: Record<string, string | number>;
  uid?: string;
}

function booleanCondition(item: any, type: string): boolean | undefined {
  const status = condition(item, type)?.status;
  if (String(status).toLowerCase() === 'true') return true;
  if (String(status).toLowerCase() === 'false') return false;
  return undefined;
}

function claimMessage(item: any): string {
  const conditions = objectData(item).status?.conditions || [];
  const notable =
    conditions.find(
      (entry: any) =>
        (entry.type === 'Bound' && String(entry.status) === 'False') ||
        (entry.type === 'Exhausted' && String(entry.status) === 'True') ||
        (entry.type === 'Ready' && String(entry.status) === 'False')
    ) || conditions.find((entry: any) => entry.type === 'Ready');
  return notable?.message || notable?.reason || '—';
}

/** Unions bound status claims with live claims so rejected/queued requests stay visible. */
export function resourcePoolClaimRows(item: any, liveClaims: any[] | null | undefined) {
  const json = objectData(item);
  const rows = new Map<string, ResourcePoolClaimRow>();
  for (const [namespace, claims] of Object.entries(json.status?.claims || {})) {
    for (const claim of claims as any[]) {
      rows.set(`${namespace}/${claim.name}`, {
        bound: true,
        message: 'Allocated from pool',
        name: claim.name,
        namespace,
        requested: claim.claims || {},
        uid: claim.uid,
      });
    }
  }

  const poolName = json.metadata?.name || item?.getName?.();
  for (const claim of liveClaims || []) {
    const claimJson = objectData(claim);
    const belongsToPool =
      claimJson.spec?.pool === poolName ||
      claimJson.status?.pool?.name === poolName ||
      (claimJson.metadata?.ownerReferences || []).some(
        (owner: any) => owner.kind === 'ResourcePool' && owner.name === poolName
      );
    if (!belongsToPool) continue;
    const namespace = claimJson.metadata?.namespace || claim?.getNamespace?.() || '';
    const name = claimJson.metadata?.name || claim?.getName?.() || '';
    rows.set(`${namespace}/${name}`, {
      bound: booleanCondition(claim, 'Bound'),
      exhausted: booleanCondition(claim, 'Exhausted'),
      message: claimMessage(claim),
      name,
      namespace,
      ready: booleanCondition(claim, 'Ready'),
      resource: claim,
      requested: claimJson.spec?.claim || rows.get(`${namespace}/${name}`)?.requested || {},
      uid: claimJson.metadata?.uid,
    });
  }

  return [...rows.values()].sort(
    (left, right) =>
      left.namespace.localeCompare(right.namespace) || left.name.localeCompare(right.name)
  );
}

export function summarizeResourcePools(items: any[] | null | undefined) {
  const pools = items || [];
  const summary = {
    capacity: { critical: 0, healthy: 0, warning: 0 },
    claims: 0,
    exhausted: 0,
    namespaces: 0,
    readiness: { notReady: 0, ready: 0 },
    total: pools.length,
  };

  for (const pool of pools) {
    if (isResourceReady(pool)) summary.readiness.ready += 1;
    else summary.readiness.notReady += 1;
    const peak = resourcePoolPeakUsage(pool);
    if (peak > 90) summary.capacity.critical += 1;
    else if (peak > 70) summary.capacity.warning += 1;
    else summary.capacity.healthy += 1;
    const json = objectData(pool);
    summary.claims += Number(json.status?.claimCount) || 0;
    summary.namespaces +=
      Number(json.status?.namespaceCount) || resourcePoolNamespaces(pool).length;
    if (booleanCondition(pool, 'Exhausted')) summary.exhausted += 1;
  }

  return summary;
}
