export const SERVICE_ACCOUNT_PROMOTION_LABEL = 'owner.projectcapsule.dev/promote';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export interface ServiceAccountPromotionRequest {
  body: {
    metadata: {
      labels: Record<string, string | null>;
    };
  };
  name: string;
  namespace: string;
  promote: boolean;
  url: string;
}

export function isServiceAccountPromoted(item: any): boolean {
  return objectData(item).metadata?.labels?.[SERVICE_ACCOUNT_PROMOTION_LABEL] === 'true';
}

export function capsuleConfigurationAllowsServiceAccountPromotion(configurations: any[]): boolean {
  return (configurations || []).some(
    configuration => objectData(configuration).spec?.allowServiceAccountPromotion === true
  );
}

export function buildServiceAccountPromotionRequest(
  item: any,
  promote: boolean
): ServiceAccountPromotionRequest | null {
  const json = objectData(item);
  const kind = item?.kind || json.kind || item?.constructor?.kind;
  const name = item?.metadata?.name || json.metadata?.name;
  const namespace = item?.metadata?.namespace || json.metadata?.namespace;
  if ((kind && kind !== 'ServiceAccount') || !name || !namespace) return null;

  return {
    body: {
      metadata: {
        labels: {
          [SERVICE_ACCOUNT_PROMOTION_LABEL]: promote ? 'true' : null,
        },
      },
    },
    name,
    namespace,
    promote,
    url: `/api/v1/namespaces/${encodeURIComponent(namespace)}/serviceaccounts/${encodeURIComponent(
      name
    )}`,
  };
}

export function replaceServiceAccountData(item: any, data: any) {
  if (!item || !data) return;
  if ('jsonData' in item) {
    item.jsonData = data;
    return;
  }
  Object.assign(item, data);
}
