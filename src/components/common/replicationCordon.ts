export type ReplicationResourceKind = 'TenantResource' | 'GlobalTenantResource';

export const REPLICATION_RESOURCE_REFRESH_EVENT = 'capsule:replication-resource-refresh';

export interface ReplicationCordonRequest {
  kind: ReplicationResourceKind;
  name: string;
  namespace?: string;
  targetCordoned: boolean;
  url: string;
  body: {
    spec: {
      cordoned: true | null;
    };
  };
}

function resourceKind(resource: any): string | undefined {
  return (
    resource?.jsonData?.kind ||
    resource?.kind ||
    (resource?.constructor && (resource.constructor as any).kind)
  );
}

function resourceApiVersion(resource: any): string | undefined {
  return (
    resource?.jsonData?.apiVersion ||
    resource?.apiVersion ||
    (resource?.constructor && (resource.constructor as any).apiVersion)
  );
}

function resourceName(resource: any): string | undefined {
  return resource?.getName
    ? resource.getName()
    : resource?.jsonData?.metadata?.name || resource?.metadata?.name;
}

function resourceNamespace(resource: any): string | undefined {
  return resource?.getNamespace
    ? resource.getNamespace()
    : resource?.jsonData?.metadata?.namespace || resource?.metadata?.namespace;
}

export function buildReplicationCordonRequest(
  resource: any,
  expectedKind: ReplicationResourceKind
): ReplicationCordonRequest | null {
  const kind = resourceKind(resource);
  const apiVersion = resourceApiVersion(resource);
  if (kind !== expectedKind || !apiVersion?.startsWith('capsule.clastix.io/')) return null;

  const name = resourceName(resource);
  if (!name) return null;

  const namespace = resourceNamespace(resource);
  if (kind === 'TenantResource' && !namespace) return null;

  const targetCordoned = !resource?.jsonData?.spec?.cordoned;
  const url =
    kind === 'TenantResource'
      ? `/apis/capsule.clastix.io/v1beta2/namespaces/${namespace}/tenantresources/${name}`
      : `/apis/capsule.clastix.io/v1beta2/globaltenantresources/${name}`;

  return {
    kind,
    name,
    namespace,
    targetCordoned,
    url,
    body: {
      spec: {
        cordoned: targetCordoned ? true : null,
      },
    },
  };
}

export function setReplicationCordonedState(resource: any, cordoned: boolean) {
  if (!resource?.jsonData) return;
  if (!resource.jsonData.spec) resource.jsonData.spec = {};
  resource.jsonData.spec.cordoned = cordoned;
}

export function replaceReplicationResourceData(resource: any, refreshedData: any) {
  if (!resource || !refreshedData) return;
  resource.jsonData = refreshedData.jsonData || refreshedData;
}

export function isReplicationCordonDataFresh(data: any, cordoned: boolean): boolean {
  const json = data?.jsonData || data;
  if (!!json?.spec?.cordoned !== cordoned) return false;

  const condition = (json?.status?.conditions || []).find(
    (item: any) => String(item?.type).toLowerCase() === 'cordoned'
  );
  if (!condition) return true;
  return String(condition.status).toLowerCase() === String(cordoned);
}

export function announceReplicationResourceRefresh(
  request: Pick<ReplicationCordonRequest, 'kind' | 'name' | 'namespace'>,
  data: any
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(REPLICATION_RESOURCE_REFRESH_EVENT, {
      detail: { ...request, data: data?.jsonData || data },
    })
  );
}
