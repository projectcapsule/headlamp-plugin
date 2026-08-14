import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import type { QuotaAggregationData, QuotaAggregationMetric } from '../common/quotaAggregation';
import { filterQuotaMetrics } from '../common/quotaAggregation';
import { customQuotaAggregation } from '../quotas/customQuotaAggregationHelpers';
import { globalResourceQuotaAggregation } from '../quotas/globalResourceQuotaHelpers';
import { resourcePoolAggregation } from '../quotas/resourcePoolHelpers';

/** Exact metadata label used to associate quota resources with a Tenant. */
export const TENANT_QUOTA_LABEL = 'projectcapsule.dev/tenant';

export type TenantQuotaKind =
  | 'GlobalResourceQuota'
  | 'ResourcePool'
  | 'GlobalCustomQuota'
  | 'CustomQuota';

export interface TenantQuotaSources {
  customQuotas?: any[] | null;
  globalCustomQuotas?: any[] | null;
  globalResourceQuotas?: any[] | null;
  resourcePools?: any[] | null;
}

export interface TenantQuotaSystem {
  aggregation: QuotaAggregationData;
  cluster?: string;
  crd: string;
  item: any;
  kind: TenantQuotaKind;
  name: string;
  namespace?: string;
  resources: string[];
}

export interface TenantQuotaUsageRow extends QuotaAggregationMetric {
  namespaceCount: number;
  system: TenantQuotaSystem;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function aggregationFor(item: any, kind: TenantQuotaKind): QuotaAggregationData {
  if (kind === 'GlobalResourceQuota') return globalResourceQuotaAggregation(item);
  if (kind === 'ResourcePool') return resourcePoolAggregation(item);
  return customQuotaAggregation(item, kind);
}

const KIND_ORDER: TenantQuotaKind[] = [
  'GlobalResourceQuota',
  'ResourcePool',
  'GlobalCustomQuota',
  'CustomQuota',
];

const CRD_BY_KIND: Record<TenantQuotaKind, string> = {
  CustomQuota: CAPSULE_CRDS.CustomQuota,
  GlobalCustomQuota: CAPSULE_CRDS.GlobalCustomQuota,
  GlobalResourceQuota: CAPSULE_CRDS.GlobalResourceQuota,
  ResourcePool: CAPSULE_CRDS.ResourcePool,
};

/** Finds quota resources explicitly generated or assigned to a Tenant by label. */
export function tenantQuotaSystems(
  tenantName: string,
  sources: TenantQuotaSources
): TenantQuotaSystem[] {
  const groups: Array<[TenantQuotaKind, any[] | null | undefined]> = [
    ['GlobalResourceQuota', sources.globalResourceQuotas],
    ['ResourcePool', sources.resourcePools],
    ['GlobalCustomQuota', sources.globalCustomQuotas],
    ['CustomQuota', sources.customQuotas],
  ];
  const systems: TenantQuotaSystem[] = [];

  groups.forEach(([kind, items]) => {
    (items || []).forEach(item => {
      const json = objectData(item);
      if (json.metadata?.labels?.[TENANT_QUOTA_LABEL] !== tenantName) return;
      const aggregation = aggregationFor(item, kind);
      const name = json.metadata?.name || item?.getName?.() || aggregation.name;
      systems.push({
        aggregation,
        cluster: item?.cluster,
        crd: CRD_BY_KIND[kind],
        item,
        kind,
        name,
        namespace:
          kind === 'CustomQuota' ? json.metadata?.namespace || item?.getNamespace?.() : undefined,
        resources: aggregation.metrics.map(metric => metric.resource),
      });
    });
  });

  return systems.sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      left.name.localeCompare(right.name)
  );
}

export function tenantQuotaResources(systems: TenantQuotaSystem[]): string[] {
  return [...new Set(systems.flatMap(system => system.resources))].sort((left, right) =>
    left.localeCompare(right)
  );
}

/** One row per labeled quota system and reported resource, highest utilization first. */
export function tenantQuotaUsageRows(
  systems: TenantQuotaSystem[],
  selectedResource: string
): TenantQuotaUsageRow[] {
  return systems
    .flatMap(system =>
      filterQuotaMetrics(system.aggregation.metrics, selectedResource).map(metric => ({
        ...metric,
        namespaceCount: system.aggregation.namespaces.length,
        system,
      }))
    )
    .sort(
      (left, right) =>
        right.percent - left.percent ||
        left.resource.localeCompare(right.resource) ||
        left.system.name.localeCompare(right.system.name)
    );
}
