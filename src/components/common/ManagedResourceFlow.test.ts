import { describe, expect, it } from 'vitest';
import { buildManagedResourceFlowGraph, managedResourceKey } from './ManagedResourceFlow';

describe('managed resource flow', () => {
  it('links every managed resource to its TenantResource with animated edges', () => {
    const item = {
      apiVersion: 'capsule.clastix.io/v1beta2',
      kind: 'TenantResource',
      metadata: { name: 'defaults', namespace: 'capsule-system' },
    };
    const applied = [
      { apiVersion: 'v1', kind: 'ConfigMap', name: 'settings', namespace: 'green' },
      { apiVersion: 'apps/v1', kind: 'Deployment', name: 'web', namespace: 'green' },
    ];
    const graph = buildManagedResourceFlowGraph(item, applied, []);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every(edge => edge.animated)).toBe(true);
    expect(graph.edges.every(edge => edge.source === 'capsule-replication-source')).toBe(true);
    expect(graph.nodes[0].position.y + 88 / 2).toBe(
      (graph.nodes[1].position.y + 78 / 2 + graph.nodes[2].position.y + 78 / 2) / 2
    );
  });

  it('uses top-level descriptor identity and highlights the selected resource', () => {
    const descriptor = {
      apiVersion: 'v1',
      kind: 'Secret',
      name: 'credentials',
      namespace: 'solar',
    };
    const key = managedResourceKey(descriptor);
    const graph = buildManagedResourceFlowGraph(
      { kind: 'GlobalTenantResource', metadata: { name: 'global-defaults' } },
      [descriptor],
      [],
      key
    );

    expect(key).toBe('v1/Secret/solar/credentials');
    expect(graph.nodes.find(node => node.type === 'managedObject')?.data.selected).toBe(true);
  });

  it('places declared dependencies left of the replication source and animates their state', () => {
    const graph = buildManagedResourceFlowGraph(
      {
        kind: 'TenantResource',
        metadata: { name: 'consumer', namespace: 'solar-test' },
      },
      [],
      [],
      undefined,
      [
        {
          color: 'success',
          kind: 'TenantResource',
          message: 'ready',
          name: 'base',
          namespace: 'solar-test',
          state: 'Ready',
        },
      ]
    );

    const source = graph.nodes.find(node => node.type === 'replicationSource');
    const dependency = graph.nodes.find(node => node.type === 'dependency');
    expect(dependency?.position.x).toBeLessThan(source?.position.x || 0);
    expect(source?.data.hasDependencies).toBe(true);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        animated: true,
        source: dependency?.id,
        target: source?.id,
      }),
    ]);
  });
});
