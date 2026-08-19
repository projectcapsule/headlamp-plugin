import type {
  GlobalProxyClusterResource,
  GlobalProxyRule,
  GlobalProxySubject,
} from '../../resources/globalProxySettings';

export interface GlobalProxySettingsSummary {
  clusterResources: number;
  groups: number;
  notReady: number;
  ready: number;
  rules: number;
  serviceAccounts: number;
  subjects: number;
  total: number;
  users: number;
}

export interface GlobalProxyRuleRow {
  apiGroups: string[];
  id: string;
  operations: string[];
  resourceIndex: number;
  resources: string[];
  ruleIndex: number;
  selector: string;
  subjects: GlobalProxySubject[];
}

function settingsSpec(item: any) {
  return item?.spec || item?.jsonData?.spec || {};
}

export function globalProxyReadyCondition(item: any) {
  const status = item?.status || item?.jsonData?.status;
  return status?.conditions?.find((condition: any) => condition.type === 'Ready');
}

export function globalProxyRules(item: any): GlobalProxyRule[] {
  const rules = settingsSpec(item).rules;
  return Array.isArray(rules) ? rules : [];
}

export function globalProxySubjects(item: any): GlobalProxySubject[] {
  const subjects = new Map<string, GlobalProxySubject>();
  globalProxyRules(item).forEach(rule => {
    (rule.subjects || []).forEach(subject => {
      if (subject?.kind && subject?.name) {
        subjects.set(`${subject.kind}/${subject.name}`, subject);
      }
    });
  });
  return Array.from(subjects.values()).sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
}

export function globalProxyClusterResourceCount(item: any): number {
  return globalProxyRules(item).reduce(
    (total, rule) => total + (rule.clusterResources?.length || 0),
    0
  );
}

export function formatGlobalProxySelector(
  selector: GlobalProxyClusterResource['selector']
): string {
  if (!selector) return 'All labels';

  const labels = Object.entries(selector.matchLabels || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  const expressions = (selector.matchExpressions || []).map(expression => {
    const values = expression.values?.length ? ` (${expression.values.join(', ')})` : '';
    return `${expression.key} ${expression.operator}${values}`;
  });
  return [...labels, ...expressions].join(', ') || 'All labels';
}

export function globalProxyRuleRows(item: any): GlobalProxyRuleRow[] {
  return globalProxyRules(item).flatMap((rule, ruleIndex) => {
    const resources = rule.clusterResources || [];
    const rowResources: Array<GlobalProxyClusterResource | undefined> =
      resources.length > 0 ? resources : [undefined];

    return rowResources.map((resource, resourceIndex) => ({
      apiGroups: resource?.apiGroups || [],
      id: `${ruleIndex}-${resourceIndex}`,
      operations: resource?.operations || [],
      resourceIndex,
      resources: resource?.resources || [],
      ruleIndex,
      selector: formatGlobalProxySelector(resource?.selector),
      subjects: rule.subjects || [],
    }));
  });
}

export function summarizeGlobalProxySettings(
  items: any[] | null | undefined
): GlobalProxySettingsSummary {
  const list = items || [];
  const allSubjects = new Map<string, GlobalProxySubject>();
  let ready = 0;
  let rules = 0;
  let clusterResources = 0;

  list.forEach(item => {
    if (String(globalProxyReadyCondition(item)?.status).toLowerCase() === 'true') ready += 1;
    rules += globalProxyRules(item).length;
    clusterResources += globalProxyClusterResourceCount(item);
    globalProxySubjects(item).forEach(subject =>
      allSubjects.set(`${subject.kind}/${subject.name}`, subject)
    );
  });

  const subjects = Array.from(allSubjects.values());
  return {
    clusterResources,
    groups: subjects.filter(subject => subject.kind === 'Group').length,
    notReady: list.length - ready,
    ready,
    rules,
    serviceAccounts: subjects.filter(subject => subject.kind === 'ServiceAccount').length,
    subjects: subjects.length,
    total: list.length,
    users: subjects.filter(subject => subject.kind === 'User').length,
  };
}
