import { describe, expect, it } from 'vitest';
import {
  buildCreateResourcePermit,
  filterResourcePermitTemplates,
  groupResourcePermitTemplates,
  resourcePermitTemplateCategory,
  UNCATEGORIZED_TEMPLATE_CATEGORY,
} from './resourcePermitCreate';

describe('ResourcePermit creation', () => {
  it('builds a namespaced request without supplying an authenticated requestor', () => {
    const request = buildCreateResourcePermit({
      duration: '1h',
      name: 'incident-access',
      namespace: 'solar-test',
      params: { subjectKind: 'User', subjectName: 'alice' },
      reason: 'Incident 42',
      templateName: 'crd-resource-crud',
    });

    expect(request?.url).toBe(
      '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/resourcepermits'
    );
    expect(request?.body.spec).toMatchObject({
      duration: '1h',
      params: { subjectKind: 'User', subjectName: 'alice' },
      reason: 'Incident 42',
      template: { kind: 'GlobalResourcePermitTemplate', name: 'crd-resource-crud' },
    });
    expect(request?.body.spec).not.toHaveProperty('requestor');
  });

  it('uses metadata.generateName when the user requests a generated name', () => {
    const request = buildCreateResourcePermit({
      generateName: 'incident-access',
      namespace: 'solar-test',
      params: {},
      reason: 'Incident 43',
      templateName: 'crd-resource-crud',
    });

    expect(request?.generated).toBe(true);
    expect(request?.body.metadata).toEqual({
      generateName: 'incident-access-',
      namespace: 'solar-test',
    });
    expect(request?.body.metadata).not.toHaveProperty('name');
  });

  it('references a namespaced ResourcePermitTemplate when selected', () => {
    const request = buildCreateResourcePermit({
      name: 'local-template-access',
      namespace: 'solar-test',
      params: {},
      templateKind: 'ResourcePermitTemplate',
      templateName: 'namespace-editor',
    });

    expect(request?.body.spec.template).toEqual({
      kind: 'ResourcePermitTemplate',
      name: 'namespace-editor',
    });
  });

  it('preserves a root array as raw JSON Schema form data', () => {
    const request = buildCreateResourcePermit({
      name: 'multi-role-access',
      namespace: 'solar-test',
      params: ['view', 'edit'],
      templateName: 'clusterrole-distribution',
    });

    expect(request?.body.spec.params).toEqual(['view', 'edit']);
  });

  it('searches templates and applies every selected tag', () => {
    const templates = [
      {
        getName: () => 'production-diagnostics',
        metadata: {
          annotations: {
            'info.projectcapsule.dev/description': 'Temporary incident access',
            'info.projectcapsule.dev/tags': 'production, diagnostics, break-glass',
          },
        },
      },
      {
        getName: () => 'production-readonly',
        metadata: {
          annotations: {
            'info.projectcapsule.dev/description': 'Read-only access',
            'info.projectcapsule.dev/tags': 'production, readonly',
          },
        },
      },
    ];

    expect(filterResourcePermitTemplates(templates, 'incident', [])).toEqual([templates[0]]);
    expect(filterResourcePermitTemplates(templates, '', ['production', 'diagnostics'])).toEqual([
      templates[0],
    ]);
    expect(filterResourcePermitTemplates(templates, '', ['diagnostics', 'readonly'])).toEqual([]);
  });

  it('groups templates once by their first tag and puts untagged templates last', () => {
    const templates = [
      {
        getName: () => 'untagged',
        metadata: { annotations: {} },
      },
      {
        getName: () => 'production-readonly',
        metadata: { annotations: { 'info.projectcapsule.dev/tags': 'production, readonly' } },
      },
      {
        getName: () => 'development-admin',
        metadata: { annotations: { 'info.projectcapsule.dev/tags': 'development, admin' } },
      },
    ];

    expect(resourcePermitTemplateCategory(templates[1])).toBe('production');
    expect(resourcePermitTemplateCategory(templates[0])).toBe(UNCATEGORIZED_TEMPLATE_CATEGORY);
    expect(
      groupResourcePermitTemplates(templates).map(group => [
        group.category,
        group.templates.map(template => template.getName()),
      ])
    ).toEqual([
      ['development', ['development-admin']],
      ['production', ['production-readonly']],
      [UNCATEGORIZED_TEMPLATE_CATEGORY, ['untagged']],
    ]);
  });
});
