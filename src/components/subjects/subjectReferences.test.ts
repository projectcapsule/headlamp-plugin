import { describe, expect, it } from 'vitest';
import {
  bindingMentionsSubject,
  capsuleSubjectFromServiceAccountReference,
  capsuleSubjectLabel,
  globalProxySettingsSubjectMentions,
  manifestSubjects,
  normalizeCapsuleSubject,
  tenantOwnerMentionsSubject,
  tenantPromotionsForSubject,
  tenantSubjectMentions,
} from './subjectReferences';

describe('Capsule subject references', () => {
  it('canonicalizes Kubernetes ServiceAccount identities', () => {
    const canonical = normalizeCapsuleSubject({
      kind: 'User',
      name: 'system:serviceaccount:solar-prod:deployer',
    });

    expect(canonical).toEqual({
      kind: 'ServiceAccount',
      name: 'deployer',
      namespace: 'solar-prod',
    });
    expect(capsuleSubjectLabel(canonical!)).toBe('ServiceAccount/solar-prod/deployer');
    expect(
      normalizeCapsuleSubject({ kind: 'ServiceAccount', name: 'solar-prod/deployer' })
    ).toEqual(canonical);
    expect(capsuleSubjectFromServiceAccountReference({ name: 'deployer' }, 'solar-prod')).toEqual(
      canonical
    );
  });

  it('finds owner and promotion mentions in a Tenant', () => {
    const tenant = {
      spec: { owners: [{ kind: 'User', name: 'alice' }] },
      status: {
        promotions: [{ kind: 'ServiceAccount', name: 'solar-prod/deployer' }],
      },
    };

    expect(tenantSubjectMentions(tenant, { kind: 'User', name: 'alice' })).toEqual(['Owner']);
    expect(
      tenantSubjectMentions(tenant, {
        kind: 'ServiceAccount',
        name: 'deployer',
        namespace: 'solar-prod',
      })
    ).toEqual(['Promoted identity']);
  });

  it('returns only status-reported promotions for the exact ServiceAccount', () => {
    const tenant = {
      spec: {
        promotions: [
          {
            clusterRoles: ['spec-role'],
            kind: 'ServiceAccount',
            name: 'system:serviceaccount:solar-prod:deployer',
          },
        ],
      },
      status: {
        owners: [
          {
            clusterRoles: ['owner-role'],
            kind: 'ServiceAccount',
            name: 'system:serviceaccount:solar-prod:deployer',
          },
        ],
        promotions: [
          {
            clusterRoles: ['edit', 'view'],
            kind: 'ServiceAccount',
            name: 'system:serviceaccount:solar-prod:deployer',
            targets: ['solar-prod', 'solar-test'],
          },
          {
            kind: 'ServiceAccount',
            name: 'system:serviceaccount:solar-test:deployer',
          },
        ],
      },
    };

    expect(
      tenantPromotionsForSubject(tenant, {
        kind: 'ServiceAccount',
        name: 'deployer',
        namespace: 'solar-prod',
      })
    ).toEqual([
      {
        clusterRoles: ['edit', 'view'],
        identity: 'system:serviceaccount:solar-prod:deployer',
        name: 'deployer',
        namespace: 'solar-prod',
        targets: ['solar-prod', 'solar-test'],
      },
    ]);
    expect(tenantPromotionsForSubject(tenant, { kind: 'User', name: 'deployer' })).toEqual([]);
  });

  it('matches a TenantOwner by its exact normalized identity', () => {
    const owner = { spec: { kind: 'User', name: 'alice' } };

    expect(tenantOwnerMentionsSubject(owner, { kind: 'User', name: 'alice' })).toBe(true);
    expect(tenantOwnerMentionsSubject(owner, { kind: 'Group', name: 'alice' })).toBe(false);
  });

  it('matches native RBAC subjects without conflating ServiceAccount namespaces', () => {
    const binding = {
      subjects: [{ kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' }],
    };

    expect(
      bindingMentionsSubject(binding, {
        kind: 'ServiceAccount',
        namespace: 'solar-prod',
        name: 'deployer',
      })
    ).toBe(true);
    expect(
      bindingMentionsSubject(binding, {
        kind: 'ServiceAccount',
        namespace: 'solar-test',
        name: 'deployer',
      })
    ).toBe(false);
  });

  it('extracts and deduplicates subjects from rendered manifests', () => {
    expect(
      manifestSubjects({
        kind: 'RoleBinding',
        subjects: [
          { kind: 'User', name: 'alice' },
          { kind: 'User', name: 'alice' },
          { kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' },
        ],
      })
    ).toEqual([
      { kind: 'User', name: 'alice' },
      { kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' },
    ]);
  });

  it('finds every GlobalProxySettings rule mentioning the normalized subject', () => {
    const settings = {
      spec: {
        rules: [
          {
            subjects: [{ kind: 'User', name: 'alice' }],
            clusterResources: [{ apiGroups: [''], resources: ['nodes'] }],
          },
          {
            subjects: [
              {
                kind: 'ServiceAccount',
                name: 'system:serviceaccount:solar-prod:deployer',
              },
            ],
          },
          { subjects: [{ kind: 'User', name: 'alice' }] },
        ],
      },
    };

    expect(globalProxySettingsSubjectMentions(settings, { kind: 'User', name: 'alice' })).toEqual([
      'Rule #1',
      'Rule #3',
    ]);
    expect(
      globalProxySettingsSubjectMentions(settings, {
        kind: 'ServiceAccount',
        namespace: 'solar-prod',
        name: 'deployer',
      })
    ).toEqual(['Rule #2']);
  });
});
