import { parseKubernetesQuantity, usagePercent } from '../../utils/quantity';
import type { QuotaAggregationData, QuotaAggregationMetric } from '../common/quotaAggregation';

type CustomQuotaKind = 'CustomQuota' | 'GlobalCustomQuota';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function stringQuantity(value: unknown, fallback = '0'): string {
  return value === undefined || value === null ? fallback : String(value);
}

function decimal(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '');
}

/** Formats a parsed base-unit quantity using the unit used by the quota limit. */
export function formatQuantityLike(value: number, reference: string): string {
  const match = String(reference)
    .trim()
    .match(/[a-zA-Z]+$/);
  const suffix = match?.[0] || '';
  if (suffix === 'm') return `${decimal(value * 1000)}m`;

  const binary: Record<string, number> = {
    Ei: 1024 ** 6,
    Gi: 1024 ** 3,
    Ki: 1024,
    Mi: 1024 ** 2,
    Pi: 1024 ** 5,
    Ti: 1024 ** 4,
  };
  if (binary[suffix]) return `${decimal(value / binary[suffix])}${suffix}`;

  const decimalFactors: Record<string, number> = {
    E: 1000 ** 6,
    G: 1000 ** 3,
    K: 1000,
    M: 1000 ** 2,
    P: 1000 ** 5,
    T: 1000 ** 4,
    k: 1000,
  };
  if (decimalFactors[suffix]) {
    return `${decimal(value / decimalFactors[suffix])}${suffix}`;
  }

  return decimal(value);
}

export function customQuotaResourceLabel(item: any): string {
  const json = objectData(item);
  const sourceResources = new Set<string>();
  for (const source of json.spec?.sources || []) {
    const match = String(source.path || '').match(/\.resources\.(requests|limits)\.([^.[\]]+)$/);
    if (match) sourceResources.add(`${match[1]}.${match[2]}`);
  }
  if (sourceResources.size === 1) return [...sourceResources][0];
  return json.metadata?.name || item?.getName?.() || 'custom quota';
}

function aggregateMetric(item: any): QuotaAggregationMetric {
  const json = objectData(item);
  const hard = stringQuantity(json.status?.usage?.limit ?? json.spec?.limit);
  const used = stringQuantity(json.status?.usage?.used);
  const hardValue = parseKubernetesQuantity(hard);
  const usedValue = parseKubernetesQuantity(used);
  const available = stringQuantity(
    json.status?.usage?.available,
    formatQuantityLike(Math.max(0, hardValue - usedValue), hard)
  );

  return {
    available,
    hard,
    percent: usagePercent(used, hard),
    resource: customQuotaResourceLabel(item),
    used,
  };
}

function namespaceMetric(item: any, namespace: string): QuotaAggregationMetric | undefined {
  const json = objectData(item);
  const claims = (json.status?.claims || []).filter(
    (claim: any) => claim.namespace === namespace && claim.usage !== undefined
  );
  if (claims.length === 0) return undefined;

  const aggregate = aggregateMetric(item);
  const usedValue = claims.reduce(
    (total: number, claim: any) => total + parseKubernetesQuantity(claim.usage),
    0
  );
  const hardValue = parseKubernetesQuantity(aggregate.hard);
  const used = formatQuantityLike(usedValue, aggregate.hard);

  return {
    available: formatQuantityLike(Math.max(0, hardValue - usedValue), aggregate.hard),
    hard: aggregate.hard,
    percent: usagePercent(used, aggregate.hard),
    resource: aggregate.resource,
    used,
  };
}

export function customQuotaAggregation(item: any, kind: CustomQuotaKind): QuotaAggregationData {
  const json = objectData(item);
  const metric = aggregateMetric(item);
  const name = json.metadata?.name || item?.getName?.() || kind;

  if (kind === 'CustomQuota') {
    const namespace = json.metadata?.namespace || item?.getNamespace?.();
    return {
      kind,
      metrics: item ? [metric] : [],
      name,
      namespaces: namespace ? [{ metrics: [metric], namespace }] : [],
    };
  }

  const namespaces = [
    ...new Set<string>([
      ...(json.status?.namespaces || []),
      ...(json.status?.claims || []).map((claim: any) => claim.namespace).filter(Boolean),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  return {
    kind,
    metrics: item ? [metric] : [],
    name,
    namespaces: namespaces.map(namespace => {
      const metricForNamespace = namespaceMetric(item, namespace);
      return {
        metrics: metricForNamespace ? [metricForNamespace] : [],
        namespace,
      };
    }),
  };
}
