import { describe, expect, it } from 'vitest';
import {
  capsuleConfigurationIdentityRows,
  capsuleConfigurationState,
  capsuleConfigurationWebhookRows,
  summarizeCapsuleConfigurations,
} from './capsuleConfigurationHelpers';

function configuration(overrides: any = {}) {
  return {
    metadata: { generation: 4, name: 'default' },
    spec: {
      administrators: [{ kind: 'User', name: 'admin' }],
      admission: {
        mutating: {
          client: { service: { name: 'capsule-webhook', namespace: 'capsule-system', port: 9443 } },
          webhooks: [{ name: 'namespaces.mutating', rules: [{}, {}] }],
        },
        validating: {
          webhooks: [{ failurePolicy: 'Fail', name: 'namespaces.validating', rules: [{}] }],
        },
      },
      users: [{ kind: 'Group', name: 'capsule-users' }],
    },
    status: {
      conditions: [{ message: 'reconciled', status: 'True', type: 'Ready' }],
      observedGeneration: 4,
      tenants: ['solar', 'wind'],
      users: [
        { kind: 'Group', name: 'capsule-users' },
        { kind: 'ServiceAccount', name: 'system:serviceaccount:solar:owner' },
        { kind: 'User', name: 'alice' },
      ],
    },
    ...overrides,
  };
}

describe('CapsuleConfiguration helpers', () => {
  it('distinguishes ready, reconciling, not-ready, and unknown health', () => {
    expect(capsuleConfigurationState(configuration())).toBe('Ready');
    expect(
      capsuleConfigurationState(
        configuration({
          status: { conditions: [{ status: 'True', type: 'Ready' }], observedGeneration: 3 },
        })
      )
    ).toBe('Reconciling');
    expect(
      capsuleConfigurationState(
        configuration({ status: { conditions: [{ status: 'False', type: 'Ready' }] } })
      )
    ).toBe('Not Ready');
    expect(capsuleConfigurationState(configuration({ status: {} }))).toBe('Unknown');
  });

  it('normalizes admission webhooks and identity sources', () => {
    const item = configuration();
    expect(capsuleConfigurationWebhookRows(item)).toEqual([
      expect.objectContaining({
        endpoint: 'capsule-system/capsule-webhook:9443',
        name: 'namespaces.mutating',
        ruleCount: 2,
        type: 'Mutating',
      }),
      expect.objectContaining({
        endpoint: '—',
        name: 'namespaces.validating',
        ruleCount: 1,
        type: 'Validating',
      }),
    ]);
    expect(capsuleConfigurationIdentityRows(item).map(row => row.source)).toEqual([
      'Administrator',
      'Configured User',
      'Reconciled User',
      'Reconciled User',
      'Reconciled User',
    ]);
  });

  it('summarizes health, managed state, identities, and admission webhooks', () => {
    expect(summarizeCapsuleConfigurations([configuration()])).toEqual({
      groups: 1,
      identities: 3,
      mutatingWebhooks: 1,
      notReady: 0,
      ready: 1,
      reconciling: 0,
      serviceAccounts: 1,
      tenants: 2,
      total: 1,
      unknown: 0,
      users: 1,
      validatingWebhooks: 1,
      webhooks: 2,
    });
  });
});
