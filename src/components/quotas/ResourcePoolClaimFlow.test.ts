import { describe, expect, it } from 'vitest';
import { buildResourcePoolClaimGraph } from './resourcePoolClaimGraph';

describe('ResourcePoolClaim flow', () => {
  it('links the claim directly to its ResourcePool with a centered animated edge', () => {
    const graph = buildResourcePoolClaimGraph(
      {
        metadata: { name: 'cpu', namespace: 'solar-test' },
        spec: { claim: { 'requests.cpu': '1' }, pool: 'solar-pool' },
      },
      { metadata: { name: 'solar-pool' } }
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([
      expect.objectContaining({ animated: true, source: 'claim', target: 'pool' }),
    ]);
    expect(graph.nodes[0].position.y + 150 / 2).toBe(graph.nodes[1].position.y + 112 / 2);
  });
});
