import { describe, expect, it } from 'vitest';
import {
  CAPSULE_CRDS,
  capsuleCustomResourceDetailPath,
  capsuleCustomResourceListPath,
  capsuleCustomResourceRouteParams,
} from './capsuleCustomResources';

describe('Capsule custom resource routes', () => {
  it('uses Headlamp customresource parameters for cluster-scoped objects', () => {
    expect(capsuleCustomResourceRouteParams(CAPSULE_CRDS.Tenant, 'solar')).toEqual({
      crName: 'solar',
      crd: 'tenants.capsule.clastix.io',
      namespace: '-',
    });
  });

  it('keeps the namespace for namespaced objects', () => {
    expect(
      capsuleCustomResourceRouteParams(CAPSULE_CRDS.TenantResource, 'defaults', 'solar-system')
    ).toEqual({
      crName: 'defaults',
      crd: 'tenantresources.capsule.clastix.io',
      namespace: 'solar-system',
    });
  });

  it('creates a literal CRD route ahead of the generic Headlamp route', () => {
    expect(capsuleCustomResourceDetailPath(CAPSULE_CRDS.GlobalResourceQuota)).toBe(
      '/customresources/globalresourcequotas.capsule.clastix.io/:namespace/:crName'
    );
    expect(capsuleCustomResourceListPath(CAPSULE_CRDS.Tenant)).toBe(
      '/customresources/tenants.capsule.clastix.io'
    );
    expect(capsuleCustomResourceListPath(CAPSULE_CRDS.TenantOwner)).toBe(
      '/customresources/tenantowners.capsule.clastix.io'
    );
    expect(capsuleCustomResourceListPath(CAPSULE_CRDS.ResourcePool)).toBe(
      '/customresources/resourcepools.capsule.clastix.io'
    );
    expect(capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalProxySettings)).toBe(
      '/customresources/globalproxysettings.capsule.clastix.io'
    );
    expect(capsuleCustomResourceListPath(CAPSULE_CRDS.CapsuleConfiguration)).toBe(
      '/customresources/capsuleconfigurations.capsule.clastix.io'
    );
  });
});
