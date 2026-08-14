export const RESOURCE_POOL_CLAIM_RELEASE_ANNOTATION = 'projectcapsule.dev/release';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function boundStatus(item: any): string | undefined {
  const condition = objectData(item).status?.conditions?.find(
    (entry: any) => entry.type === 'Bound'
  );
  return condition?.status === undefined ? undefined : String(condition.status).toLowerCase();
}

/** Capsule only accepts a release request after all claimed resources have been freed. */
export function canReleaseResourcePoolClaim(item: any): boolean {
  return boundStatus(item) === 'false';
}

export interface ResourcePoolClaimReleaseRequest {
  body: {
    metadata: {
      annotations: Record<string, string>;
    };
  };
  name: string;
  namespace: string;
  url: string;
}

export function buildResourcePoolClaimReleaseRequest(
  item: any
): ResourcePoolClaimReleaseRequest | null {
  const json = objectData(item);
  const kind = json.kind || item?.kind || item?.constructor?.kind;
  if (kind && kind !== 'ResourcePoolClaim') return null;

  const name = json.metadata?.name || item?.getName?.();
  const namespace = json.metadata?.namespace || item?.getNamespace?.();
  if (!name || !namespace || !canReleaseResourcePoolClaim(item)) return null;

  return {
    body: {
      metadata: {
        annotations: {
          [RESOURCE_POOL_CLAIM_RELEASE_ANNOTATION]: 'true',
        },
      },
    },
    name,
    namespace,
    url: `/apis/capsule.clastix.io/v1beta2/namespaces/${encodeURIComponent(
      namespace
    )}/resourcepoolclaims/${encodeURIComponent(name)}`,
  };
}

export function replaceResourcePoolClaimData(item: any, response: any) {
  if (!item) return;
  const refreshed = response?.jsonData || response;
  if (!refreshed) return;
  if (item.jsonData) item.jsonData = refreshed;
  else Object.assign(item, refreshed);
}
