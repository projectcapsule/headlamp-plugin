import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import type { QuotaAggregationMetric } from '../common/quotaAggregation';
import { customQuotaAggregation } from '../quotas/customQuotaAggregationHelpers';
import { globalResourceQuotaAggregation } from '../quotas/globalResourceQuotaHelpers';
import { resourcePoolAggregation } from '../quotas/resourcePoolHelpers';

export interface NamespaceQuotaReference {
  cluster?: string;
  crd: string;
  kind: 'CustomQuota' | 'GlobalCustomQuota' | 'GlobalResourceQuota' | 'ResourcePool';
  metrics: QuotaAggregationMetric[];
  name: string;
  namespace?: string;
  resources: string[];
}

export interface NamespaceQuotaSources {
  customQuotas?: any[] | null;
  globalCustomQuotas?: any[] | null;
  globalResourceQuotas?: any[] | null;
  resourcePools?: any[] | null;
}

function referenceForNamespace(
  item: any,
  kind: NamespaceQuotaReference['kind'],
  namespace: string
): NamespaceQuotaReference | undefined {
  const aggregation =
    kind === 'GlobalResourceQuota'
      ? globalResourceQuotaAggregation(item)
      : kind === 'ResourcePool'
      ? resourcePoolAggregation(item)
      : customQuotaAggregation(item, kind);
  const namespaceConsumption = aggregation.namespaces.find(entry => entry.namespace === namespace);
  if (!namespaceConsumption) return undefined;

  const crd = {
    CustomQuota: CAPSULE_CRDS.CustomQuota,
    GlobalCustomQuota: CAPSULE_CRDS.GlobalCustomQuota,
    GlobalResourceQuota: CAPSULE_CRDS.GlobalResourceQuota,
    ResourcePool: CAPSULE_CRDS.ResourcePool,
  }[kind];

  return {
    cluster: item?.cluster,
    crd,
    kind,
    metrics: namespaceConsumption.metrics,
    name: aggregation.name,
    namespace: kind === 'CustomQuota' ? namespace : undefined,
    resources: aggregation.metrics.map(metric => metric.resource),
  };
}

/** Finds every Capsule quota system whose current status references a namespace. */
export function namespaceQuotaReferences(
  namespace: string,
  sources: NamespaceQuotaSources
): NamespaceQuotaReference[] {
  const references: NamespaceQuotaReference[] = [];
  const groups: Array<[NamespaceQuotaReference['kind'], any[] | null | undefined]> = [
    ['CustomQuota', sources.customQuotas],
    ['GlobalCustomQuota', sources.globalCustomQuotas],
    ['GlobalResourceQuota', sources.globalResourceQuotas],
    ['ResourcePool', sources.resourcePools],
  ];

  groups.forEach(([kind, items]) => {
    (items || []).forEach(item => {
      const reference = referenceForNamespace(item, kind, namespace);
      if (reference) references.push(reference);
    });
  });

  return references.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
}
