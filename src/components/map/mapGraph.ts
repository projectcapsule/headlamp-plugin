import type { Edge, Node } from '@xyflow/react';
import type { MapResourceNode, MapTreeNode } from './mapTypes';
import { isMapGroup } from './mapTypes';

const RESOURCE_WIDTH = 210;
const RESOURCE_HEIGHT = 70;
const GROUP_HEADER = 46;
const GROUP_PADDING = 18;
const GAP = 22;

interface MeasuredTree {
  entry: MapTreeNode;
  width: number;
  height: number;
  children?: MeasuredTree[];
}

interface PositionedTree extends MeasuredTree {
  x: number;
  y: number;
  children?: PositionedTree[];
}

function measure(entry: MapTreeNode): MeasuredTree {
  if (!isMapGroup(entry)) {
    return { entry, width: RESOURCE_WIDTH, height: RESOURCE_HEIGHT };
  }

  const children = entry.nodes.map(measure);
  if (children.length === 0) {
    return { entry, width: RESOURCE_WIDTH + GROUP_PADDING * 2, height: 120, children };
  }

  const columns = Math.min(entry.subtitle === 'Tenant' ? 2 : 3, children.length);
  const rows = Math.ceil(children.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  children.forEach((child, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], child.width);
    rowHeights[row] = Math.max(rowHeights[row], child.height);
  });

  return {
    entry,
    width:
      columnWidths.reduce((total, width) => total + width, 0) +
      GAP * Math.max(0, columns - 1) +
      GROUP_PADDING * 2,
    height:
      rowHeights.reduce((total, height) => total + height, 0) +
      GAP * Math.max(0, rows - 1) +
      GROUP_HEADER +
      GROUP_PADDING,
    children,
  };
}

function positionChildren(tree: MeasuredTree): PositionedTree {
  if (!tree.children || !isMapGroup(tree.entry)) {
    return {
      entry: tree.entry,
      width: tree.width,
      height: tree.height,
      x: 0,
      y: 0,
    };
  }

  const columns = Math.min(tree.entry.subtitle === 'Tenant' ? 2 : 3, tree.children.length || 1);
  const rows = Math.ceil(tree.children.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  tree.children.forEach((child, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], child.width);
    rowHeights[row] = Math.max(rowHeights[row], child.height);
  });

  const columnOffsets = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((total, width) => total + width, 0)
  );
  const rowOffsets = rowHeights.map((_, index) =>
    rowHeights.slice(0, index).reduce((total, height) => total + height, 0)
  );

  const children = tree.children.map((child, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const positioned = positionChildren(child);
    return {
      ...positioned,
      x: GROUP_PADDING + columnOffsets[column] + column * GAP,
      y: GROUP_HEADER + rowOffsets[row] + row * GAP,
    };
  });

  return { ...tree, x: 0, y: 0, children };
}

function flatten(tree: PositionedTree, parentId: string | undefined, output: Node[]) {
  const group = isMapGroup(tree.entry);
  output.push({
    id: tree.entry.id,
    type: group ? 'capsuleGroup' : 'capsuleResource',
    data: group ? { group: tree.entry } : { resource: tree.entry },
    position: { x: tree.x, y: tree.y },
    parentId,
    extent: parentId ? 'parent' : undefined,
    draggable: false,
    selectable: !group,
    style: { width: tree.width, height: tree.height },
    width: tree.width,
    height: tree.height,
  });

  tree.children?.forEach(child => flatten(child, tree.entry.id, output));
}

