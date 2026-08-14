import { describe, expect, it } from 'vitest';
import {
  globalResourceQuotaAggregation,
  globalResourceQuotaMetrics,
  globalResourceQuotaNamespaceMetrics,
  globalResourceQuotaNamespaces,
  summarizeGlobalResourceQuotas,
} from './globalResourceQuotaHelpers';

const quota = {
  spec: { quota: { hard: { 'limits.cpu': '8', 'limits.memory': '16Gi' } } },
  status: {
    conditions: [{ type: 'Ready', status: 'True' }],
    namespaceCount: 2,
    namespaces: ['green-prod'],
    namespaceUsage: {
      'green-test': { used: { 'limits.cpu': '2', 'limits.memory': '4Gi' } },
      'green-prod': { used: { 'limits.cpu': '4', 'limits.memory': '12Gi' } },
    },
    total: {
      hard: { 'limits.cpu': '8', 'limits.memory': '16Gi' },
      used: { 'limits.cpu': '6', 'limits.memory': '16Gi' },
      available: { 'limits.cpu': '2', 'limits.memory': '0' },
    },
  },
};

describe('GlobalResourceQuota usage helpers', () => {
  it('builds unit-aware aggregate metrics', () => {
    expect(globalResourceQuotaMetrics(quota)).toEqual([
      {
        available: '2',
        hard: '8',
        percent: 75,
        resource: 'limits.cpu',
        used: '6',
      },
      {
        available: '0',
        hard: '16Gi',
        percent: 100,
        resource: 'limits.memory',
        used: '16Gi',
      },
    ]);
  });

  it('unions selected and observed namespaces and calculates their consumption', () => {
    expect(globalResourceQuotaNamespaces(quota)).toEqual(['green-prod', 'green-test']);
    expect(globalResourceQuotaNamespaceMetrics(quota, 'green-prod')).toEqual([
      expect.objectContaining({ resource: 'limits.cpu', used: '4', hard: '8', percent: 50 }),
      expect.objectContaining({
        resource: 'limits.memory',
        used: '12Gi',
        hard: '16Gi',
        percent: 75,
      }),
    ]);
  });

  it('summarizes readiness, peak capacity health, and namespace scope', () => {
    expect(summarizeGlobalResourceQuotas([quota, { status: {} }])).toEqual({
      capacity: { critical: 1, healthy: 1, warning: 0 },
      namespaces: 2,
      readiness: { notReady: 1, ready: 1 },
      total: 2,
    });
  });

  it('links a namespace to the generated ResourceQuota owned by this GRQ', () => {
    const linkedData = globalResourceQuotaAggregation(
      { ...quota, metadata: { name: 'shared-compute' } },
      [
        {
          cluster: 'main',
          metadata: {
            labels: { 'projectcapsule.dev/global-resource-quota': 'different-quota' },
            name: 'wrong-quota',
            namespace: 'green-prod',
          },
        },
        {
          cluster: 'main',
          metadata: {
            labels: { 'projectcapsule.dev/global-resource-quota': 'shared-compute' },
            name: 'capsule-global-quota-abcd',
            namespace: 'green-prod',
          },
        },
      ]
    );

    expect(linkedData.namespaces.find(row => row.namespace === 'green-prod')?.link).toEqual({
      cluster: 'main',
      name: 'capsule-global-quota-abcd',
      namespace: 'green-prod',
    });
    expect(linkedData.namespaces.find(row => row.namespace === 'green-test')?.link).toBeUndefined();
  });
});
