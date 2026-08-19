import { describe, expect, it, vi } from 'vitest';
import { buildTenantPersistentVolumeFlowGraph } from './TenantPersistentVolumeFlow';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: () => null,
}));
vi.mock('../common/CapsuleResourceLink', () => ({
  CapsuleResourceLink: ({ children }: any) => children,
}));

describe('Tenant PersistentVolume flow', () => {
  it('connects Tenant to labeled PVCs and each claim to its bound PV', () => {
    const claims = ['zeta', 'alpha'].map(name => ({
      cluster: 'main',
      jsonData: {
        metadata: { name: `${name}-claim`, namespace: 'solar-prod' },
        spec: { volumeName: name },
        status: { phase: 'Bound' },
      },
    }));
    const volumes = ['zeta', 'alpha'].map((name, index) => ({
      cluster: 'main',
      jsonData: {
        metadata: { name },
        spec: { capacity: { storage: `${index + 1}0Gi` } },
        status: { phase: 'Bound' },
      },
    }));
    const graph = buildTenantPersistentVolumeFlowGraph('solar', claims, volumes);

    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    expect(graph.edges.every(edge => edge.animated)).toBe(true);
    expect(graph.edges[0]).toMatchObject({
      source: 'tenant-solar',
      target: 'persistent-volume-claim-solar-prod-zeta-claim',
    });
    expect(graph.edges[1]).toMatchObject({
      source: 'persistent-volume-claim-solar-prod-zeta-claim',
      target: 'persistent-volume-zeta',
    });
    expect(graph.nodes[0].data).toEqual({ claimCount: 2, name: 'solar', volumeCount: 2 });
    expect(graph.nodes[1].data).toMatchObject({
      hasVolume: true,
      name: 'zeta-claim',
      namespace: 'solar-prod',
      phase: 'Bound',
    });
    expect(graph.nodes[2].data).toMatchObject({
      capacity: '10Gi',
      name: 'zeta',
      phase: 'Bound',
    });
    expect(graph.nodes[0].position.y + 88 / 2).toBe(
      (graph.nodes[1].position.y + graph.nodes[3].position.y + 92) / 2
    );
  });

  it('keeps an owned PV visible when its referenced PVC cannot be loaded', () => {
    const volume = {
      metadata: { name: 'pv-orphaned' },
      spec: { capacity: { storage: '5Gi' } },
      status: { phase: 'Bound' },
    };
    const graph = buildTenantPersistentVolumeFlowGraph('solar', [], [volume]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: 'tenant-solar',
      target: 'persistent-volume-pv-orphaned',
    });
    expect(graph.nodes[1].data).toMatchObject({ name: 'pv-orphaned', phase: 'Bound' });
  });
});
