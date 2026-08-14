import { describe, expect, it, vi } from 'vitest';
import { ALL_QUOTA_RESOURCES } from '../common/quotaAggregation';
import { buildTenantQuotaFlowGraph } from './TenantQuotaFlow';
import {
  tenantQuotaResources,
  tenantQuotaSystems,
  tenantQuotaUsageRows,
} from './tenantQuotaOverviewHelpers';

vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

vi.mock('../common/CapsuleResourceLink', () => ({
  CapsuleResourceLink: () => null,
}));

const sharedCompute = {
  metadata: {
    labels: { 'projectcapsule.dev/tenant': 'solar' },
    name: 'solar-shared-compute',
  },
  spec: { quota: { hard: { 'requests.cpu': '8', pods: '20' } } },
  status: {
    namespaces: ['solar-dev', 'solar-prod'],
    total: {
      available: { 'requests.cpu': '6', pods: '5' },
      hard: { 'requests.cpu': '8', pods: '20' },
      used: { 'requests.cpu': '2', pods: '15' },
    },
  },
};

const customQuota = {
  metadata: {
    labels: { 'projectcapsule.dev/tenant': 'solar' },
    name: 'solar-objects',
    namespace: 'solar-dev',
  },
  spec: { limit: '10', sources: [{ kind: 'ConfigMap', op: 'count' }] },
  status: { usage: { available: '8', limit: '10', used: '2' } },
};

describe('Tenant quota overview', () => {
  it('uses only resources carrying the exact Tenant quota label', () => {
    const systems = tenantQuotaSystems('solar', {
      customQuotas: [customQuota],
      globalResourceQuotas: [
        sharedCompute,
        {
          metadata: {
            labels: { 'projectcapsule.dev/tenant': 'wind' },
            name: 'wind-quota',
          },
        },
        {
          metadata: {
            labels: { 'capsule.clastix.io/tenant': 'solar' },
            name: 'legacy-label',
          },
        },
      ],
    });

    expect(systems.map(system => `${system.kind}/${system.name}`)).toEqual([
      'GlobalResourceQuota/solar-shared-compute',
      'CustomQuota/solar-objects',
    ]);
    expect(systems[1].namespace).toBe('solar-dev');
  });

  it('collects allocation types and sorts usage rows by utilization', () => {
    const systems = tenantQuotaSystems('solar', {
      customQuotas: [customQuota],
      globalResourceQuotas: [sharedCompute],
    });

    expect(tenantQuotaResources(systems)).toEqual(['pods', 'requests.cpu', 'solar-objects']);
    const rows = tenantQuotaUsageRows(systems, ALL_QUOTA_RESOURCES);
    expect(rows.map(row => `${row.system.name}/${row.resource}`)).toEqual([
      'solar-shared-compute/pods',
      'solar-shared-compute/requests.cpu',
      'solar-objects/solar-objects',
    ]);
    expect(tenantQuotaUsageRows(systems, 'requests.cpu')).toHaveLength(1);
  });

  it('filters the flow by allocation type and centers its Tenant source', () => {
    const systems = tenantQuotaSystems('solar', {
      customQuotas: [customQuota],
      globalResourceQuotas: [sharedCompute],
    });
    const graph = buildTenantQuotaFlowGraph('solar', systems, 'requests.cpu');

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ animated: true, source: 'tenant-quota-source' });
    expect(graph.nodes[0].position.y + 112 / 2).toBe(graph.nodes[1].position.y + 174 / 2);
  });
});
