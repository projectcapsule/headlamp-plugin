import { describe, expect, it } from 'vitest';
import { effectiveNamespaceQuotaRows, resourceQuotaCandidates } from './namespaceEffectiveQuota';
import type { NamespaceQuotaReference } from './namespaceQuotaReferences';

function reference(
  kind: NamespaceQuotaReference['kind'],
  name: string,
  resource: string,
  used: string,
  hard: string
): NamespaceQuotaReference {
  return {
    crd: `${kind.toLowerCase()}s.capsule.clastix.io`,
    kind,
    metrics: [
      {
        available: '—',
        hard,
        percent: (Number(used) / Number(hard)) * 100,
        resource,
        used,
      },
    ],
    name,
    resources: [resource],
  };
}

describe('effective Namespace quota rows', () => {
  it('normalizes native ResourceQuota status', () => {
    expect(
      resourceQuotaCandidates([
        {
          kind: 'ResourceQuota',
          metadata: { name: 'compute', namespace: 'solar-test' },
          spec: { hard: { 'requests.cpu': '5' } },
          status: { hard: { 'requests.cpu': '4' }, used: { 'requests.cpu': '1' } },
        },
      ])
    ).toEqual([
      expect.objectContaining({
        available: '3',
        hard: '4',
        percent: 25,
        resource: 'requests.cpu',
        source: expect.objectContaining({ kind: 'ResourceQuota', name: 'compute' }),
        used: '1',
      }),
    ]);
  });

  it('uses the lowest hard limit and its usage for every resource', () => {
    const rows = effectiveNamespaceQuotaRows(
      [
        reference('GlobalResourceQuota', 'global-compute', 'requests.cpu', '1', '4'),
        reference('ResourcePool', 'tenant-pool', 'requests.cpu', '1.5', '2'),
        reference('GlobalResourceQuota', 'global-memory', 'requests.memory', '2', '8'),
      ],
      []
    );

    expect(rows).toEqual([
      expect.objectContaining({
        hard: '2',
        percent: 75,
        resource: 'requests.cpu',
        source: expect.objectContaining({ kind: 'ResourcePool', name: 'tenant-pool' }),
        systems: 2,
        used: '1.5',
      }),
      expect.objectContaining({
        hard: '8',
        percent: 25,
        resource: 'requests.memory',
        systems: 1,
        used: '2',
      }),
    ]);
  });

  it('prefers concrete ResourceQuota usage when hard limits are equal', () => {
    const rows = effectiveNamespaceQuotaRows(
      [reference('GlobalResourceQuota', 'global-compute', 'requests.cpu', '1', '4')],
      [
        {
          kind: 'ResourceQuota',
          metadata: { name: 'generated', namespace: 'solar-test' },
          status: { hard: { 'requests.cpu': '4' }, used: { 'requests.cpu': '3' } },
        },
      ]
    );

    expect(rows[0]).toMatchObject({
      hard: '4',
      percent: 75,
      source: { kind: 'ResourceQuota', name: 'generated' },
      systems: 2,
      used: '3',
    });
  });
});
