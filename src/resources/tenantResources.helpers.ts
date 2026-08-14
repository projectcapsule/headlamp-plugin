export function getSpecResourcesCount(item: any): number {
  const r = item?.spec?.resources ?? item?.jsonData?.spec?.resources;
  return Array.isArray(r) ? r.length : 0;
}

export function getAppliedCount(item: any): number {
  if (!item) return 0;
  const j = item.jsonData || item;
  const size = j?.status?.size ?? item?.status?.size;
  if (typeof size === 'number') return size;
  const processed = j?.status?.processedItems ?? item?.status?.processedItems;
  if (Array.isArray(processed) && processed.length > 0) return processed.length;
  const old = j?.status?.resources ?? item?.status?.resources;
  return Array.isArray(old) ? old.length : 0;
}

export function getAppliedObjectsForTable(item: any): any[] {
  if (!item) return [];
  const j = item.jsonData || item;
  const status = j?.status || item?.status || {};
  const processed = status.processedItems || [];
  if (Array.isArray(processed) && processed.length > 0) {
    return processed.map((p: any) => ({
      apiVersion: p.version ? (p.group ? `${p.group}/${p.version}` : p.version) : 'v1',
      kind: p.kind || 'Unknown',
      name: p.name,
      namespace: p.namespace,
      lastUpdateTime: p.status?.lastApply,
      _processedItem: p,
    }));
  }
  return status.resources || [];
}

export function isResourceReady(item: any): boolean {
  if (!item) return false;
  const j = item.jsonData || item;
  const conditions: any[] = j?.status?.conditions || item?.status?.conditions || [];
  return conditions.some(
    (c: any) => c && c.type === 'Ready' && (c.status === 'True' || c.status === true)
  );
}

/** Returns a condition from either a KubeObject wrapper or a plain API object. */
export function getResourceCondition(item: any, type: string): any | undefined {
  const data = item?.jsonData || item || {};
  const conditions = data.status?.conditions || item?.status?.conditions || [];
  return conditions.find((condition: any) => condition?.type === type);
}

export type ReplicationDependencyState = 'Missing' | 'Not Ready' | 'Ready' | 'Unknown';

export interface ReplicationDependency {
  color: 'error' | 'success' | 'warning';
  kind: 'GlobalTenantResource' | 'TenantResource';
  message: string;
  name: string;
  namespace?: string;
  resource?: any;
  state: ReplicationDependencyState;
}

function replicationKind(item: any): string {
  return item?.kind || item?.jsonData?.kind || item?.constructor?.kind || '';
}

function replicationMetadata(item: any): any {
  return item?.metadata || item?.jsonData?.metadata || {};
}

/** Resolves spec.dependsOn in declaration order and reports each dependency's live Ready state. */
export function getReplicationDependencies(
  item: any,
  candidates: any[] = []
): ReplicationDependency[] {
  const json = item?.jsonData || item || {};
  const kind = replicationKind(item);
  if (kind !== 'TenantResource' && kind !== 'GlobalTenantResource') return [];

  const namespace = replicationMetadata(item).namespace;
  const dependsOn = Array.isArray(json.spec?.dependsOn) ? json.spec.dependsOn : [];
  return dependsOn
    .filter((reference: any) => typeof reference?.name === 'string' && reference.name.length > 0)
    .map((reference: any) => {
      const resource = candidates.find((candidate: any) => {
        const metadata = replicationMetadata(candidate);
        return (
          replicationKind(candidate) === kind &&
          metadata.name === reference.name &&
          (kind === 'GlobalTenantResource' || metadata.namespace === namespace)
        );
      });

      if (!resource) {
        return {
          color: 'error' as const,
          kind,
          message: 'Dependency not found',
          name: reference.name,
          namespace: kind === 'TenantResource' ? namespace : undefined,
          state: 'Missing' as const,
        };
      }

      const condition = getResourceCondition(resource, 'Ready');
      const status = String(condition?.status ?? '').toLowerCase();
      if (status === 'true') {
        return {
          color: 'success' as const,
          kind,
          message: condition?.message || condition?.reason || 'Dependency is ready',
          name: reference.name,
          namespace: kind === 'TenantResource' ? namespace : undefined,
          resource,
          state: 'Ready' as const,
        };
      }
      if (status === 'false') {
        return {
          color: 'error' as const,
          kind,
          message: condition?.message || condition?.reason || 'Dependency is not ready',
          name: reference.name,
          namespace: kind === 'TenantResource' ? namespace : undefined,
          resource,
          state: 'Not Ready' as const,
        };
      }

      return {
        color: 'warning' as const,
        kind,
        message: condition?.message || condition?.reason || 'Ready state has not been reported',
        name: reference.name,
        namespace: kind === 'TenantResource' ? namespace : undefined,
        resource,
        state: 'Unknown' as const,
      };
    });
}

