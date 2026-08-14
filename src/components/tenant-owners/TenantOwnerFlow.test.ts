import { describe, expect, it } from 'vitest';
import { buildTenantOwnerFlowGraph } from './TenantOwnerFlow';

describe('TenantOwner reference flow', () => {
  it('connects the owner identity to linked, interactive Tenant nodes', () => {
    const graph = buildTenantOwnerFlowGraph(
      {
        metadata: { name: 'platform' },
        spec: { kind: 'Group', name: 'oidc:org:platform' },
      },
      [
        { metadata: { name: 'green' }, status: { state: 'Active' } },
        { metadata: { name: 'wind' }, spec: { cordoned: true } },
      ]
    );

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every(edge => edge.animated)).toBe(true);
    expect(graph.nodes[0].position.y + 96 / 2).toBe(
      (graph.nodes[1].position.y + 76 / 2 + graph.nodes[2].position.y + 76 / 2) / 2
    );
    expect(graph.nodes[0].data).toMatchObject({
      identity: 'oidc:org:platform',
      kind: 'Group',
      references: 2,
    });
    expect(graph.nodes[1].style).toMatchObject({ pointerEvents: 'all' });
    expect(graph.nodes[2].data).toMatchObject({ cordoned: true, name: 'wind' });
  });
});
