import { describe, expect, it } from 'vitest';
import { buildQuotaConsumptionFlowGraph } from '../common/QuotaConsumptionFlow';
import {
  resourcePoolAggregation,
  resourcePoolClaimRows,
  summarizeResourcePools,
} from './resourcePoolHelpers';

const pool = {
  metadata: { name: 'solar-pool' },
  spec: { quota: { hard: { 'requests.cpu': '4', 'requests.memory': '8Gi' } } },
  status: {
    allocation: {
      available: { 'requests.cpu': '1', 'requests.memory': '4Gi' },
      hard: { 'requests.cpu': '4', 'requests.memory': '8Gi' },
      used: { 'requests.cpu': '3', 'requests.memory': '4Gi' },
    },
    claimCount: 2,
    claims: {
      'solar-dev': [
        {
          claims: { 'requests.cpu': '500m', 'requests.memory': '1Gi' },
          name: 'small',
          namespace: 'solar-dev',
          uid: 'one',
        },
        {
          claims: { 'requests.cpu': '1', 'requests.memory': '1Gi' },
          name: 'medium',
          namespace: 'solar-dev',
          uid: 'two',
        },
      ],
      'solar-prod': [
        {
          claims: { 'requests.cpu': '1.5', 'requests.memory': '2Gi' },
          name: 'prod',
          namespace: 'solar-prod',
          uid: 'three',
        },
      ],
    },
    conditions: [
      { type: 'Ready', status: 'True' },
      { type: 'Exhausted', status: 'True' },
    ],
    namespaceCount: 3,
    namespaces: ['solar-dev', 'solar-prod', 'solar-test'],
  },
};

describe('ResourcePool quota helpers', () => {
  it('adapts allocation and sums bound claims per namespace with quantity units', () => {
    const data = resourcePoolAggregation(pool);
    expect(data.metrics).toEqual([
      expect.objectContaining({ resource: 'requests.cpu', used: '3', hard: '4', percent: 75 }),
      expect.objectContaining({
        resource: 'requests.memory',
        used: '4Gi',
        hard: '8Gi',
        percent: 50,
      }),
    ]);
    expect(
      data.namespaces.map(namespace => ({
        metrics: namespace.metrics,
        namespace: namespace.namespace,
      }))
    ).toEqual([
      {
        namespace: 'solar-dev',
        metrics: [
          expect.objectContaining({ resource: 'requests.cpu', used: '1.5', percent: 37.5 }),
          expect.objectContaining({ resource: 'requests.memory', used: '2Gi', percent: 25 }),
        ],
      },
      {
        namespace: 'solar-prod',
        metrics: [
          expect.objectContaining({ resource: 'requests.cpu', used: '1.5', percent: 37.5 }),
          expect.objectContaining({ resource: 'requests.memory', used: '2Gi', percent: 25 }),
        ],
      },
      { namespace: 'solar-test', metrics: [] },
    ]);
    expect(data.namespaces[0].claims?.map(claim => claim.name)).toEqual(['medium', 'small']);
    expect(data.namespaces[1].claims?.map(claim => claim.name)).toEqual(['prod']);
  });

  it('adds live exhausted claims which are absent from the bound allocation status', () => {
    const liveClaims = [
      {
        metadata: { name: 'queued', namespace: 'solar-test' },
        spec: { claim: { 'requests.cpu': '4' }, pool: 'solar-pool' },
        status: {
          conditions: [
            { type: 'Ready', status: 'True', message: 'reconciled' },
            { type: 'Exhausted', status: 'True', message: 'not enough CPU' },
            { type: 'Bound', status: 'False', message: 'claim causes exhaustions' },
          ],
        },
      },
    ];
    const rows = resourcePoolClaimRows(pool, liveClaims);

    expect(rows).toHaveLength(4);
    expect(rows.at(-1)).toMatchObject({
      bound: false,
      exhausted: true,
      message: 'not enough CPU',
      name: 'queued',
      namespace: 'solar-test',
    });

    const data = resourcePoolAggregation(pool, liveClaims);
    expect(data.namespaces.find(namespace => namespace.namespace === 'solar-test')?.claims).toEqual(
      [
        expect.objectContaining({
          bound: false,
          exhausted: true,
          link: expect.objectContaining({ name: 'queued', namespace: 'solar-test' }),
          name: 'queued',
        }),
      ]
    );
  });

  it('embeds claims in ResourcePool namespace nodes and filters them by allocation type', () => {
    const data = resourcePoolAggregation(pool);
    const graph = buildQuotaConsumptionFlowGraph(data);
    const solarDev = graph.nodes.find(node => node.id === 'namespace-solar-dev');

    expect(((solarDev?.data.claims as any[]) || []).map(claim => claim.name)).toEqual([
      'medium',
      'small',
    ]);
    expect(solarDev?.style).toMatchObject({ height: 232, pointerEvents: 'all' });

    const storageGraph = buildQuotaConsumptionFlowGraph(data, 'requests.storage');
    const filteredSolarDev = storageGraph.nodes.find(node => node.id === 'namespace-solar-dev');
    expect(filteredSolarDev?.data.claims as any[]).toEqual([]);
    expect(filteredSolarDev?.style).toMatchObject({ height: 156, pointerEvents: 'none' });
  });

  it('summarizes readiness, peak capacity, claims, namespaces, and exhaustion', () => {
    expect(summarizeResourcePools([pool])).toEqual({
      capacity: { critical: 0, healthy: 1, warning: 0 },
      claims: 2,
      exhausted: 1,
      namespaces: 3,
      readiness: { notReady: 0, ready: 1 },
      total: 1,
    });
  });
});
