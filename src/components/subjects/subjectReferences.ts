import {
  type PromotedServiceAccount,
  tenantPromotedServiceAccounts,
} from '../tenants/tenantStatusHelpers';

export interface CapsuleSubject {
  kind: string;
  name: string;
  namespace?: string;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function normalizedKind(kind?: string): string {
  const value = String(kind || 'User').trim();
  switch (value.toLowerCase()) {
    case 'group':
      return 'Group';
    case 'serviceaccount':
    case 'service account':
      return 'ServiceAccount';
    case 'system':
      return 'System';
    case 'user':
      return 'User';
    default:
      return value || 'User';
  }
}

/** Normalizes Capsule and Kubernetes subject spellings into one identity. */
export function normalizeCapsuleSubject(subject: {
  kind?: string;
  name?: string;
  namespace?: string;
  type?: string;
}): CapsuleSubject | undefined {
  let kind = normalizedKind(subject.kind || subject.type);
  let name = String(subject.name || '').trim();
  let namespace = String(subject.namespace || '').trim() || undefined;
  if (!name) return undefined;

  const serviceAccountMatch = name.match(/^system:serviceaccount:([^:]+):(.+)$/);
  if (serviceAccountMatch) {
    kind = 'ServiceAccount';
    namespace = serviceAccountMatch[1];
    name = serviceAccountMatch[2];
  } else if (kind === 'ServiceAccount' && !namespace && name.includes('/')) {
    const separator = name.indexOf('/');
    namespace = name.slice(0, separator) || undefined;
    name = name.slice(separator + 1);
  }

  return { kind, name, ...(namespace ? { namespace } : {}) };
}

export function capsuleSubjectFromAccessEntity(
  entity?: CapsuleAccessEntity
): CapsuleSubject | undefined {
  if (!entity) return undefined;
  return normalizeCapsuleSubject({ kind: entity.type, name: entity.name });
}

/** Normalizes a Capsule ServiceAccount reference, using object scope when the API omits it. */
export function capsuleSubjectFromServiceAccountReference(
  reference: { name?: string; namespace?: string } | undefined,
  fallbackNamespace?: string
): CapsuleSubject | undefined {
  return normalizeCapsuleSubject({
    kind: 'ServiceAccount',
    name: reference?.name,
    namespace: reference?.namespace || fallbackNamespace,
  });
}

export function capsuleSubjectLabel(subject: CapsuleSubject): string {
  if (subject.kind === 'ServiceAccount' && subject.namespace) {
    return `${subject.kind}/${subject.namespace}/${subject.name}`;
  }
  return `${subject.kind}/${subject.name}`;
}

export function capsuleSubjectRouteIdentity(subject: CapsuleSubject): string {
  if (subject.kind === 'ServiceAccount' && subject.namespace) {
    return `system:serviceaccount:${subject.namespace}:${subject.name}`;
  }
  return subject.name;
}

export function capsuleSubjectKey(subject: CapsuleSubject): string {
  return `${subject.kind.toLowerCase()}|${subject.namespace || ''}|${subject.name}`;
}

export function capsuleSubjectsEqual(
  left: CapsuleSubject | undefined,
  right: CapsuleSubject | undefined
): boolean {
  return !!left && !!right && capsuleSubjectKey(left) === capsuleSubjectKey(right);
}

/** Every place where a Tenant refers to the selected subject. */
export function tenantSubjectMentions(tenant: any, subject: CapsuleSubject): string[] {
  const data = objectData(tenant);
  const mentions = new Set<string>();
  for (const owner of data.spec?.owners || []) {
    if (capsuleSubjectsEqual(normalizeCapsuleSubject(owner), subject)) mentions.add('Owner');
  }
  for (const owner of data.status?.owners || []) {
    if (capsuleSubjectsEqual(normalizeCapsuleSubject(owner), subject)) mentions.add('Owner');
  }
  for (const promotion of data.status?.promotions || []) {
    if (capsuleSubjectsEqual(normalizeCapsuleSubject(promotion), subject)) {
      mentions.add('Promoted identity');
    }
  }
  return [...mentions];
}

/** Status-reported Tenant promotions for one exact ServiceAccount identity. */
export function tenantPromotionsForSubject(
  tenant: any,
  subject: CapsuleSubject
): PromotedServiceAccount[] {
  if (subject.kind !== 'ServiceAccount') return [];

  return tenantPromotedServiceAccounts(tenant).filter(promotion =>
    capsuleSubjectsEqual(
      {
        kind: 'ServiceAccount',
        name: promotion.name,
        namespace: promotion.namespace,
      },
      subject
    )
  );
}

/** Whether a TenantOwner object is defined for the selected identity. */
export function tenantOwnerMentionsSubject(owner: any, subject: CapsuleSubject): boolean {
  const data = objectData(owner);
  return capsuleSubjectsEqual(
    normalizeCapsuleSubject({ kind: data.spec?.kind, name: data.spec?.name }),
    subject
  );
}

/** Whether a native RoleBinding or ClusterRoleBinding contains the subject. */
export function bindingMentionsSubject(binding: any, subject: CapsuleSubject): boolean {
  const data = objectData(binding);
  return (data.subjects || []).some((candidate: any) =>
    capsuleSubjectsEqual(normalizeCapsuleSubject(candidate), subject)
  );
}

/** Subject identities declared by a rendered RBAC-style manifest. */
export function manifestSubjects(manifest: any): CapsuleSubject[] {
  const subjects = manifest?.subjects || manifest?.spec?.subjects || [];
  const result = new Map<string, CapsuleSubject>();
  for (const candidate of subjects) {
    const subject = normalizeCapsuleSubject(candidate);
    if (subject) result.set(capsuleSubjectKey(subject), subject);
  }
  return [...result.values()];
}

/** Proxy rules in a GlobalProxySettings object that grant access to the selected subject. */
export function globalProxySettingsSubjectMentions(
  settings: any,
  subject: CapsuleSubject
): string[] {
  const data = objectData(settings);
  const mentions = new Set<string>();
  for (const [index, rule] of (data.spec?.rules || []).entries()) {
    if (
      (rule.subjects || []).some((candidate: any) =>
        capsuleSubjectsEqual(normalizeCapsuleSubject(candidate), subject)
      )
    ) {
      mentions.add(`Rule #${index + 1}`);
    }
  }
  return [...mentions];
}

/** Shared Capsule identity representation used by subject navigation. */
export interface CapsuleAccessEntity {
  groups?: string[];
  name?: string;
  type?: string;
}
