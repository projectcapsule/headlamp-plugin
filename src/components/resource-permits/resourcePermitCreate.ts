import { capsuleResourceTags } from '../tags/capsuleTags';

export const UNCATEGORIZED_TEMPLATE_CATEGORY = 'Uncategorized';

function templateObjectData(template: any): any {
  const resource = template?.template || template;
  return resource?.jsonData || resource || {};
}

function templateCatalogName(template: any): string {
  const resource = template?.template || template;
  return String(resource?.getName?.() || templateObjectData(resource).metadata?.name || '').trim();
}

/** The first declared tag is the template's primary catalog category. */
export function resourcePermitTemplateCategory(template: any): string {
  return capsuleResourceTags(template?.template || template)[0] || UNCATEGORIZED_TEMPLATE_CATEGORY;
}

/** Search plus an AND-style multi-tag filter for the template catalog. */
export function filterResourcePermitTemplates(
  templates: any[],
  search: string,
  selectedTags: string[]
): any[] {
  const query = search.trim().toLocaleLowerCase();
  return templates.filter(template => {
    const tags = capsuleResourceTags(template?.template || template);
    if (selectedTags.some(tag => !tags.includes(tag))) return false;
    if (!query) return true;

    const data = templateObjectData(template);
    const description = data.metadata?.annotations?.['info.projectcapsule.dev/description'] || '';
    return [templateCatalogName(template), description, ...tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query);
  });
}

export interface ResourcePermitTemplateGroup {
  category: string;
  templates: any[];
}

/** Groups each template once under its first tag, with untagged entries last. */
export function groupResourcePermitTemplates(templates: any[]): ResourcePermitTemplateGroup[] {
  const groups = new Map<string, any[]>();
  for (const template of templates) {
    const category = resourcePermitTemplateCategory(template);
    groups.set(category, [...(groups.get(category) || []), template]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNCATEGORIZED_TEMPLATE_CATEGORY) return 1;
      if (right === UNCATEGORIZED_TEMPLATE_CATEGORY) return -1;
      return left.localeCompare(right);
    })
    .map(([category, groupTemplates]) => ({
      category,
      templates: groupTemplates.sort((left, right) =>
        templateCatalogName(left).localeCompare(templateCatalogName(right))
      ),
    }));
}

export interface CreateResourcePermitInput {
  duration?: string;
  generateName?: string;
  name?: string;
  namespace: string;
  params: any;
  reason?: string;
  startTime?: string;
  templateKind?: 'ResourcePermitTemplate' | 'GlobalResourcePermitTemplate';
  templateName: string;
}

export function buildCreateResourcePermit(input: CreateResourcePermitInput) {
  const name = input.name?.trim() || '';
  const generateNameValue = input.generateName?.trim().replace(/-+$/, '') || '';
  const generateName = generateNameValue ? `${generateNameValue}-` : '';
  const namespace = input.namespace.trim();
  const templateName = input.templateName.trim();
  if ((!name && !generateName) || !namespace || !templateName) return null;

  const spec: Record<string, any> = {
    template: { kind: input.templateKind || 'GlobalResourcePermitTemplate', name: templateName },
  };
  const hasParams =
    input.params !== undefined &&
    input.params !== null &&
    (typeof input.params !== 'object' ||
      Array.isArray(input.params) ||
      Object.keys(input.params).length > 0);
  if (hasParams) spec.params = input.params;
  if (input.reason?.trim()) spec.reason = input.reason.trim();
  if (input.duration?.trim()) spec.duration = input.duration.trim();
  if (input.startTime) spec.startTime = input.startTime;

  return {
    body: {
      apiVersion: 'capsule.clastix.io/v1beta2',
      kind: 'ResourcePermit',
      metadata: { ...(name ? { name } : { generateName }), namespace },
      spec,
    },
    generated: !name,
    name: name || generateName,
    namespace,
    url: `/apis/capsule.clastix.io/v1beta2/namespaces/${encodeURIComponent(
      namespace
    )}/resourcepermits`,
  };
}
