import { describe, expect, it } from 'vitest';
import { countQuotaHealth, countReadiness, countResourcePools } from './overviewStats';

const withConditions = (conditions: Array<{ type: string; status: string }>) => ({
  status: { conditions },
});

describe('overview stats', () => {
  it('counts ready and not-ready Capsule resources', () => {
    expect(
      countReadiness([
        withConditions([{ type: 'Ready', status: 'True' }]),
        withConditions([{ type: 'Ready', status: 'False' }]),
        {},
      ])
    ).toEqual({ ready: 1, notReady: 2, total: 3 });
  });

  it('groups custom quotas by usage percentage', () => {
    expect(
      countQuotaHealth([
        { spec: { limit: '10' }, status: { usage: { used: '2' } } },
        { spec: { limit: '10' }, status: { usage: { used: '8' } } },
        { spec: { limit: '10' }, status: { usage: { used: '10' } } },
      ])
    ).toEqual({ healthy: 1, warning: 1, critical: 1, total: 3 });
  });

  it('reports ResourcePool readiness, claims, and exhaustion', () => {
    expect(
      countResourcePools([
        {
          status: {
            claimCount: 2,
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'Exhausted', status: 'True' },
            ],
          },
        },
        {
          jsonData: {
            status: {
              claimCount: 1,
              conditions: [{ type: 'Ready', status: 'False' }],
            },
          },
        },
      ])
    ).toEqual({ ready: 1, notReady: 1, total: 2, claims: 3, exhausted: 1 });
  });
});
