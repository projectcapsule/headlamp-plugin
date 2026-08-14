import { describe, expect, it } from 'vitest';
import {
  customQuotaAggregation,
  customQuotaResourceLabel,
  formatQuantityLike,
} from './customQuotaAggregationHelpers';

describe('custom quota aggregation helpers', () => {
  it('uses a shared Kubernetes resource path as the logical metric label', () => {
    expect(
      customQuotaResourceLabel({
        metadata: { name: 'cpu-limit' },
        spec: {
          sources: [
            { path: '.spec.containers[*].resources.requests.cpu' },
            { path: '.spec.initContainers[*].resources.requests.cpu' },
          ],
        },
      })
    ).toBe('requests.cpu');
  });

  it('builds a namespaced CustomQuota aggregation from its scalar usage', () => {
    const data = customQuotaAggregation(
      {
        metadata: { name: 'pod-count', namespace: 'solar-prod' },
        spec: { limit: '10' },
        status: { usage: { available: '4', used: '6' } },
      },
      'CustomQuota'
    );

    expect(data.metrics).toEqual([
      expect.objectContaining({ resource: 'pod-count', used: '6', hard: '10', percent: 60 }),
    ]);
    expect(data.namespaces).toEqual([
      {
        namespace: 'solar-prod',
        metrics: [expect.objectContaining({ used: '6', percent: 60 })],
      },
    ]);
  });

  it('aggregates GlobalCustomQuota claim usage per namespace with the limit unit', () => {
    const data = customQuotaAggregation(
      {
        metadata: { name: 'cpu-limit' },
        spec: {
          limit: '4',
          sources: [{ path: '.spec.containers[*].resources.requests.cpu' }],
        },
        status: {
          claims: [
            { namespace: 'solar-dev', usage: '500m' },
            { namespace: 'solar-dev', usage: '1' },
            { namespace: 'solar-prod', usage: '2' },
          ],
          namespaces: ['solar-dev', 'solar-empty'],
          usage: { available: '0.5', used: '3.5' },
        },
      },
      'GlobalCustomQuota'
    );

    expect(data.metrics[0]).toMatchObject({ resource: 'requests.cpu', percent: 87.5 });
    expect(data.namespaces).toEqual([
      {
        namespace: 'solar-dev',
        metrics: [expect.objectContaining({ used: '1.5', percent: 37.5 })],
      },
      { namespace: 'solar-empty', metrics: [] },
      {
        namespace: 'solar-prod',
        metrics: [expect.objectContaining({ used: '2', percent: 50 })],
      },
    ]);
  });

  it('preserves the reference quantity unit when summing claim usage', () => {
    expect(formatQuantityLike(1.5 * 1024 ** 3, '5Gi')).toBe('1.5Gi');
    expect(formatQuantityLike(0.75, '2000m')).toBe('750m');
  });
});