/** Produces deterministic compound-node positions for Tenant/Namespace grids. */
export function layoutMapTree(entries: MapTreeNode[]): Node[] {
  const measured = entries.map(entry => positionChildren(measure(entry)));
  const topColumns = Math.min(2, measured.length || 1);
  const columnWidths = Array.from({ length: topColumns }, () => 0);
  const rowHeights = Array.from({ length: Math.ceil(measured.length / topColumns) }, () => 0);

  measured.forEach((entry, index) => {
    const column = index % topColumns;
    const row = Math.floor(index / topColumns);
    columnWidths[column] = Math.max(columnWidths[column], entry.width);
    rowHeights[row] = Math.max(rowHeights[row], entry.height);
  });

  const output: Node[] = [];
  measured.forEach((entry, index) => {
    const column = index % topColumns;
    const row = Math.floor(index / topColumns);
    const x =
      columnWidths.slice(0, column).reduce((total, width) => total + width, 0) + column * 42;
    const y = rowHeights.slice(0, row).reduce((total, height) => total + height, 0) + row * 42;
    flatten({ ...entry, x, y }, undefined, output);
  });

  return output;
}

function metadata(object: any) {
  return object?.metadata || object?.jsonData?.metadata || {};
}

function spec(object: any) {
  return object?.spec || object?.jsonData?.spec || {};
}

function kind(object: any): string {
  return object?.kind || object?.jsonData?.kind || object?.constructor?.kind || '';
}

function labelsMatch(selector: Record<string, string> | undefined, labels: Record<string, string>) {
  return !!selector && Object.entries(selector).every(([key, value]) => labels[key] === value);
}

/** Builds the most useful native Kubernetes relationships without private Headlamp modules. */
export function buildMapEdges(nodes: MapResourceNode[]): Edge[] {
  const objectsByUid = new Map(nodes.map(node => [metadata(node.kubeObject).uid, node] as const));
  const edges = new Map<string, Edge>();
  const addEdge = (source: string, target: string) => {
    if (!source || !target || source === target) return;
    const id = `${source}-${target}`;
    edges.set(id, {
      id,
      source,
      target,
      animated: false,
      type: 'smoothstep',
      style: { strokeWidth: 1.5 },
    });
  };

  nodes.forEach(node => {
    (metadata(node.kubeObject).ownerReferences || []).forEach((owner: any) => {
      const ownerNode = objectsByUid.get(owner.uid);
      if (ownerNode) addEdge(ownerNode.id, node.id);
    });
  });

  const pods = nodes.filter(node => kind(node.kubeObject) === 'Pod');
  const services = nodes.filter(node => kind(node.kubeObject) === 'Service');
  services.forEach(service => {
    const serviceMetadata = metadata(service.kubeObject);
    pods.forEach(pod => {
      const podMetadata = metadata(pod.kubeObject);
      if (
        serviceMetadata.namespace === podMetadata.namespace &&
        labelsMatch(spec(service.kubeObject).selector, podMetadata.labels || {})
      ) {
        addEdge(service.id, pod.id);
      }
    });
  });

  const byKindNamespaceName = new Map(
    nodes.map(node => [
      `${kind(node.kubeObject)}/${metadata(node.kubeObject).namespace || '-'}/${
        metadata(node.kubeObject).name
      }`,
      node,
    ])
  );
  nodes.forEach(node => {
    const objectKind = kind(node.kubeObject);
    const objectMetadata = metadata(node.kubeObject);
    const objectSpec = spec(node.kubeObject);
    if (objectKind === 'Ingress') {
      const backends = [
        objectSpec.defaultBackend,
        ...(objectSpec.rules || []).flatMap((rule: any) =>
          (rule.http?.paths || []).map((path: any) => path.backend)
        ),
      ];
      backends.forEach((backend: any) => {
        const serviceName = backend?.service?.name || backend?.serviceName;
        const service = byKindNamespaceName.get(
          `Service/${objectMetadata.namespace || '-'}/${serviceName}`
        );
        if (service) addEdge(node.id, service.id);
      });
    }
    if (objectKind === 'HorizontalPodAutoscaler') {
      const target = objectSpec.scaleTargetRef;
      const targetNode = byKindNamespaceName.get(
        `${target?.kind}/${objectMetadata.namespace || '-'}/${target?.name}`
      );
      if (targetNode) addEdge(node.id, targetNode.id);
    }
  });

  return [...edges.values()];
}
