import { describe, expect, it } from 'vitest';
import {
  controllerReady,
  managedInventory,
  quotaPeak,
  resourceState,
  tenantNamespaceRows,
} from './dashboardModel';

const ready = { conditions: [{ type: 'Ready', status: 'True' }] };
describe('Capsule dashboard health', () => {
  it('keeps unknown, cordoned and stale readiness distinct', () => {
    expect(resourceState({ metadata: {} })).toBe('unknown');
    expect(resourceState({ metadata: {}, spec: { cordoned: true }, status: ready })).toBe(
      'cordoned'
    );
    expect(
      resourceState({ metadata: { generation: 2 }, status: { ...ready, observedGeneration: 1 } })
    ).toBe('reconciling');
    expect(resourceState({ metadata: {}, status: ready })).toBe('ready');
    expect(
      resourceState({
        metadata: {},
        status: { conditions: [{ type: 'Exhausted', status: 'True' }] },
      })
    ).toBe('failed');
  });
  it('uses the highest independent quota utilization without adding CPU and memory', () => {
    const item = {
      metadata: {},
      status: {
        ...ready,
        total: { hard: { cpu: '2', memory: '10Gi' }, used: { cpu: '500m', memory: '9Gi' } },
      },
    };
    expect(quotaPeak(item)).toBe(90);
    expect(resourceState(item)).toBe('warning');
    expect(
      resourceState({
        ...item,
        status: { ...ready, total: { hard: { cpu: '2' }, used: { cpu: '1900m' } } },
      })
    ).toBe('failed');
    expect(quotaPeak({ metadata: {}, spec: { limit: '10' } })).toBeUndefined();
  });
  it('retains namespaces with missing status as unknown and honors an explicitly excluded scope', () => {
    const tenants = [
      {
        metadata: { name: 'solar' },
        status: { namespaces: ['one', 'two'], spaces: { one: ready } },
      },
    ];
    expect(tenantNamespaceRows(tenants)[0].spaces.map(space => space.state)).toEqual([
      'ready',
      'unknown',
    ]);
    expect(tenantNamespaceRows(tenants, ['two'])[0].spaces).toHaveLength(1);
    expect(tenantNamespaceRows(tenants, [], true)[0].spaces).toEqual([]);
  });
  it('deduplicates reported inventory by cluster and keeps absent health unknown', () => {
    const object = {
      group: '',
      version: 'v1',
      kind: 'ConfigMap',
      name: 'config',
      namespace: 'one',
    };
    const resource = (cluster: string, status?: string) => ({
      metadata: {},
      cluster,
      status: { processedItems: [{ ...object, status: { status } }] },
    });
    const rows = managedInventory([resource('a', 'True'), resource('a', 'False'), resource('b')]);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.state)).toEqual(['failed', 'unknown']);
    expect(managedInventory([resource('a')], ['other'])).toEqual([]);
    expect(managedInventory([resource('a')], [], true)).toEqual([]);
  });
  it('distinguishes unavailable controllers from intentionally scaled-to-zero deployments', () => {
    expect(controllerReady({ metadata: {}, spec: { replicas: 0 } })).toBe(true);
    expect(
      controllerReady({
        metadata: { generation: 2 },
        spec: { replicas: 2 },
        status: { readyReplicas: 2, observedGeneration: 1 },
      })
    ).toBe(false);
    expect(
      controllerReady({
        metadata: { generation: 2 },
        spec: { replicas: 2 },
        status: { readyReplicas: 2, observedGeneration: 2 },
      })
    ).toBe(true);
  });
});
