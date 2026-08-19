export const DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL = 'https://projectcapsule.dev';
export const CAPSULE_DOCUMENTATION_ACTION_ID = 'capsule.documentation';

const DOCUMENTATION_PATHS: Record<string, string> = {
  Tenant: '/docs/tenants/',
  TenantOwner: '/docs/tenants/permissions/#ownership',
  GlobalResourceQuota: '/docs/resource-management/globalresourcequota/',
  ResourcePool: '/docs/resource-management/resourcepools/',
  ResourcePoolClaim: '/docs/resource-management/resourcepools/#resourcepoolclaims',
  CustomQuota: '/docs/resource-management/customquotas/#customquota',
  GlobalCustomQuota: '/docs/resource-management/customquotas/#globalcustomquota',
  GlobalProxySettings: '/docs/proxy/proxysettings/#globalproxysettings',
  GlobalTenantResource: '/docs/replications/global/',
  TenantResource: '/docs/replications/tenant/',
};

function resourceKind(resource: any): string {
  return resource?.kind || resource?.jsonData?.kind || resource?.constructor?.kind || '';
}

export function documentationPathForResource(resource: any): string | undefined {
  return DOCUMENTATION_PATHS[resourceKind(resource)];
}

export function normalizeDocumentationBaseUrl(baseUrl?: string): string {
  const candidate = baseUrl?.trim() || DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL;
    }
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL;
  }
}

export function isDocumentationBaseUrlValid(baseUrl?: string): boolean {
  if (!baseUrl?.trim()) return true;
  try {
    const url = new URL(baseUrl.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function documentationUrlForResource(resource: any, baseUrl?: string): string | undefined {
  const path = documentationPathForResource(resource);
  if (!path) return undefined;
  return `${normalizeDocumentationBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

export function insertDocumentationAction<T extends { id?: string }>(
  resource: any,
  actions: T[],
  action: T
): T[] {
  if (!documentationPathForResource(resource)) return actions;
  if (actions.some(candidate => candidate.id === CAPSULE_DOCUMENTATION_ACTION_ID)) return actions;

  const editIndex = actions.findIndex(candidate => candidate.id === 'EDIT');
  const insertionIndex = editIndex >= 0 ? editIndex + 1 : actions.length;
  return [...actions.slice(0, insertionIndex), action, ...actions.slice(insertionIndex)];
}
