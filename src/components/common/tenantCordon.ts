export const TENANT_REFRESH_EVENT = 'capsule:tenant-refresh';

export interface TenantCordonRequest {
  name: string;
  targetCordoned: boolean;
  url: string;
  body: { spec: { cordoned: true | null } };
}

export function buildTenantCordonRequest(resource: any): TenantCordonRequest | null {
  const kind =
    resource?.jsonData?.kind ||
    resource?.kind ||
    (resource?.constructor && (resource.constructor as any).kind);
  const apiVersion =
    resource?.jsonData?.apiVersion ||
    resource?.apiVersion ||
    (resource?.constructor && (resource.constructor as any).apiVersion);
  if (kind !== 'Tenant' || !apiVersion?.startsWith('capsule.clastix.io/')) return null;

  const name = resource?.getName
    ? resource.getName()
    : resource?.jsonData?.metadata?.name || resource?.metadata?.name;
  if (!name) return null;

  const targetCordoned = !resource?.jsonData?.spec?.cordoned;
  return {
    name,
    targetCordoned,
    url: `/apis/capsule.clastix.io/v1beta2/tenants/${name}`,
    body: { spec: { cordoned: targetCordoned ? true : null } },
  };
}

export function isTenantCordonDataFresh(data: any, cordoned: boolean): boolean {
  const json = data?.jsonData || data;
  if (!!json?.spec?.cordoned !== cordoned) return false;
  const state = String(json?.status?.state || '').toLowerCase();
  if (state && state !== (cordoned ? 'cordoned' : 'active')) return false;

  const conditionMatches = (conditions: any[] | undefined) => {
    const condition = conditions?.find(item => item?.type === 'Cordoned');
    return !condition || String(condition.status) === (cordoned ? 'True' : 'False');
  };
  if (!conditionMatches(json?.status?.conditions)) return false;

  const rawSpaces = json?.status?.spaces;
  const spaces = Array.isArray(rawSpaces)
    ? rawSpaces
    : rawSpaces && typeof rawSpaces === 'object'
    ? Object.values(rawSpaces)
    : [];
  return spaces.every((space: any) => conditionMatches(space?.conditions));
}

export function setTenantCordonedState(resource: any, cordoned: boolean) {
  if (!resource?.jsonData) return;
  if (!resource.jsonData.spec) resource.jsonData.spec = {};
  if (!resource.jsonData.status) resource.jsonData.status = {};
  resource.jsonData.spec.cordoned = cordoned;
  resource.jsonData.status.state = cordoned ? 'Cordoned' : 'Active';
}

export function announceTenantRefresh(name: string, data: any) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TENANT_REFRESH_EVENT, {
      detail: { name, data: data?.jsonData || data },
    })
  );
}