export function hasReadyConditionTrue(obj: any): boolean {
  if (!obj) return false;
  const status = obj?.jsonData?.status || obj?.status;
  if (!status) return false;
  const conditions: any[] = status.conditions || [];
  return conditions.some(
    (c: any) => c && c.type === 'Ready' && (c.status === 'True' || c.status === true)
  );
}

function findAppliedDescriptor(liveObj: any, appliedDescriptors: any[]): any | undefined {
  const liveData = liveObj?.jsonData || liveObj || {};
  const liveMetadata = liveObj?.metadata || liveData.metadata || {};
  const liveApiVersion = liveObj?.apiVersion || liveData.apiVersion || '';
  const liveKind = liveObj?.kind || liveData.kind || '';

  return (appliedDescriptors || []).find((descriptor: any) => {
    const descriptorData = descriptor?.jsonData || descriptor || {};
    const descriptorMetadata = descriptor?.metadata || descriptorData.metadata || descriptorData;
    const descriptorApiVersion = descriptor?.apiVersion || descriptorData.apiVersion || '';
    const descriptorKind = descriptor?.kind || descriptorData.kind || '';
    const sameIdentity =
      (descriptorMetadata.name || descriptor?.name || '') === (liveMetadata.name || '') &&
      (descriptorMetadata.namespace || descriptor?.namespace || '') ===
        (liveMetadata.namespace || '') &&
      descriptorKind === liveKind;

    return (
      sameIdentity &&
      (!descriptorApiVersion || !liveApiVersion || descriptorApiVersion === liveApiVersion)
    );
  });
}

/** Returns the most useful reconciliation message for a managed object. */
export function getManagedObjectStatusMessage(
  liveObj: any,
  appliedDescriptors: any[]
): string | undefined {
  const liveStatus = liveObj?.jsonData?.status || liveObj?.status || {};
  const readyCondition = (liveStatus.conditions || []).find(
    (condition: any) => condition?.type === 'Ready'
  );
  const descriptor = findAppliedDescriptor(liveObj, appliedDescriptors);
  const processedStatus = descriptor?._processedItem?.status;
  const processedMessage =
    processedStatus && typeof processedStatus === 'object' ? processedStatus.message : undefined;

  if (readyCondition && readyCondition.status !== 'True' && readyCondition.status !== true) {
    return readyCondition.message || processedMessage || readyCondition.reason || undefined;
  }

  return (
    processedMessage ||
    readyCondition?.message ||
    descriptor?.message ||
    descriptor?.status?.message ||
    undefined
  );
}

