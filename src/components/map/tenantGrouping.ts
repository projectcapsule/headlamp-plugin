import { getTenantSpaceNames } from '../../utils/tenantSpaces';
import type { MapGroupNode, MapResourceNode, MapTreeNode } from './mapTypes';

export const TENANT_NAMESPACE_LABEL = 'capsule.clastix.io/tenant';

export type CapsuleGroupBy = 'tenant' | 'namespace' | 'instance' | 'node';

function tenantName(tenant: any): string | undefined {
  return tenant?.metadata?.name || tenant?.getName?.();
}

function objectMetadata(object: any) {
  return object?.metadata || object?.jsonData?.metadata || {};
}

export function getTenantNamespaceNames(tenant: any): string[] {
  const names = new Set(getTenantSpaceNames(tenant));
  const statusNamespaces = tenant?.status?.namespaces ?? tenant?.jsonData?.status?.namespaces;

  if (Array.isArray(statusNamespaces)) {
    statusNamespaces.forEach(namespace => {
      const name = typeof namespace === 'string' ? namespace : namespace?.name;
      if (name) names.add(name);
    });
  }

  return [...names];
}

/** Resolves namespace ownership with live Namespace labels taking precedence. */
export function buildTenantNamespaceIndex(namespaces: any[], tenants: any[]): Map<string, string> {
  const tenantByNamespace = new Map<string, string>();

  tenants.forEach(tenant => {
    const name = tenantName(tenant);
    if (!name) return;
    getTenantNamespaceNames(tenant).forEach(namespace => {
      if (!tenantByNamespace.has(namespace)) tenantByNamespace.set(namespace, name);
    });
  });

  namespaces.forEach(namespace => {
    const metadata = objectMetadata(namespace);
    const name = metadata.name || namespace?.getName?.();
    const owner = metadata.labels?.[TENANT_NAMESPACE_LABEL];
    if (name && owner) tenantByNamespace.set(name, owner);
  });

  return tenantByNamespace;
}

function namespaceGroups(nodes: MapResourceNode[], namespaces: any[]): MapGroupNode[] {
  const namespaceObjects = new Map(
    namespaces.map(namespace => [objectMetadata(namespace).name, namespace] as const)
  );
  const grouped = new Map<string, MapResourceNode[]>();

  nodes.forEach(node => {
    const namespace = objectMetadata(node.kubeObject).namespace;
    if (!namespace) return;
    const entries = grouped.get(namespace) || [];
    entries.push(node);
    grouped.set(namespace, entries);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespace, entries]) => ({
      id: `capsule-namespace-group-${namespace}`,
      label: namespace,
      subtitle: 'Namespace',
      kubeObject: namespaceObjects.get(namespace),
      nodes: entries,
    }));
}

/** Creates Tenant boundaries containing Namespace grids. */
export function groupResourcesByTenant(
  nodes: MapResourceNode[],
  namespaces: any[],
  tenants: any[]
): MapTreeNode[] {
  const owners = buildTenantNamespaceIndex(namespaces, tenants);
  const tenantsByName = new Map(
    tenants
      .map(tenant => [tenantName(tenant), tenant] as const)
      .filter((entry): entry is [string, any] => Boolean(entry[0]))
  );
  const namespaced = nodes.filter(node => objectMetadata(node.kubeObject).namespace);
  const clusterScoped = nodes.filter(node => !objectMetadata(node.kubeObject).namespace);
  const groupsByTenant = new Map<string, MapGroupNode[]>();
  const unmanaged: MapGroupNode[] = [];

  namespaceGroups(namespaced, namespaces).forEach(group => {
    const owner = owners.get(group.label);
    if (!owner) {
      unmanaged.push(group);
      return;
    }
    const groups = groupsByTenant.get(owner) || [];
    groups.push(group);
    groupsByTenant.set(owner, groups);
  });

  const tenantGroups: MapGroupNode[] = [...groupsByTenant.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, groups]) => ({
      id: `capsule-tenant-group-${objectMetadata(tenantsByName.get(name)).uid || name}`,
      label: name,
      subtitle: 'Tenant',
      kubeObject: tenantsByName.get(name),
      nodes: groups,
    }));

  const result: MapTreeNode[] = [...tenantGroups, ...unmanaged];
  if (clusterScoped.length > 0) {
    result.push({
      id: 'capsule-cluster-scoped-resources',
      label: 'Cluster scoped',
      subtitle: 'Resources',
      nodes: clusterScoped,
    });
  }

  return result;
}

export function groupResources(
  nodes: MapResourceNode[],
  groupBy: CapsuleGroupBy | undefined,
  namespaces: any[],
  tenants: any[]
): MapTreeNode[] {
  if (groupBy === 'tenant') return groupResourcesByTenant(nodes, namespaces, tenants);
  if (groupBy === 'namespace') {
    const grouped: MapTreeNode[] = namespaceGroups(nodes, namespaces);
    const clusterScoped = nodes.filter(node => !objectMetadata(node.kubeObject).namespace);
    if (clusterScoped.length > 0) {
      grouped.push({
        id: 'capsule-cluster-scoped-resources',
        label: 'Cluster scoped',
        subtitle: 'Resources',
        nodes: clusterScoped,
      });
    }
    return grouped;
  }

  if (groupBy === 'instance' || groupBy === 'node') {
    const grouped = new Map<string, MapResourceNode[]>();
    const ungrouped: MapResourceNode[] = [];
    nodes.forEach(node => {
      const object = node.kubeObject;
      const metadata = objectMetadata(object);
      const key =
        groupBy === 'instance'
          ? metadata.labels?.['app.kubernetes.io/instance']
          : object?.spec?.nodeName || object?.jsonData?.spec?.nodeName;
      if (!key) {
        ungrouped.push(node);
        return;
      }
      const entries = grouped.get(key) || [];
      entries.push(node);
      grouped.set(key, entries);
    });

    return [
      ...[...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, entries]) => ({
          id: `capsule-${groupBy}-group-${label}`,
          label,
          subtitle: groupBy === 'instance' ? ('Instance' as const) : ('Node' as const),
          nodes: entries,
        })),
      ...ungrouped,
    ];
  }

  return nodes;
}
