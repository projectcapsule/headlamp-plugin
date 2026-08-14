import { describe, expect, it } from 'vitest';
import type { MapResourceNode } from './mapTypes';
import {
  buildTenantNamespaceIndex,
  groupResourcesByTenant,
  TENANT_NAMESPACE_LABEL,
} from './tenantGrouping';

function kubeObject(
  kind: string,
  name: string,
  namespace?: string,
  labels?: Record<string, string>
) {
  return {
    kind,
    metadata: {
      name,
      namespace,
      uid: `${kind.toLowerCase()}-${name}`,
      labels,
    },
  } as any;
}

function resourceNode(kind: string, name: string, namespace?: string): MapResourceNode {
  const object = kubeObject(kind, name, namespace);
  return { id: object.metadata.uid, kubeObject: object, sourceId: kind.toLowerCase() };
}

describe('Tenant map grouping', () => {
  it('wraps namespace grids in their Tenant and keeps unowned namespaces outside', () => {
    const tenants = [
      {
        ...kubeObject('Tenant', 'green'),
        status: { namespaces: ['green-a', 'green-b'] },
      },
      {
        ...kubeObject('Tenant', 'wind'),
        status: { spaces: { 'wind-a': { name: 'wind-a' } } },
      },
    ];
    const namespaces = [
      kubeObject('Namespace', 'green-a'),
      kubeObject('Namespace', 'green-b'),
      kubeObject('Namespace', 'wind-a'),
      kubeObject('Namespace', 'shared'),
    ];
    const groups = groupResourcesByTenant(
      [
        resourceNode('Deployment', 'api', 'green-a'),
        resourceNode('Service', 'api', 'green-b'),
        resourceNode('Pod', 'worker', 'wind-a'),
        resourceNode('ConfigMap', 'shared', 'shared'),
      ],
      namespaces,
      tenants
    );

    const green = groups.find(node => 'nodes' in node && node.label === 'green');
    const wind = groups.find(node => 'nodes' in node && node.label === 'wind');

    expect(
      green && 'nodes' in green ? green.nodes.map(node => ('label' in node ? node.label : '')) : []
    ).toEqual(['green-a', 'green-b']);
    expect(
      wind && 'nodes' in wind ? wind.nodes.map(node => ('label' in node ? node.label : '')) : []
    ).toEqual(['wind-a']);
    expect(groups.some(node => 'label' in node && node.label === 'shared')).toBe(true);
  });

  it('prefers the namespace Tenant label over stale Tenant status', () => {
    const tenants = [
      { ...kubeObject('Tenant', 'green'), status: { namespaces: ['moved'] } },
      { ...kubeObject('Tenant', 'wind'), status: { namespaces: [] } },
    ];
    const namespaces = [
      kubeObject('Namespace', 'moved', undefined, { [TENANT_NAMESPACE_LABEL]: 'wind' }),
    ];

    expect(buildTenantNamespaceIndex(namespaces, tenants).get('moved')).toBe('wind');
  });

  it('keeps cluster-scoped Tenant resources in a separate map grid', () => {
    const tenant = { ...kubeObject('Tenant', 'solar'), status: { namespaces: ['solar-a'] } };
    const groups = groupResourcesByTenant(
      [
        { id: tenant.metadata.uid, kubeObject: tenant, sourceId: 'tenants' },
        resourceNode('Deployment', 'web', 'solar-a'),
      ],
      [kubeObject('Namespace', 'solar-a')],
      [tenant]
    );

    expect(groups.find(node => 'label' in node && node.label === 'solar')).toBeDefined();
    expect(groups.find(node => 'label' in node && node.label === 'Cluster scoped')).toBeDefined();
  });
});
