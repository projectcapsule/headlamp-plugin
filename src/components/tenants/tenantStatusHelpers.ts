function objectData(item: any) {
  return item?.jsonData || item || {};
}

export interface PromotedServiceAccount {
  clusterRoles: string[];
  identity: string;
  name: string;
  namespace: string;
  targets: string[];
}

export function parseServiceAccountIdentity(identity: unknown): {
  name: string;
  namespace: string;
} | null {
  const match = String(identity || '').match(/^system:serviceaccount:([^:]+):([^:]+)$/);
  return match ? { namespace: match[1], name: match[2] } : null;
}

/** Tenant.status.promotions is authoritative; status.owners includes other owner sources. */
export function tenantPromotedServiceAccounts(item: any): PromotedServiceAccount[] {
  const promotions = objectData(item).status?.promotions || [];
  return promotions
    .filter((promotion: any) => promotion?.kind === 'ServiceAccount')
    .map((promotion: any) => {
      const parsed = parseServiceAccountIdentity(promotion.name);
      return parsed
        ? {
            clusterRoles: promotion.clusterRoles || [],
            identity: promotion.name,
            name: parsed.name,
            namespace: parsed.namespace,
            targets: promotion.targets || [],
          }
        : null;
    })
    .filter((promotion: PromotedServiceAccount | null): promotion is PromotedServiceAccount =>
      Boolean(promotion)
    )
    .sort(
      (left: PromotedServiceAccount, right: PromotedServiceAccount) =>
        left.namespace.localeCompare(right.namespace) || left.name.localeCompare(right.name)
    );
}

export interface TenantNamespaceQuota {
  limit: number;
  remaining: number;
  used: number;
}

export function tenantNamespaceQuota(item: any): TenantNamespaceQuota | null {
  const json = objectData(item);
  const limit = Number(json.spec?.namespaceOptions?.quota);
  if (!Number.isFinite(limit) || limit < 1) return null;
  const statusNamespaces = json.status?.namespaces;
  const used =
    typeof statusNamespaces === 'number'
      ? statusNamespaces
      : Array.isArray(statusNamespaces)
      ? statusNamespaces.length
      : Number(json.status?.size) || 0;
  return { limit, remaining: Math.max(0, limit - used), used };
}
