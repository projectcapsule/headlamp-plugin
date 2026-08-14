import { describe, expect, it } from 'vitest';
import {
  buildReplicationCordonRequest,
  isReplicationCordonDataFresh,
  replaceReplicationResourceData,
  setReplicationCordonedState,
} from './replicationCordon';

describe('replication resource cordoning', () => {
  it('builds a namespaced TenantResource cordon request', () => {
    const resource = {
      jsonData: {
        apiVersion: 'capsule.clastix.io/v1beta2',
        kind: 'TenantResource',
        metadata: { name: 'defaults', namespace: 'solar' },
        spec: {},
      },
    };

    expect(buildReplicationCordonRequest(resource, 'TenantResource')).toEqual({
      kind: 'TenantResource',
      name: 'defaults',
      namespace: 'solar',
      targetCordoned: true,
      url: '/apis/capsule.clastix.io/v1beta2/namespaces/solar/tenantresources/defaults',
      body: { spec: { cordoned: true } },
    });
  });

  it('removes cordoned when uncordoning a GlobalTenantResource', () => {
    const resource = {
      jsonData: {
        apiVersion: 'capsule.clastix.io/v1beta2',
        kind: 'GlobalTenantResource',
        metadata: { name: 'cluster-defaults' },
        spec: { cordoned: true },
      },
    };

    expect(buildReplicationCordonRequest(resource, 'GlobalTenantResource')).toEqual({
      kind: 'GlobalTenantResource',
      name: 'cluster-defaults',
      namespace: undefined,
      targetCordoned: false,
      url: '/apis/capsule.clastix.io/v1beta2/globaltenantresources/cluster-defaults',
      body: { spec: { cordoned: null } },
    });
  });

  it('updates optimistic state and replaces it with refreshed API data', () => {
    const resource: any = { jsonData: { spec: {} } };
    setReplicationCordonedState(resource, true);
    expect(resource.jsonData.spec.cordoned).toBe(true);

    replaceReplicationResourceData(resource, { spec: { cordoned: false } });
    expect(resource.jsonData.spec.cordoned).toBe(false);
  });

  it('rejects a resource of a different kind', () => {
    const tenant = {
      jsonData: {
        apiVersion: 'capsule.clastix.io/v1beta2',
        kind: 'Tenant',
        metadata: { name: 'solar' },
      },
    };
    expect(buildReplicationCordonRequest(tenant, 'TenantResource')).toBeNull();
  });

  it('waits for both spec and the Cordoned condition to match', () => {
    expect(
      isReplicationCordonDataFresh(
        {
          spec: { cordoned: true },
          status: { conditions: [{ type: 'Cordoned', status: 'False' }] },
        },
        true
      )
    ).toBe(false);
    expect(
      isReplicationCordonDataFresh(
        {
          spec: { cordoned: true },
          status: { conditions: [{ type: 'Cordoned', status: 'True' }] },
        },
        true
      )
    ).toBe(true);
    expect(isReplicationCordonDataFresh({ spec: {} }, false)).toBe(true);
  });
});
