import type {
  CapsuleConfigurationIdentity,
  CapsuleConfigurationWebhook,
} from '../../resources/capsuleConfigurations';

export type CapsuleConfigurationState = 'Not Ready' | 'Ready' | 'Reconciling' | 'Unknown';

export interface CapsuleConfigurationWebhookRow extends CapsuleConfigurationWebhook {
  endpoint: string;
  id: string;
  ruleCount: number;
  type: 'Mutating' | 'Validating';
}

export interface CapsuleConfigurationIdentityRow extends CapsuleConfigurationIdentity {
  id: string;
  source: 'Administrator' | 'Configured User' | 'Reconciled User';
}

export interface CapsuleConfigurationSummary {
  groups: number;
  identities: number;
  mutatingWebhooks: number;
  notReady: number;
  ready: number;
  reconciling: number;
  serviceAccounts: number;
  tenants: number;
  total: number;
  unknown: number;
  users: number;
  validatingWebhooks: number;
  webhooks: number;
}

function rawObject(item: any) {
  return item?.jsonData || item || {};
}

export function capsuleConfigurationReadyCondition(item: any) {
  return rawObject(item).status?.conditions?.find((condition: any) => condition.type === 'Ready');
}

export function capsuleConfigurationState(item: any): CapsuleConfigurationState {
  const raw = rawObject(item);
  const condition = capsuleConfigurationReadyCondition(raw);
  const status = String(condition?.status ?? '').toLowerCase();

  if (status === 'false') return 'Not Ready';
  if (status !== 'true') return 'Unknown';

  const generation = Number(raw.metadata?.generation);
  const observedGeneration = Number(
    raw.status?.observedGeneration ?? condition?.observedGeneration
  );
  if (
    Number.isFinite(generation) &&
    Number.isFinite(observedGeneration) &&
    observedGeneration < generation
  ) {
    return 'Reconciling';
  }

  return 'Ready';
}

export function capsuleConfigurationMessage(item: any): string {
  const raw = rawObject(item);
  const state = capsuleConfigurationState(raw);
  const condition = capsuleConfigurationReadyCondition(raw);
  if (state === 'Reconciling') {
    return `Waiting for generation ${raw.metadata?.generation} (observed ${
      raw.status?.observedGeneration ?? condition?.observedGeneration ?? '—'
    })`;
  }
  return condition?.message || condition?.reason || '';
}

export function capsuleConfigurationTenants(item: any): string[] {
  const tenants = rawObject(item).status?.tenants;
  return Array.isArray(tenants)
    ? Array.from(new Set(tenants.filter(Boolean))).sort((left, right) => left.localeCompare(right))
    : [];
}

export function capsuleConfigurationReconciledUsers(item: any): CapsuleConfigurationIdentity[] {
  const users = rawObject(item).status?.users;
  if (!Array.isArray(users)) return [];

  const identities = new Map<string, CapsuleConfigurationIdentity>();
  users.forEach(identity => {
    if (identity?.kind && identity?.name) {
      identities.set(`${identity.kind}/${identity.name}`, identity);
    }
  });
  return Array.from(identities.values()).sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
}

function admissionEndpoint(group: any): string {
  const service = group?.client?.service;
  if (service?.name) {
    const namespace = service.namespace ? `${service.namespace}/` : '';
    const port = service.port ? `:${service.port}` : '';
    return `${namespace}${service.name}${port}`;
  }
  return group?.client?.url || '—';
}

export function capsuleConfigurationWebhookRows(item: any): CapsuleConfigurationWebhookRow[] {
  const admission = rawObject(item).spec?.admission || {};
  const groups: Array<['Mutating' | 'Validating', any]> = [
    ['Mutating', admission.mutating],
    ['Validating', admission.validating],
  ];

  return groups.flatMap(([type, group]) =>
    (Array.isArray(group?.webhooks) ? group.webhooks : []).map(
      (webhook: CapsuleConfigurationWebhook, index: number) => ({
        ...webhook,
        endpoint: admissionEndpoint(group),
        id: `${type.toLowerCase()}-${webhook.name || index}`,
        ruleCount: Array.isArray(webhook.rules) ? webhook.rules.length : 0,
        type,
      })
    )
  );
}

export function capsuleConfigurationIdentityRows(item: any): CapsuleConfigurationIdentityRow[] {
  const raw = rawObject(item);
  const sources: Array<
    [CapsuleConfigurationIdentityRow['source'], CapsuleConfigurationIdentity[] | undefined]
  > = [
    ['Administrator', raw.spec?.administrators],
    ['Configured User', raw.spec?.users],
    ['Reconciled User', raw.status?.users],
  ];

  return sources
    .flatMap(([source, identities]) =>
      (Array.isArray(identities) ? identities : [])
        .filter(identity => identity?.kind && identity?.name)
        .map(identity => ({
          ...identity,
          id: `${source}/${identity.kind}/${identity.name}`,
          source,
        }))
    )
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name)
    );
}

export function summarizeCapsuleConfigurations(
  items: any[] | null | undefined
): CapsuleConfigurationSummary {
  const list = items || [];
  const summary: CapsuleConfigurationSummary = {
    groups: 0,
    identities: 0,
    mutatingWebhooks: 0,
    notReady: 0,
    ready: 0,
    reconciling: 0,
    serviceAccounts: 0,
    tenants: 0,
    total: list.length,
    unknown: 0,
    users: 0,
    validatingWebhooks: 0,
    webhooks: 0,
  };

  list.forEach(item => {
    const state = capsuleConfigurationState(item);
    if (state === 'Ready') summary.ready += 1;
    else if (state === 'Not Ready') summary.notReady += 1;
    else if (state === 'Reconciling') summary.reconciling += 1;
    else summary.unknown += 1;

    summary.tenants += capsuleConfigurationTenants(item).length;
    const identities = capsuleConfigurationReconciledUsers(item);
    summary.identities += identities.length;
    summary.users += identities.filter(identity => identity.kind === 'User').length;
    summary.groups += identities.filter(identity => identity.kind === 'Group').length;
    summary.serviceAccounts += identities.filter(
      identity => identity.kind === 'ServiceAccount'
    ).length;

    const webhooks = capsuleConfigurationWebhookRows(item);
    summary.mutatingWebhooks += webhooks.filter(webhook => webhook.type === 'Mutating').length;
    summary.validatingWebhooks += webhooks.filter(webhook => webhook.type === 'Validating').length;
    summary.webhooks += webhooks.length;
  });

  return summary;
}
