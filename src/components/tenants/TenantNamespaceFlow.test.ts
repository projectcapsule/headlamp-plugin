import { describe, expect, it } from 'vitest';
import { buildTenantNamespaceFlowGraph } from './TenantNamespaceFlow';

describe('tenant namespace flow', () => {
  it('connects status-derived owners to the tenant and every managed namespace', () => {
    const tenant = {
      apiVersion: 'capsule.clastix.io/v1beta2',
      kind: 'Tenant',
      metadata: { name: 'solar' },
      spec: { cordoned: true, owners: [{ kind: 'User', name: 'spec-only' }] },
      status: {
        owners: [
          { clusterRoles: ['admin'], kind: 'User', name: 'alice' },
          { clusterRoles: ['viewer'], kind: 'Group', name: 'oidc:platform' },
        ],
        spaces: [
          {
            name: 'solar-test',
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'Cordoned', status: 'True' },
            ],
          },
        ],
      },
    };
    const namespace = {
      getName: () => 'solar-test',
      jsonData: { metadata: { name: 'solar-test' }, status: { phase: 'Active' } },
    };
    const graph = buildTenantNamespaceFlowGraph(tenant, [namespace]);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.at(-1)).toMatchObject({
      source: 'capsule-tenant-source',
      target: 'namespace-solar-test',
      animated: true,
    });
    expect(graph.edges.slice(0, 2).every(edge => edge.target === 'capsule-tenant-source')).toBe(
      true
    );
    expect(graph.nodes[0].position.y + 88 / 2).toBe(graph.nodes[3].position.y + 76 / 2);
    expect(graph.nodes[1].data).toMatchObject({ kind: 'Group', name: 'oidc:platform' });
    expect(graph.nodes[2].data).toMatchObject({
      clusterRoles: ['admin'],
      kind: 'User',
      name: 'alice',
    });
    expect(graph.nodes.map(node => node.data.name)).not.toContain('spec-only');
    expect(graph.nodes[3].data).toMatchObject({ ready: true, cordoned: true });
  });
});
