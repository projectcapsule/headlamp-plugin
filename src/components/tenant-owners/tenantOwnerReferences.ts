export interface TenantOwnerIdentity {
  kind: string;
  name: string;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function tenantOwnerIdentity(owner: any): TenantOwnerIdentity {
  const json = objectData(owner);
  return {
    kind: String(json.spec?.kind || 'Unknown'),
    name: String(json.spec?.name || ''),
  };
}

function tenantOwners(tenant: any): any[] {
  const json = objectData(tenant);
  return [...(json.spec?.owners || []), ...(json.status?.owners || [])];
}

/** Resolves controller-reported and identity-matched Tenant references. */
export function referencedTenantsForOwner(owner: any, tenants: any[] | null | undefined): any[] {
  const ownerJson = objectData(owner);
  const identity = tenantOwnerIdentity(owner);
  const reportedNames = new Set<string>(ownerJson.status?.tenants || []);
  const matches = new Map<string, any>();

  for (const tenant of tenants || []) {
    const tenantJson = objectData(tenant);
    const tenantName = tenantJson.metadata?.name || tenant?.getName?.();
    if (!tenantName) continue;
    const identityMatch = tenantOwners(tenant).some(
      candidate => candidate.kind === identity.kind && candidate.name === identity.name
    );
    if (reportedNames.has(tenantName) || identityMatch) matches.set(tenantName, tenant);
  }

  return [...matches.values()].sort((left, right) =>
    String(objectData(left).metadata?.name || left?.getName?.()).localeCompare(
      String(objectData(right).metadata?.name || right?.getName?.())
    )
  );
}

export function tenantOwnerReportedTenantNames(owner: any): string[] {
  return [...new Set<string>(objectData(owner).status?.tenants || [])].sort((left, right) =>
    left.localeCompare(right)
  );
}
