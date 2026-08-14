export const ALL_QUOTA_RESOURCES = '__all__';
export const QUOTA_RESOURCE_QUERY_PARAM = 'resource';

export interface QuotaAggregationMetric {
  available: string;
  hard: string;
  percent: number;
  resource: string;
  used: string;
}

export interface QuotaNamespaceClaim {
  bound?: boolean;
  exhausted?: boolean;
  link?: {
    cluster?: string;
    name: string;
    namespace: string;
  };
  name: string;
  requested: Record<string, string | number>;
}

export interface QuotaNamespaceConsumption {
  claims?: QuotaNamespaceClaim[];
  link?: {
    cluster?: string;
    name: string;
    namespace: string;
  };
  metrics: QuotaAggregationMetric[];
  namespace: string;
}

export interface QuotaAggregationData {
  kind: string;
  metrics: QuotaAggregationMetric[];
  name: string;
  namespaces: QuotaNamespaceConsumption[];
}

export function filterQuotaMetrics(
  metrics: QuotaAggregationMetric[],
  resource: string
): QuotaAggregationMetric[] {
  if (resource === ALL_QUOTA_RESOURCES) return metrics;
  return metrics.filter(metric => metric.resource === resource);
}

/** Resolves the shared quota filter from a URL, falling back safely for stale links. */
export function quotaResourceFromSearch(search: string, resources: string[]): string {
  const requested = new URLSearchParams(search).get(QUOTA_RESOURCE_QUERY_PARAM);
  return requested && resources.includes(requested) ? requested : ALL_QUOTA_RESOURCES;
}

/** Updates only the quota resource query parameter and preserves unrelated URL state. */
export function quotaResourceSearch(search: string, resource: string): string {
  const params = new URLSearchParams(search);
  if (resource === ALL_QUOTA_RESOURCES) params.delete(QUOTA_RESOURCE_QUERY_PARAM);
  else params.set(QUOTA_RESOURCE_QUERY_PARAM, resource);
  return params.toString();
}

export function quotaMetricPeak(metrics: QuotaAggregationMetric[]): number {
  return Math.max(0, ...metrics.map(metric => metric.percent));
}

export function compareQuotaUtilizationDescending(
  left: { peak?: number; percent?: number; resource?: string; namespace?: string },
  right: { peak?: number; percent?: number; resource?: string; namespace?: string }
): number {
  const utilizationDifference =
    (right.percent ?? right.peak ?? 0) - (left.percent ?? left.peak ?? 0);
  if (utilizationDifference !== 0) return utilizationDifference;
  return String(left.resource || left.namespace || '').localeCompare(
    String(right.resource || right.namespace || '')
  );
}
