import { usagePercent, usageSeverity } from '../../utils/quantity';
import type { QuotaAggregationData, QuotaAggregationMetric } from '../common/quotaAggregation';

export type GlobalResourceQuotaMetric = QuotaAggregationMetric;

function jsonData(item: any) {
  return item?.jsonData || item || {};
}

function stringQuantity(value: unknown, fallback = '0'): string {
  return value === undefined || value === null ? fallback : String(value);
}

export function globalResourceQuotaMetrics(item: any): GlobalResourceQuotaMetric[] {
  const json = jsonData(item);
  const hard = json.status?.total?.hard || json.spec?.quota?.hard || {};
  const used = json.status?.total?.used || {};
  const available = json.status?.total?.available || {};
  const resources = new Set([
    ...Object.keys(hard),
    ...Object.keys(used),
    ...Object.keys(available),
  ]);

  return [...resources]
    .sort((left, right) => left.localeCompare(right))
    .map(resource => {
      const hardValue = stringQuantity(hard[resource]);
      const usedValue = stringQuantity(used[resource]);
      return {
        available: stringQuantity(available[resource], '—'),
        hard: hardValue,
        percent: usagePercent(usedValue, hardValue),
        resource,
        used: usedValue,
      };
    });
}

export function globalResourceQuotaPeakUsage(item: any): number {
  return Math.max(0, ...globalResourceQuotaMetrics(item).map(metric => metric.percent));
}

export function globalResourceQuotaNamespaces(item: any): string[] {
  const json = jsonData(item);
  return [
    ...new Set<string>([
      ...(json.status?.namespaces || []),
      ...Object.keys(json.status?.namespaceUsage || {}),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

export function globalResourceQuotaNamespaceMetrics(
  item: any,
  namespace: string
): GlobalResourceQuotaMetric[] {
  const json = jsonData(item);
  const hard = json.status?.total?.hard || json.spec?.quota?.hard || {};
  const used = json.status?.namespaceUsage?.[namespace]?.used || {};
  const resources = new Set([...Object.keys(hard), ...Object.keys(used)]);

  return [...resources]
    .sort((left, right) => left.localeCompare(right))
    .map(resource => {
      const hardValue = stringQuantity(hard[resource]);
      const usedValue = stringQuantity(used[resource]);
      return {
        available: '—',
        hard: hardValue,
        percent: usagePercent(usedValue, hardValue),
        resource,
        used: usedValue,
      };
    });
}

function resourceQuotaForNamespace(
  resourceQuotas: any[] | null | undefined,
  globalResourceQuotaName: string,
  namespace: string
) {
  return (resourceQuotas || []).find(resourceQuota => {
    const resourceQuotaJson = jsonData(resourceQuota);
    const labels = resourceQuotaJson.metadata?.labels || {};
    const owners = resourceQuotaJson.metadata?.ownerReferences || [];
    const resourceQuotaNamespace =
      resourceQuotaJson.metadata?.namespace || resourceQuota?.getNamespace?.();
    return (
      resourceQuotaNamespace === namespace &&
      (labels['projectcapsule.dev/global-resource-quota'] === globalResourceQuotaName ||
        owners.some(
          (owner: any) =>
            owner.kind === 'GlobalResourceQuota' && owner.name === globalResourceQuotaName
        ))
    );
  });
}

export function globalResourceQuotaAggregation(
  item: any,
  resourceQuotas?: any[] | null
): QuotaAggregationData {
  const json = jsonData(item);
  const name = json.metadata?.name || item?.getName?.() || 'GlobalResourceQuota';
  return {
    kind: 'GlobalResourceQuota',
    metrics: globalResourceQuotaMetrics(item),
    name,
    namespaces: globalResourceQuotaNamespaces(item).map(namespace => {
      const resourceQuota = resourceQuotaForNamespace(resourceQuotas, name, namespace);
      const resourceQuotaJson = jsonData(resourceQuota);
      const resourceQuotaName = resourceQuotaJson.metadata?.name || resourceQuota?.getName?.();
      return {
        ...(resourceQuotaName
          ? {
              link: {
                cluster: resourceQuota?.cluster || item?.cluster,
                name: resourceQuotaName,
                namespace,
              },
            }
          : {}),
        metrics: globalResourceQuotaNamespaceMetrics(item, namespace),
        namespace,
      };
    }),
  };
}

export function summarizeGlobalResourceQuotas(items: any[] | null | undefined) {
  let ready = 0;
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let namespaces = 0;

  (items || []).forEach(item => {
    const json = jsonData(item);
    const readyCondition = json.status?.conditions?.find(
      (condition: any) => condition.type === 'Ready'
    );
    if (String(readyCondition?.status).toLowerCase() === 'true') ready += 1;

    const peak = globalResourceQuotaPeakUsage(item);
    const severity = usageSeverity(peak);
    if (severity === 'critical') critical += 1;
    else if (severity === 'warning') warning += 1;
    else healthy += 1;

    namespaces +=
      Number(json.status?.namespaceCount) || globalResourceQuotaNamespaces(item).length || 0;
  });

  const total = items?.length || 0;
  return {
    capacity: { critical, healthy, warning },
    namespaces,
    readiness: { notReady: total - ready, ready },
    total,
  };
}
