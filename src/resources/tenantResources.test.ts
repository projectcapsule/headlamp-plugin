import { describe, expect, it } from 'vitest';
import {
  getAppliedCount,
  getAppliedObjectsForTable,
  getDefinedReplicationEntries,
  getManagedObjectStatusMessage,
  getPlural,
  getReplicationDependencies,
  getResourceCondition,
  getSpecResourcesCount,
  hasReadyConditionTrue,
  isResourceReady,
} from './tenantResources.helpers';

describe('tenantResources helpers', () => {
  describe('getSpecResourcesCount', () => {
    it('returns 0 for null/undefined', () => {
      expect(getSpecResourcesCount(null)).toBe(0);
      expect(getSpecResourcesCount(undefined)).toBe(0);
    });

    it('returns 0 when no resources', () => {
      expect(getSpecResourcesCount({})).toBe(0);
      expect(getSpecResourcesCount({ spec: {} })).toBe(0);
    });

    it('returns length of spec.resources', () => {
      expect(getSpecResourcesCount({ spec: { resources: [1, 2, 3] } })).toBe(3);
    });

    it('falls back to jsonData.spec.resources', () => {
      const item = {
        jsonData: { spec: { resources: [{}, {}] } },
      };
      expect(getSpecResourcesCount(item)).toBe(2);
    });
  });

  describe('getAppliedCount', () => {
    it('returns 0 for falsy input', () => {
      expect(getAppliedCount(null)).toBe(0);
      expect(getAppliedCount(undefined)).toBe(0);
      expect(getAppliedCount({})).toBe(0);
    });

    it('prefers status.size', () => {
      const item = { status: { size: 42 } };
      expect(getAppliedCount(item)).toBe(42);
    });

    it('falls back to processedItems length', () => {
      const item = {
        status: {
          processedItems: [{}, {}, {}],
        },
      };
      expect(getAppliedCount(item)).toBe(3);
    });

    it('falls back to legacy resources length', () => {
      const item = {
        status: {
          resources: [{}, {}],
        },
      };
      expect(getAppliedCount(item)).toBe(2);
    });

    it('supports jsonData wrapper', () => {
      const item = {
        jsonData: {
          status: { size: 7 },
        },
      };
      expect(getAppliedCount(item)).toBe(7);
    });
  });

  describe('getAppliedObjectsForTable', () => {
    it('returns empty array for falsy input', () => {
      expect(getAppliedObjectsForTable(null)).toEqual([]);
      expect(getAppliedObjectsForTable(undefined)).toEqual([]);
    });

    it('prefers processedItems and maps them correctly', () => {
      const item = {
        status: {
          processedItems: [
            {
              version: 'v1',
              kind: 'Pod',
              name: 'my-pod',
              namespace: 'default',
              status: { lastApply: '2025-01-01' },
            },
            {
              group: 'apps',
              version: 'v1',
              kind: 'Deployment',
              name: 'my-deploy',
            },
          ],
        },
      };

      const result = getAppliedObjectsForTable(item);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'my-pod',
        namespace: 'default',
        lastUpdateTime: '2025-01-01',
        _processedItem: expect.any(Object),
      });
      expect(result[1]).toMatchObject({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: 'my-deploy',
      });
    });

    it('falls back to legacy status.resources', () => {
      const item = {
        status: {
          resources: [{ kind: 'Secret', name: 'my-secret' }],
        },
      };

      const result = getAppliedObjectsForTable(item);
      expect(result).toEqual([{ kind: 'Secret', name: 'my-secret' }]);
    });

    it('supports jsonData', () => {
      const item = {
        jsonData: {
          status: {
            resources: [{ kind: 'ConfigMap' }],
          },
        },
      };
      expect(getAppliedObjectsForTable(item)).toHaveLength(1);
    });
  });

  describe('getManagedObjectStatusMessage', () => {
    const descriptor = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      name: 'settings',
      namespace: 'green',
      _processedItem: {
        status: { status: 'False', message: 'generator failed to apply' },
      },
    };

    it('prefers the live not-ready condition message', () => {
      expect(
        getManagedObjectStatusMessage(
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'settings', namespace: 'green' },
            status: {
              conditions: [{ type: 'Ready', status: 'False', message: 'live object is not ready' }],
            },
          },
          [descriptor]
        )
      ).toBe('live object is not ready');
    });

    it('falls back to the Capsule processed-item message', () => {
      expect(
        getManagedObjectStatusMessage(
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'settings', namespace: 'green' },
          },
          [descriptor]
        )
      ).toBe('generator failed to apply');
    });
  });

  describe('isResourceReady', () => {
    it('returns false for falsy', () => {
      expect(isResourceReady(null)).toBe(false);
      expect(isResourceReady(undefined)).toBe(false);
    });

    it('returns true for Ready=True condition (string)', () => {
      const item = {
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
        },
      };
      expect(isResourceReady(item)).toBe(true);
    });

    it('returns true for Ready=true (boolean)', () => {
      const item = {
        jsonData: {
          status: {
            conditions: [{ type: 'Ready', status: true }],
          },
        },
      };
      expect(isResourceReady(item)).toBe(true);
    });

    it('returns false for Ready=False or missing', () => {
      expect(
        isResourceReady({
          status: { conditions: [{ type: 'Ready', status: 'False' }] },
        })
      ).toBe(false);

      expect(isResourceReady({ status: { conditions: [] } })).toBe(false);
      expect(isResourceReady({ status: {} })).toBe(false);
    });
  });

  describe('getResourceCondition', () => {
    it('finds conditions on plain and KubeObject-wrapped resources', () => {
      const ready = { type: 'Ready', status: 'False', message: 'apply failed' };
      const cordoned = { type: 'Cordoned', status: 'True' };

      expect(getResourceCondition({ status: { conditions: [ready] } }, 'Ready')).toBe(ready);
      expect(
        getResourceCondition({ jsonData: { status: { conditions: [cordoned] } } }, 'Cordoned')
      ).toBe(cordoned);
      expect(getResourceCondition({}, 'Ready')).toBeUndefined();
    });
  });

  describe('getReplicationDependencies', () => {
    it('resolves TenantResource dependencies only within the same namespace', () => {
      const item = {
        kind: 'TenantResource',
        metadata: { name: 'consumer', namespace: 'solar-test' },
        spec: { dependsOn: [{ name: 'base' }, { name: 'missing' }] },
      };
      const dependencies = getReplicationDependencies(item, [
        {
          kind: 'TenantResource',
          metadata: { name: 'base', namespace: 'other' },
          status: { conditions: [{ type: 'Ready', status: 'True' }] },
        },
        {
          kind: 'TenantResource',
          metadata: { name: 'base', namespace: 'solar-test' },
          status: {
            conditions: [
              { type: 'Ready', status: 'False', message: 'source is still reconciling' },
            ],
          },
        },
      ]);

      expect(
        dependencies.map(({ name, namespace, state, message }) => ({
          name,
          namespace,
          state,
          message,
        }))
      ).toEqual([
        {
          name: 'base',
          namespace: 'solar-test',
          state: 'Not Ready',
          message: 'source is still reconciling',
        },
        {
          name: 'missing',
          namespace: 'solar-test',
          state: 'Missing',
          message: 'Dependency not found',
        },
      ]);
    });

    it('reports GlobalTenantResource dependencies in declared order', () => {
      const dependencies = getReplicationDependencies(
        {
          kind: 'GlobalTenantResource',
          metadata: { name: 'consumer' },
          spec: { dependsOn: [{ name: 'ready' }, { name: 'pending' }] },
        },
        [
          {
            kind: 'GlobalTenantResource',
            metadata: { name: 'pending' },
            status: { conditions: [] },
          },
          {
            kind: 'GlobalTenantResource',
            metadata: { name: 'ready' },
            status: {
              conditions: [{ type: 'Ready', status: 'True', reason: 'Reconciled' }],
            },
          },
        ]
      );

      expect(dependencies.map(dependency => dependency.name)).toEqual(['ready', 'pending']);
      expect(dependencies.map(dependency => dependency.state)).toEqual(['Ready', 'Unknown']);
    });
  });

  describe('hasReadyConditionTrue', () => {
    it('returns false for falsy or missing status', () => {
      expect(hasReadyConditionTrue(null)).toBe(false);
      expect(hasReadyConditionTrue({})).toBe(false);
      expect(hasReadyConditionTrue({ status: null })).toBe(false);
    });

    it('detects Ready=True on live KubeObject', () => {
      const obj = {
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
        },
      };
      expect(hasReadyConditionTrue(obj)).toBe(true);
    });

    it('works with jsonData.status', () => {
      const obj = {
        jsonData: {
          status: {
            conditions: [{ type: 'Ready', status: 'True' }],
          },
        },
      };
      expect(hasReadyConditionTrue(obj)).toBe(true);
    });
  });

  describe('getDefinedReplicationEntries', () => {
    it('returns empty array for null/undefined/empty', () => {
      expect(getDefinedReplicationEntries(null as any)).toEqual([]);
      expect(getDefinedReplicationEntries(undefined as any)).toEqual([]);
      expect(getDefinedReplicationEntries([])).toEqual([]);
    });

    it('handles legacy flat items', () => {
      const rules = [
        {
          kind: 'Pod',
          apiVersion: 'v1',
          name: 'legacy-pod',
          namespace: 'ns1',
        },
      ];

      const result = getDefinedReplicationEntries(rules);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _type: 'legacy',
        kind: 'Pod',
        apiVersion: 'v1',
        name: 'legacy-pod',
        namespace: 'ns1',
        _ruleIdx: 0,
      });
    });

    it('handles modern namespacedItems', () => {
      const rules = [
        {
          namespacedItems: [{ kind: 'Deployment', name: 'app', namespace: 'prod' }],
        },
      ];

      const result = getDefinedReplicationEntries(rules);
      expect(result[0]).toMatchObject({
        _type: 'namespacedItem',
        kind: 'Deployment',
        name: 'app',
        namespace: 'prod',
      });
    });

    it('handles rawItems', () => {
      const rules = [
        {
          rawItems: [
            {
              apiVersion: 'v1',
              kind: 'Secret',
              metadata: { name: 'my-secret', namespace: 'default' },
            },
          ],
        },
      ];

      const result = getDefinedReplicationEntries(rules);
      expect(result[0]).toMatchObject({
        _type: 'rawItem',
        apiVersion: 'v1',
        kind: 'Secret',
        name: 'my-secret',
        namespace: 'default',
        _raw: expect.any(Object),
      });
    });

    it('handles generators', () => {
      const rules = [{ generators: [{}, {}] }];

      const result = getDefinedReplicationEntries(rules);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _type: 'generator',
        kind: 'Generator',
        name: '2 template(s)',
      });
    });

    it('creates a Rule entry for selector-only rules', () => {
      const rules = [
        {
          namespaceSelector: { matchLabels: { env: 'prod' } },
        },
      ];

      const result = getDefinedReplicationEntries(rules);
      expect(result[0]).toMatchObject({
        _type: 'rule',
        kind: 'Rule',
        name: 'by namespaceSelector',
      });
    });

    it('mixes multiple entry types from one rule', () => {
      const rules = [
        {
          kind: 'ConfigMap',
          namespacedItems: [{ kind: 'Secret', name: 's1' }],
          rawItems: [{ kind: 'Pod' }],
          generators: [{}],
        },
      ];

      const result = getDefinedReplicationEntries(rules);
      const types = result.map(e => e._type);
      expect(types).toContain('legacy');
      expect(types).toContain('namespacedItem');
      expect(types).toContain('rawItem');
      expect(types).toContain('generator');
    });
  });

  describe('getPlural', () => {
    it('handles empty/null', () => {
      expect(getPlural('')).toBe('s');
      expect(getPlural(null as any)).toBe('s');
    });

    it('uses explicit map for common kinds', () => {
      expect(getPlural('Pod')).toBe('pods');
      expect(getPlural('Ingress')).toBe('ingresses');
      expect(getPlural('CustomResourceDefinition')).toBe('customresourcedefinitions');
    });

    it('adds s for most words', () => {
      expect(getPlural('Deployment')).toBe('deployments');
    });

    it('handles y -> ies', () => {
      expect(getPlural('Policy')).toBe('policies');
    });

    it('leaves words already ending in s', () => {
      expect(getPlural('Endpoints')).toBe('endpoints');
    });
  });
});
