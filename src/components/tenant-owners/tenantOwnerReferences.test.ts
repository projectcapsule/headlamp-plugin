import { describe, expect, it } from 'vitest';
import { referencedTenantsForOwner, tenantOwnerIdentity } from './tenantOwnerReferences';

const owner = {
  spec: { kind: 'Group', name: 'oidc:org:platform' },
  status: { tenants: ['reported'] },
};

describe('TenantOwner references', () => {
  it('describes the identity represented by the TenantOwner', () => {
    expect(tenantOwnerIdentity(owner)).toEqual({ kind: 'Group', name: 'oidc:org:platform' });
  });

  it('unions status-reported and owner-identity-matched tenants without duplicates', () => {
    const tenants = [
      {
        metadata: { name: 'matched' },
        spec: { owners: [{ kind: 'Group', name: 'oidc:org:platform' }] },
      },
      {
        metadata: { name: 'reported' },
        spec: { owners: [{ kind: 'User', name: 'someone-else' }] },
        status: { owners: [{ kind: 'Group', name: 'oidc:org:platform' }] },
      },
      {
        metadata: { name: 'unrelated' },
        spec: { owners: [{ kind: 'Group', name: 'oidc:org:other' }] },
      },
    ];

    expect(referencedTenantsForOwner(owner, tenants).map(tenant => tenant.metadata.name)).toEqual([
      'matched',
      'reported',
    ]);
  });
});
