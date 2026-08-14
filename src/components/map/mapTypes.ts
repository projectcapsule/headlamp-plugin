export interface MapResourceNode {
  id: string;
  kubeObject: any;
  sourceId: string;
}

export interface MapGroupNode {
  id: string;
  label: string;
  subtitle: 'Tenant' | 'Namespace' | 'Instance' | 'Node' | 'Resources';
  nodes: MapTreeNode[];
  kubeObject?: any;
}

export type MapTreeNode = MapResourceNode | MapGroupNode;

export interface MapSourceDefinition {
  id: string;
  label: string;
  category: 'Workloads' | 'Storage' | 'Network' | 'Security' | 'Configuration' | 'Tenant';
  icon: string;
  enabledByDefault: boolean;
  items: any[] | null;
}

export function isMapGroup(node: MapTreeNode): node is MapGroupNode {
  return 'nodes' in node;
}

export function objectId(object: any): string {
  const metadata = object?.metadata || object?.jsonData?.metadata || {};
  const kind = object?.kind || object?.jsonData?.kind || object?.constructor?.kind || 'Resource';
  return metadata.uid || `${kind}/${metadata.namespace || '-'}/${metadata.name || 'unknown'}`;
}