export function getDefinedReplicationEntries(rules: any[]): any[] {
  const entries: any[] = [];
  (rules || []).forEach((rule: any, ruleIdx: number) => {
    if (!rule) return;

    if (rule.kind || rule.apiVersion) {
      entries.push({
        apiVersion: rule.apiVersion,
        kind: rule.kind,
        name: rule.name,
        namespace: rule.namespace,
        labelSelector: rule.labelSelector,
        fieldSelector: rule.fieldSelector,
        syncOptions: rule.syncOptions,
        _type: 'legacy',
        _ruleIdx: ruleIdx,
      });
    }

    (rule.namespacedItems || []).forEach((it: any) => {
      entries.push({
        ...it,
        _type: 'namespacedItem',
        _ruleIdx: ruleIdx,
      });
    });

    (rule.rawItems || []).forEach((raw: any, i: number) => {
      entries.push({
        apiVersion: raw?.apiVersion || '',
        kind: raw?.kind || raw?.metadata?.kind || 'Raw',
        name: raw?.metadata?.name || raw?.name || `raw-${i}`,
        namespace: raw?.metadata?.namespace || raw?.namespace || '',
        _type: 'rawItem',
        _ruleIdx: ruleIdx,
        _raw: raw,
      });
    });

    const genCount = (rule.generators || []).length;
    if (genCount > 0) {
      entries.push({
        kind: 'Generator',
        name: `${genCount} template(s)`,
        _type: 'generator',
        _ruleIdx: ruleIdx,
      });
    }

    const hasConcrete =
      !!(rule.kind || rule.apiVersion) ||
      (rule.namespacedItems?.length || 0) + (rule.rawItems?.length || 0) + genCount > 0;
    if (!hasConcrete) {
      entries.push({
        kind: 'Rule',
        name: rule.namespaceSelector ? 'by namespaceSelector' : `rule#${ruleIdx}`,
        _type: 'rule',
        _ruleIdx: ruleIdx,
        _rule: rule,
      });
    }
  });
  return entries;
}

export function getPlural(kind: string): string {
  const k = (kind || '').toLowerCase();
  const map: Record<string, string> = {
    endpoints: 'endpoints',
    ingress: 'ingresses',
    networkpolicy: 'networkpolicies',
    podsecuritypolicy: 'podsecuritypolicies',
    priorityclass: 'priorityclasses',
    storageclass: 'storageclasses',
    customresourcedefinition: 'customresourcedefinitions',
  };
  if (map[k]) return map[k];
  if (k.endsWith('s')) return k;
  if (k.endsWith('y')) return `${k.slice(0, -1)}ies`;
  return `${k}s`;
}

/**
 * Determines the effective Ready status for a live managed object (replicated resource).
 * - Prefers hasReadyConditionTrue on the live object.
 * - If the object has a Ready condition that is not True → "False".
 * - Otherwise (no Ready condition on the actual resource), looks up the matching
 *   entry in the applied descriptors (from the TenantResource's .status.processedItems)
 *   by name+namespace+kind+apiVersion ("the id itself"), and returns its .status.status
 *   (or .status) if present.
 * - Returns { label, color } suitable for Chip or counting.
 */
export function getManagedObjectReadyStatus(
  liveObj: any,
  appliedDescriptors: any[]
): { label: string; color: 'success' | 'error' | 'default' | 'warning' } {
  if (hasReadyConditionTrue(liveObj)) {
    return { label: 'True', color: 'success' };
  }

  const status = liveObj?.jsonData?.status || (liveObj as any)?.status;
  if (status && Array.isArray(status.conditions)) {
    const hasReadyCond = status.conditions.some((c: any) => c && c.type === 'Ready');
    if (hasReadyCond) {
      return { label: 'False', color: 'error' };
    }
  }

  const desc = findAppliedDescriptor(liveObj, appliedDescriptors);

  const p = desc?._processedItem;
  const pStatus = p?.status?.status || p?.status;
  if (pStatus !== null && pStatus !== undefined) {
    const label = String(pStatus);
    const lower = label.toLowerCase().trim();
    let color: 'success' | 'error' | 'default' | 'warning' = 'default';
    if (['true', 'success', 'applied', 'ready', 'succeeded'].some(s => lower.includes(s))) {
      color = 'success';
    } else if (['false', 'error', 'failed', 'fail'].some(s => lower.includes(s))) {
      color = 'error';
    }
    return { label, color };
  }

  return { label: 'Unknown', color: 'default' };
}
