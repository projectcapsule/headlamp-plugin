import { parseKubernetesQuantity, usagePercent } from '../../utils/quantity';
import type { QuotaAggregationMetric } from '../common/quotaAggregation';
import { formatQuantityLike } from '../quotas/customQuotaAggregationHelpers';
import type { NamespaceQuotaReference } from './namespaceQuotaReferences';

export interface NamespaceQuotaSource {
  kind: NamespaceQuotaReference['kind'] | 'ResourceQuota';
  name: string;
  namespace?: string;
  reference?: NamespaceQuotaReference;
  resource?: any;
}

interface NamespaceQuotaCandidate extends QuotaAggregationMetric {
  source: NamespaceQuotaSource;
}

export interface EffectiveNamespaceQuotaRow extends QuotaAggregationMetric {
  source: NamespaceQuotaSource;
  systems: number;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function quantity(value: unknown, fallback = '0'): string {
  return value === undefined || value === null ? fallback : String(value);
}

function availableQuantity(metric: Pick<QuotaAggregationMetric, 'hard' | 'used'>): string {
  return formatQuantityLike(
    Math.max(0, parseKubernetesQuantity(metric.hard) - parseKubernetesQuantity(metric.used)),
    metric.hard
  );
}

export function resourceQuotaCandidates(resourceQuotas: any[] | null | undefined) {
  const candidates: NamespaceQuotaCandidate[] = [];
  for (const resourceQuota of resourceQuotas || []) {
    const json = objectData(resourceQuota);
    const statusHard = json.status?.hard || {};
    const hard = Object.keys(statusHard).length > 0 ? statusHard : json.spec?.hard || {};
    const used = json.status?.used || {};
    const name = json.metadata?.name || resourceQuota?.getName?.() || 'ResourceQuota';
    const namespace = json.metadata?.namespace || resourceQuota?.getNamespace?.();

    for (const resource of Object.keys(hard)) {
      const hardValue = quantity(hard[resource]);
      const usedValue = quantity(used[resource]);
      candidates.push({
        available: availableQuantity({ hard: hardValue, used: usedValue }),
        hard: hardValue,
        percent: usagePercent(usedValue, hardValue),
        resource,
        source: { kind: 'ResourceQuota', name, namespace, resource: resourceQuota },
        used: usedValue,
      });
    }
  }
  return candidates;
}

function capsuleQuotaCandidates(references: NamespaceQuotaReference[]) {
  return references.flatMap(reference =>
    reference.metrics.map(metric => ({
      ...metric,
      available: availableQuantity(metric),
      source: {
        kind: reference.kind,
        name: reference.name,
        namespace: reference.namespace,
        reference,
      },
    }))
  );
}

function candidatePriority(candidate: NamespaceQuotaCandidate): number {
  return candidate.source.kind === 'ResourceQuota' ? 0 : 1;
}

/**
 * Returns one effective row per resource. Kubernetes enforces every matching
 * quota, so the candidate with the smallest hard value is the limiting system.
 * A native ResourceQuota wins equal limits because it exposes the concrete
 * Namespace usage observed by Kubernetes.
 */
export function effectiveNamespaceQuotaRows(
  references: NamespaceQuotaReference[],
  resourceQuotas: any[] | null | undefined
): EffectiveNamespaceQuotaRow[] {
  const grouped = new Map<string, NamespaceQuotaCandidate[]>();
  for (const candidate of [
    ...capsuleQuotaCandidates(references),
    ...resourceQuotaCandidates(resourceQuotas),
  ]) {
    if (!grouped.has(candidate.resource)) grouped.set(candidate.resource, []);
    grouped.get(candidate.resource)?.push(candidate);
  }

  return [...grouped.entries()]
    .map(([resource, candidates]) => {
      const sorted = candidates.slice().sort((left, right) => {
        const hardDifference =
          parseKubernetesQuantity(left.hard) - parseKubernetesQuantity(right.hard);
        if (hardDifference !== 0) return hardDifference;
        const priorityDifference = candidatePriority(left) - candidatePriority(right);
        if (priorityDifference !== 0) return priorityDifference;
        const utilizationDifference = right.percent - left.percent;
        if (utilizationDifference !== 0) return utilizationDifference;
        return (
          left.source.kind.localeCompare(right.source.kind) ||
          left.source.name.localeCompare(right.source.name)
        );
      });
      const limiting = sorted[0];
      return { ...limiting, resource, systems: candidates.length };
    })
    .sort(
      (left, right) => right.percent - left.percent || left.resource.localeCompare(right.resource)
    );
}
