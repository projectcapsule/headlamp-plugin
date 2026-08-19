import { describe, expect, it } from 'vitest';
import {
  formatGlobalProxySelector,
  globalProxyRuleRows,
  globalProxySubjects,
  summarizeGlobalProxySettings,
} from './globalProxySettingsHelpers';

const settings = {
  status: {
    conditions: [{ type: 'Ready', status: 'True', message: 'reconciled' }],
  },
  spec: {
    rules: [
      {
        subjects: [
          { kind: 'User', name: 'alice' },
          { kind: 'Group', name: 'platform' },
        ],
        clusterResources: [
          {
            apiGroups: ['capsule.clastix.io'],
            operations: ['List'],
            resources: ['globalresourcequotas'],
            selector: {
              matchLabels: {
                'projectcapsule.dev/tenant': 'solar',
              },
            },
          },
          {
            apiGroups: [''],
            resources: ['namespaces'],
            selector: {
              matchExpressions: [
                { key: 'kubernetes.io/metadata.name', operator: 'In', values: ['solar-dev'] },
              ],
            },
          },
        ],
      },
      {
        subjects: [{ kind: 'User', name: 'alice' }],
      },
    ],
  },
};

describe('GlobalProxySettings helpers', () => {
  it('summarizes readiness, rules, unique subjects, and cluster resource grants', () => {
    expect(
      summarizeGlobalProxySettings([
        settings,
        {
          jsonData: {
            status: { conditions: [{ type: 'Ready', status: 'False' }] },
            spec: {
              rules: [
                {
                  subjects: [{ kind: 'ServiceAccount', name: 'system:serviceaccount:ops:reader' }],
                },
              ],
            },
          },
        },
      ])
    ).toEqual({
      clusterResources: 2,
      groups: 1,
      notReady: 1,
      ready: 1,
      rules: 3,
      serviceAccounts: 1,
      subjects: 3,
      total: 2,
      users: 1,
    });
  });

  it('deduplicates subjects and flattens each cluster resource into a stable row', () => {
    expect(globalProxySubjects(settings).map(subject => `${subject.kind}/${subject.name}`)).toEqual(
      ['Group/platform', 'User/alice']
    );

    const rows = globalProxyRuleRows(settings);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      apiGroups: ['capsule.clastix.io'],
      id: '0-0',
      operations: ['List'],
      resources: ['globalresourcequotas'],
      ruleIndex: 0,
      selector: 'projectcapsule.dev/tenant=solar',
    });
    expect(rows[1].selector).toBe('kubernetes.io/metadata.name In (solar-dev)');
    expect(rows[2]).toMatchObject({
      apiGroups: [],
      id: '1-0',
      resources: [],
      selector: 'All labels',
    });
  });

  it('formats label selectors deterministically', () => {
    expect(formatGlobalProxySelector({ matchLabels: { z: 'last', a: 'first' } })).toBe(
      'a=first, z=last'
    );
    expect(formatGlobalProxySelector(undefined)).toBe('All labels');
  });
});
