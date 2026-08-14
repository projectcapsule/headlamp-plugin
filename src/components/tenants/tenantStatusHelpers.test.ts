import { describe, expect, it } from 'vitest';
import {
  parseServiceAccountIdentity,
  tenantNamespaceQuota,
  tenantPromotedServiceAccounts,
} from './tenantStatusHelpers';

describe('Tenant status helpers', () => {
  it('parses Kubernetes ServiceAccount identities', () => {
    expect(parseServiceAccountIdentity('system:serviceaccount:solar-test:robot')).toEqual({
      name: 'robot',
      namespace: 'solar-test',
    });
    expect(parseServiceAccountIdentity('alice')).toBeNull();
  });

  it('uses only status.promotions to list promoted ServiceAccounts', () => {
    const promotions = tenantPromotedServiceAccounts({
      status: {
        owners: [
          { kind: 'ServiceAccount', name: 'system:serviceaccount:solar-test:declared-owner' },
        ],
        promotions: [
          { kind: 'User', name: 'alice' },
          {
            clusterRoles: ['admin'],
            kind: 'ServiceAccount',
            name: 'system:serviceaccount:solar-test:robot',
            targets: ['solar-test'],
          },
        ],
      },
    });

    expect(promotions).toEqual([
      {
        clusterRoles: ['admin'],
        identity: 'system:serviceaccount:solar-test:robot',
        name: 'robot',
        namespace: 'solar-test',
        targets: ['solar-test'],
      },
    ]);
  });

  it('returns configured namespace usage and hides absent quota', () => {
    expect(
      tenantNamespaceQuota({
        spec: { namespaceOptions: { quota: 5 } },
        status: { namespaces: ['solar-dev', 'solar-test'] },
      })
    ).toEqual({ limit: 5, remaining: 3, used: 2 });
    expect(tenantNamespaceQuota({ spec: {}, status: { size: 2 } })).toBeNull();
  });
});
