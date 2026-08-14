import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { alpha, Box, Chip, Stack, Typography } from '@mui/material';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useMemo } from 'react';
import {
  getManagedObjectReadyStatus,
  type ReplicationDependency,
} from '../../resources/tenantResources.helpers';

const SOURCE_WIDTH = 250;
const SOURCE_HEIGHT = 88;
const RESOURCE_WIDTH = 235;
const RESOURCE_HEIGHT = 78;
const RESOURCES_PER_COLUMN = 4;
const RESOURCE_START_Y = 20;
const RESOURCE_STEP_Y = 108;
const DEPENDENCY_WIDTH = 250;
const DEPENDENCY_HEIGHT = 78;
const DEPENDENCIES_PER_COLUMN = 4;
const DEPENDENCY_STEP_X = 295;
const DEPENDENCY_STEP_Y = 108;

const KIND_ICONS: Record<string, string> = {
  ConfigMap: 'mdi:file-cog',
  CronJob: 'mdi:calendar-clock',
  DaemonSet: 'mdi:server-network',
  Deployment: 'mdi:rocket-launch',
  GlobalTenantResource: 'mdi:file-document-multiple',
  Ingress: 'mdi:call-split',
  Job: 'mdi:briefcase-check',
  NetworkPolicy: 'mdi:shield-network',
  PersistentVolumeClaim: 'mdi:database',
  Pod: 'mdi:cube-outline',
  ReplicaSet: 'mdi:content-copy',
  Secret: 'mdi:key-variant',
  Service: 'mdi:lan-connect',
  StatefulSet: 'mdi:database-sync',
  TenantResource: 'mdi:file-document',
};

function objectData(object: any) {
  return object?.jsonData || object || {};
}

function objectMetadata(object: any) {
  return (
    object?.metadata ||
    object?.jsonData?.metadata || {
      name: object?.name,
      namespace: object?.namespace,
    }
  );
}

function objectKind(object: any): string {
  return object?.kind || object?.jsonData?.kind || object?.constructor?.kind || 'Resource';
}

function objectApiVersion(object: any): string {
  return object?.apiVersion || object?.jsonData?.apiVersion || 'v1';
}

export function managedResourceKey(object: any): string {
  const metadata = objectMetadata(object);
  return [
    objectApiVersion(object),
    objectKind(object),
    metadata.namespace || '-',
    metadata.name,
  ].join('/');
}

function matchingLiveObject(descriptor: any, resources: any[]) {
  const descriptorMetadata = objectMetadata(descriptor);
  return resources.find(resource => {
    const metadata = objectMetadata(resource);
    return (
      objectKind(resource) === objectKind(descriptor) &&
      metadata.name === descriptorMetadata.name &&
      (metadata.namespace || '') === (descriptorMetadata.namespace || '')
    );
  });
}

function SourceNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        width: '100%',
        height: '100%',
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        color: '#fff',
        background: 'linear-gradient(135deg, #1976d2, #0d47a1)',
        borderRadius: 2,
        boxShadow: theme.shadows[3],
      })}
    >
      {data.hasDependencies && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: 'currentColor', width: 9, height: 9 }}
        />
      )}
      <Icon icon={KIND_ICONS[data.kind] || 'mdi:file-document'} width={34} height={34} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          {data.kind}
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        {data.namespace && (
          <Typography variant="caption" noWrap sx={{ color: 'inherit', opacity: 0.8 }}>
            {data.namespace}
          </Typography>
        )}
      </Box>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', width: 9, height: 9 }}
      />
    </Box>
  );
}

function DependencyNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: `${data.color}.main`,
        borderRadius: 1.5,
        boxShadow: `0 0 0 3px ${alpha((theme.palette as any)[data.color].main, 0.08)}`,
        display: 'flex',
        gap: 1,
        height: '100%',
        px: 1.5,
        py: 1,
        width: '100%',
      })}
    >
      <Icon icon={KIND_ICONS[data.kind] || 'mdi:source-branch'} width={27} height={27} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          Depends on · {data.kind}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
          {data.name}
        </Typography>
        {data.namespace && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {data.namespace}
          </Typography>
        )}
      </Box>
      <Chip label={data.state} color={data.color} size="small" />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', width: 8, height: 8 }}
      />
    </Box>
  );
}

function ManagedObjectNode({ data }: any) {
  const statusColor =
    data.status.color === 'success'
      ? 'success'
      : data.status.color === 'error'
      ? 'error'
      : data.status.color === 'warning'
      ? 'warning'
      : 'default';

  return (
    <Box
      sx={theme => ({
        width: '100%',
        height: '100%',
        px: 1.5,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'background.paper',
        border: data.selected ? '2px solid' : '1px solid',
        borderColor: data.selected ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        boxShadow: data.selected ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}` : 1,
        cursor: 'pointer',
      })}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'currentColor', width: 8, height: 8 }}
      />
      <Icon icon={KIND_ICONS[data.kind] || 'mdi:cube-outline'} width={27} height={27} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {data.kind}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
          {data.name}
        </Typography>
        {data.namespace && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {data.namespace}
          </Typography>
        )}
      </Box>
      <Chip label={data.status.label} color={statusColor} size="small" />
    </Box>
  );
}

const nodeTypes = {
  dependency: DependencyNode,
  replicationSource: SourceNode,
  managedObject: ManagedObjectNode,
};

export interface ManagedResourceFlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/** Creates a stable left-to-right replication graph for the detail views. */
export function buildManagedResourceFlowGraph(
  item: any,
  applied: any[],
  resources: any[],
  selectedKey?: string,
  dependencies: ReplicationDependency[] = []
): ManagedResourceFlowGraph {
  const source = objectData(item);
  const sourceMetadata = objectMetadata(source);
  const targetRows = Math.min(RESOURCES_PER_COLUMN, applied.length);
  const dependencyRows = Math.min(DEPENDENCIES_PER_COLUMN, dependencies.length);
  const targetHeight = targetRows
    ? RESOURCE_HEIGHT + (targetRows - 1) * RESOURCE_STEP_Y
    : SOURCE_HEIGHT;
  const dependencyHeight = dependencyRows
    ? DEPENDENCY_HEIGHT + (dependencyRows - 1) * DEPENDENCY_STEP_Y
    : SOURCE_HEIGHT;
  const contentHeight = Math.max(SOURCE_HEIGHT, targetHeight, dependencyHeight);
  const sourceY = RESOURCE_START_Y + (contentHeight - SOURCE_HEIGHT) / 2;
  const targetStartY = RESOURCE_START_Y + (contentHeight - targetHeight) / 2;
  const dependencyStartY = RESOURCE_START_Y + (contentHeight - dependencyHeight) / 2;
  const dependencyColumns = Math.ceil(dependencies.length / DEPENDENCIES_PER_COLUMN);
  const sourceX = dependencies.length > 0 ? 24 + dependencyColumns * DEPENDENCY_STEP_X + 55 : 24;
  const targetX = sourceX + 356;
  const sourceId = 'capsule-replication-source';
  const nodes: Node[] = [
    {
      id: sourceId,
      type: 'replicationSource',
      position: { x: sourceX, y: sourceY },
      data: {
        kind: objectKind(source),
        hasDependencies: dependencies.length > 0,
        name: sourceMetadata.name || 'Replication source',
        namespace: sourceMetadata.namespace,
      },
      style: { width: SOURCE_WIDTH, height: SOURCE_HEIGHT },
      draggable: false,
      selectable: false,
    },
  ];
  const edges: Edge[] = [];

  dependencies.forEach((dependency, index) => {
    const column = Math.floor(index / DEPENDENCIES_PER_COLUMN);
    const row = index % DEPENDENCIES_PER_COLUMN;
    const id = `dependency-${index}-${dependency.namespace || 'cluster'}-${dependency.name}`;

    nodes.push({
      id,
      type: 'dependency',
      position: {
        x: 24 + column * DEPENDENCY_STEP_X,
        y: dependencyStartY + row * DEPENDENCY_STEP_Y,
      },
      data: {
        ...dependency,
      },
      style: { width: DEPENDENCY_WIDTH, height: DEPENDENCY_HEIGHT },
      draggable: false,
      selectable: false,
      ariaLabel: `${dependency.kind} dependency ${dependency.name}, ${dependency.state}`,
    });
    edges.push({
      id: `dependency-flow-${index}`,
      source: id,
      target: sourceId,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke:
          dependency.color === 'success'
            ? '#2e7d32'
            : dependency.color === 'error'
            ? '#d32f2f'
            : '#ed6c02',
        strokeWidth: 1.75,
      },
    });
  });

  applied.forEach((descriptor, index) => {
    const metadata = objectMetadata(descriptor);
    const column = Math.floor(index / RESOURCES_PER_COLUMN);
    const row = index % RESOURCES_PER_COLUMN;
    const key = managedResourceKey(descriptor);
    const id = `managed-${index}-${key}`;
    const liveObject = matchingLiveObject(descriptor, resources);
    const status = getManagedObjectReadyStatus(liveObject || descriptor, applied);

    nodes.push({
      id,
      type: 'managedObject',
      position: { x: targetX + column * 295, y: targetStartY + row * RESOURCE_STEP_Y },
      data: {
        descriptor,
        liveObject,
        key,
        kind: objectKind(descriptor),
        name: metadata.name,
        namespace: metadata.namespace,
        selected: selectedKey === key,
        status,
      },
      style: { width: RESOURCE_WIDTH, height: RESOURCE_HEIGHT },
      draggable: false,
      selectable: true,
      ariaLabel: `${objectKind(descriptor)} ${metadata.namespace ? `${metadata.namespace}/` : ''}${
        metadata.name
      }, click to inspect SSA diff`,
    });
    edges.push({
      id: `replication-${index}`,
      source: sourceId,
      target: id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: selectedKey === key ? 2.5 : 1.75 },
    });
  });

  return { nodes, edges };
}

export function ManagedResourceFlow({
  item,
  applied,
  resources,
  selectedKey,
  dependencies = [],
  onSelect,
}: {
  item: any;
  applied: any[];
  resources: any[];
  selectedKey?: string;
  dependencies?: ReplicationDependency[];
  onSelect: (descriptor: any) => void;
}) {
  const graph = useMemo(
    () => buildManagedResourceFlowGraph(item, applied, resources, selectedKey, dependencies),
    [item, applied, resources, selectedKey, dependencies]
  );
  const height = Math.min(
    590,
    Math.max(
      330,
      Math.max(Math.min(applied.length, 4), Math.min(dependencies.length, 4)) * 108 + 58
    )
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Replication flow
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a managed resource to inspect its server-side apply diff.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75}>
          {dependencies.length > 0 && (
            <Chip size="small" color="primary" label={`${dependencies.length} dependencies`} />
          )}
          <Chip size="small" label={`${applied.length} managed`} />
        </Stack>
      </Stack>
      <Box
        sx={{
          height,
          minHeight: 330,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.default',
        }}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={1.4}
            onNodeClick={(_event, node) => {
              if (node.type === 'managedObject') onSelect(node.data.descriptor);
            }}
          >
            <Background variant={BackgroundVariant.Dots} size={2} />
            <Controls showInteractive={false} />
            {(applied.length > RESOURCES_PER_COLUMN ||
              dependencies.length > DEPENDENCIES_PER_COLUMN) && <MiniMap pannable zoomable />}
          </ReactFlow>
        </ReactFlowProvider>
      </Box>
    </Stack>
  );
}

export default ManagedResourceFlow;
