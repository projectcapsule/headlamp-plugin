import { getTenantSpaceNames } from '../../utils/tenantSpaces';

export const CAPSULE_NAMESPACE_QUOTA_SECTION_ID = 'capsule.namespace-quota-systems';
export const CAPSULE_NAMESPACE_CUSTOM_QUOTAS_SECTION_ID = 'capsule.namespace-owned-customquotas';
export const CAPSULE_NAMESPACE_TENANT_RESOURCES_SECTION_ID =
  'capsule.namespace-owned-tenantresources';
export const HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID =
  'headlamp.namespace-owned-resourcequotas';
export const HEADLAMP_NAMESPACE_DETAILS_VIEW_SECTION_ID = 'headlamp.namespace-details-view';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function insertDetailsSectionBefore<T extends { id?: string }>(
  sections: T[],
  section: T,
  beforeId: string
): T[] {
  if (sections.some(candidate => candidate.id === section.id)) return sections;
  const beforeIndex = sections.findIndex(candidate => candidate.id === beforeId);
  if (beforeIndex < 0) return [...sections, section];
  return [...sections.slice(0, beforeIndex), section, ...sections.slice(beforeIndex)];
}

/** Namespace label is authoritative, with Tenant status as the fallback. */
export function tenantNameForNamespace(namespace: any, tenants: any[]): string | undefined {
  const json = objectData(namespace);
  const labels = json.metadata?.labels || {};
  const labeledTenant = labels['capsule.clastix.io/tenant'] || labels['projectcapsule.dev/tenant'];
  if (labeledTenant) return labeledTenant;

  const namespaceName = json.metadata?.name || namespace?.getName?.();
  if (!namespaceName) return undefined;
  const tenant = (tenants || []).find(candidate =>
    getTenantSpaceNames(candidate).includes(namespaceName)
  );
  return objectData(tenant).metadata?.name || tenant?.getName?.();
}
