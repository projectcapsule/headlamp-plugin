import { describe, expect, it } from 'vitest';
import { buildNamespaceQuotaGraph } from './namespaceQuotaGraph';
import { namespaceQuotaReferences } from './namespaceQuotaReferences';

describe('namespace quota systems', () => {
  const customQuota = {
    metadata: { name: 'objects', namespace: 'solar-dev' },
    spec: {
      limit: '20',
      sources: [{ kind: 'ConfigMap', op: 'count', path: '.metadata.name' }],
    },
    status: { usage: { used: '5' } },
  };
  const globalResourceQuota = {
    metadata: { name: 'solar' },
    spec: { quota: { hard: { 'requests.cpu': '4' } } },
    status: {
      namespaceUsage: { 'solar-dev': { used: { 'requests.cpu': '1' } } },
      namespaces: ['solar-dev'],
      total: { hard: { 'requests.cpu': '4' }, used: { 'requests.cpu': '1' } },
    },
  };

  it('collects only quota systems referencing the namespace', () => {
    const references = namespaceQuotaReferences('solar-dev', {
      customQuotas: [customQuota],
      globalResourceQuotas: [globalResourceQuota, { metadata: { name: 'other' } }],
    });

    expect(references).toHaveLength(2);
    expect(references.map(reference => reference.kind)).toEqual([
      'CustomQuota',
      'GlobalResourceQuota',
    ]);
  });

  it('filters by allocation type and centers the namespace on target rows', () => {
    const references = namespaceQuotaReferences('solar-dev', {
      customQuotas: [customQuota],
      globalResourceQuotas: [globalResourceQuota],
    });
    const graph = buildNamespaceQuotaGraph('solar-dev', references, 'requests.cpu');

    expect(graph.nodes).toHaveLength(2);
    expect((graph.nodes[1].data as any).reference.kind).toBe('GlobalResourceQuota');
    expect(graph.edges[0].animated).toBe(true);
    expect(graph.nodes[0].position.y + 112 / 2).toBe(graph.nodes[1].position.y + 158 / 2);
  });
});
