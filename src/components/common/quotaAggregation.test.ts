import { describe, expect, it } from 'vitest';
import {
  ALL_QUOTA_RESOURCES,
  compareQuotaUtilizationDescending,
  quotaResourceFromSearch,
  quotaResourceSearch,
} from './quotaAggregation';

describe('quota aggregation ordering', () => {
  it('sorts resources and namespaces by highest utilization with stable name ties', () => {
    expect(
      [
        { percent: 15, resource: 'requests.cpu' },
        { percent: 96, resource: 'requests.memory' },
        { percent: 15, resource: 'limits.cpu' },
      ].sort(compareQuotaUtilizationDescending)
    ).toEqual([
      { percent: 96, resource: 'requests.memory' },
      { percent: 15, resource: 'limits.cpu' },
      { percent: 15, resource: 'requests.cpu' },
    ]);

    expect(
      [
        { namespace: 'solar-test', peak: 50 },
        { namespace: 'solar-dev', peak: 0 },
        { namespace: 'solar-prod', peak: 50 },
      ].sort(compareQuotaUtilizationDescending)
    ).toEqual([
      { namespace: 'solar-prod', peak: 50 },
      { namespace: 'solar-test', peak: 50 },
      { namespace: 'solar-dev', peak: 0 },
    ]);
  });

  it('round-trips a selected resource through the URL while preserving other filters', () => {
    const search = quotaResourceSearch('?namespace=solar-prod&tab=usage', 'requests.cpu');
    expect(search).toBe('namespace=solar-prod&tab=usage&resource=requests.cpu');
    expect(quotaResourceFromSearch(search, ['limits.cpu', 'requests.cpu'])).toBe('requests.cpu');

    expect(quotaResourceSearch(search, ALL_QUOTA_RESOURCES)).toBe('namespace=solar-prod&tab=usage');
  });

  it('falls back to all resources for missing or stale URL selections', () => {
    expect(quotaResourceFromSearch('?resource=pods', ['requests.cpu'])).toBe(ALL_QUOTA_RESOURCES);
    expect(quotaResourceFromSearch('', ['requests.cpu'])).toBe(ALL_QUOTA_RESOURCES);
  });
});
