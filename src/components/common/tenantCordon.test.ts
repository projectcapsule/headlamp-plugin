import { describe, expect, it } from 'vitest';
import {
  buildTenantCordonRequest,
  isTenantCordonDataFresh,
  setTenantCordonedState,
} from './tenantCordon';

describe('tenant cordoning', () => {
  it('builds cordon and uncordon requests', () => {
    const resource: any = {
      jsonData: {
        apiVersion: 'capsule.clastix.io/v1beta2',
        kind: 'Tenant',
        metadata: { name: 'solar' },
        spec: {},
      },
    };
    expect(buildTenantCordonRequest(resource)).toMatchObject({
      name: 'solar',
      targetCordoned: true,
      body: { spec: { cordoned: true } },
    });

    setTenantCordonedState(resource, true);
    expect(buildTenantCordonRequest(resource)).toMatchObject({
      targetCordoned: false,
      body: { spec: { cordoned: null } },
    });
  });

  it('waits for tenant and namespace cordon status to converge with spec.cordoned', () => {
    expect(
      isTenantCordonDataFresh({ spec: { cordoned: true }, status: { state: 'Active' } }, true)
    ).toBe(false);
    expect(
      isTenantCordonDataFresh({ spec: { cordoned: true }, status: { state: 'Cordoned' } }, true)
    ).toBe(true);
    expect(
      isTenantCordonDataFresh(
        {
          spec: { cordoned: false },
          status: {
            state: 'Active',
            conditions: [{ type: 'Cordoned', status: 'False' }],
            spaces: [{ name: 'solar-a', conditions: [{ type: 'Cordoned', status: 'True' }] }],
          },
        },
        false
      )
    ).toBe(false);
    expect(
      isTenantCordonDataFresh(
        {
          spec: { cordoned: false },
          status: {
            state: 'Active',
            conditions: [{ type: 'Cordoned', status: 'False' }],
            spaces: {
              'solar-a': { conditions: [{ type: 'Cordoned', status: 'False' }] },
            },
          },
        },
        false
      )
    ).toBe(true);
    expect(isTenantCordonDataFresh({ spec: {}, status: { state: 'Active' } }, false)).toBe(true);
  });
});
