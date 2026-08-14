import { describe, expect, it } from 'vitest';
import {
  CAPSULE_DOCUMENTATION_ACTION_ID,
  DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL,
  documentationPathForResource,
  documentationUrlForResource,
  insertDocumentationAction,
  isDocumentationBaseUrlValid,
  normalizeDocumentationBaseUrl,
} from './capsuleDocumentation';

describe('Capsule documentation actions', () => {
  it.each([
    ['Tenant', '/docs/tenants/'],
    ['TenantOwner', '/docs/tenants/permissions/#ownership'],
    ['GlobalResourceQuota', '/docs/resource-management/globalresourcequota/'],
    ['ResourcePool', '/docs/resource-management/resourcepools/'],
    ['ResourcePoolClaim', '/docs/resource-management/resourcepools/#resourcepoolclaims'],
    ['CustomQuota', '/docs/resource-management/customquotas/#customquota'],
    ['GlobalCustomQuota', '/docs/resource-management/customquotas/#globalcustomquota'],
    ['GlobalTenantResource', '/docs/replications/global/'],
    ['TenantResource', '/docs/replications/tenant/'],
  ])('maps %s to its documentation path', (kind, path) => {
    expect(documentationPathForResource({ kind })).toBe(path);
  });

  it('joins a configurable base path without losing anchors', () => {
    expect(
      documentationUrlForResource(
        { jsonData: { kind: 'TenantOwner' } },
        'https://docs.example.test/capsule/'
      )
    ).toBe('https://docs.example.test/capsule/docs/tenants/permissions/#ownership');
  });

  it('falls back to the default for missing, invalid, or unsafe base URLs', () => {
    expect(normalizeDocumentationBaseUrl()).toBe(DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL);
    expect(normalizeDocumentationBaseUrl('javascript:alert(1)')).toBe(
      DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL
    );
    expect(normalizeDocumentationBaseUrl('not a URL')).toBe(DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL);
    expect(isDocumentationBaseUrlValid('https://docs.example.test')).toBe(true);
    expect(isDocumentationBaseUrlValid('')).toBe(true);
    expect(isDocumentationBaseUrlValid('file:///tmp/docs')).toBe(false);
  });

  it('inserts the docs action immediately after Edit and only once', () => {
    const action = { id: CAPSULE_DOCUMENTATION_ACTION_ID };
    const actions = [{ id: 'SCALE' }, { id: 'EDIT' }, { id: 'DELETE' }];
    const inserted = insertDocumentationAction({ kind: 'Tenant' }, actions, action);

    expect(inserted.map(item => item.id)).toEqual([
      'SCALE',
      'EDIT',
      CAPSULE_DOCUMENTATION_ACTION_ID,
      'DELETE',
    ]);
    expect(insertDocumentationAction({ kind: 'Tenant' }, inserted, action)).toBe(inserted);
  });

  it('leaves unsupported resource actions unchanged', () => {
    const actions = [{ id: 'EDIT' }, { id: 'DELETE' }];
    expect(
      insertDocumentationAction({ kind: 'Deployment' }, actions, {
        id: CAPSULE_DOCUMENTATION_ACTION_ID,
      })
    ).toBe(actions);
  });
});
