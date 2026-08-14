export const CAPSULE_CRDS = {
  CustomQuota: 'customquotas.capsule.clastix.io',
  GlobalCustomQuota: 'globalcustomquotas.capsule.clastix.io',
  GlobalResourceQuota: 'globalresourcequotas.capsule.clastix.io',
  GlobalTenantResource: 'globaltenantresources.capsule.clastix.io',
  ResourcePool: 'resourcepools.capsule.clastix.io',
  ResourcePoolClaim: 'resourcepoolclaims.capsule.clastix.io',
  Tenant: 'tenants.capsule.clastix.io',
  TenantOwner: 'tenantowners.capsule.clastix.io',
  TenantResource: 'tenantresources.capsule.clastix.io',
} as const;

export interface CapsuleCustomResourceRouteParams {
  crName: string;
  crd: string;
  namespace: string;
}

/** Headlamp uses `-` as the namespace URL segment for cluster-scoped CRs. */
export function capsuleCustomResourceRouteParams(
  crd: string,
  name: string,
  namespace?: string
): CapsuleCustomResourceRouteParams {
  return {
    crName: name,
    crd,
    namespace: namespace || '-',
  };
}

/** Literal route registered before Headlamp's generic CustomResource renderer. */
export function capsuleCustomResourceDetailPath(crd: string): string {
  return `/customresources/${crd}/:namespace/:crName`;
}

/** Literal list route that replaces the generic table for supported Capsule CRDs. */
export function capsuleCustomResourceListPath(crd: string): string {
  return `/customresources/${crd}`;
}
