import { describe, expect, it } from 'vitest';
import { buildQuotaConsumptionFlowGraph } from '../common/QuotaConsumptionFlow';
import { buildGlobalResourceQuotaFlowGraph } from './GlobalResourceQuotaFlow';

describe('GlobalResourceQuota consumption flow', () => {
  it('connects the quota to namespaces with exact usage and animated edges', () => {
    const graph = buildGlobalResourceQuotaFlowGraph({
      metadata: { name: 'shared-compute' },
      status: {
        namespaceUsage: {
          production: { used: { 'limits.cpu': '3', 'limits.memory': '8Gi' } },
          staging: { used: { 'limits.cpu': '1', 'limits.memory': '2Gi' } },
        },
        total: {
          hard: { 'limits.cpu': '8', 'limits.memory': '16Gi' },
          used: { 'limits.cpu': '4', 'limits.memory': '10Gi' },
        },
      },
    });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every(edge => edge.animated)).toBe(true);
    expect(graph.edges.every(edge => !('label' in edge))).toBe(true);
    expect(graph.nodes[0].position.y + 112 / 2).toBe(
      (graph.nodes[1].position.y + 156 / 2 + graph.nodes[2].position.y + 156 / 2) / 2
    );
    expect(graph.nodes[0].data).toMatchObject({ name: 'shared-compute', peak: 62.5 });
    expect(graph.nodes[1].data).toMatchObject({ name: 'production', peak: 50 });
    expect(graph.nodes[1].data.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'limits.cpu', used: '3', hard: '8', percent: 37.5 }),
        expect.objectContaining({
          resource: 'limits.memory',
          used: '8Gi',
          hard: '16Gi',
          percent: 50,
        }),
      ])
    );
  });

  it('uses one selected resource for aggregate and namespace percentages', () => {
    const graph = buildGlobalResourceQuotaFlowGraph(
      {
        metadata: { name: 'shared-compute' },
        status: {
          namespaceUsage: {
            production: { used: { 'limits.cpu': '3', 'limits.memory': '8Gi' } },
          },
          total: {
            hard: { 'limits.cpu': '8', 'limits.memory': '16Gi' },
            used: { 'limits.cpu': '4', 'limits.memory': '10Gi' },
          },
        },
      },
      'limits.cpu'
    );

    expect(graph.nodes[0].data).toMatchObject({ peak: 50, resourceLabel: 'limits.cpu' });
    expect(graph.nodes[1].data).toMatchObject({ peak: 37.5, singleResource: true });
    expect(graph.nodes[1].data.metrics).toEqual([
      expect.objectContaining({ resource: 'limits.cpu', percent: 37.5 }),
    ]);
    expect(graph.edges[0].label).toBeUndefined();
  });

  it('enables pointer interaction only for namespace nodes with resource links', () => {
    const graph = buildQuotaConsumptionFlowGraph({
      kind: 'GlobalResourceQuota',
      metrics: [],
      name: 'shared-compute',
      namespaces: [
        {
          link: {
            cluster: 'main',
            name: 'capsule-global-quota-abcd',
            namespace: 'production',
          },
          metrics: [],
          namespace: 'production',
        },
        { metrics: [], namespace: 'unlinked' },
      ],
    });

    expect(graph.nodes[1].style).toMatchObject({ pointerEvents: 'all' });
    expect(graph.nodes[2].style).toMatchObject({ pointerEvents: 'none' });
  });
});
