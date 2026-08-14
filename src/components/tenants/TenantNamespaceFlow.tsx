import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { alpha, Box, Chip, Typography } from '@mui/material';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useMemo } from 'react';
import { findSpaceInfo, isSpaceReady } from '../../utils/tenantSpaces';

const TARGETS_PER_COLUMN = 4;
const SOURCE_HEIGHT = 88;
const OWNER_HEIGHT = 82;
const OWNER_STEP_Y = 104;
const OWNER_WIDTH = 255;
const NAMESPACE_HEIGHT = 76;
const NAMESPACE_STEP_Y = 106;
const LAYOUT_START_Y = 18;

function tenantData(tenant: any) {
  return tenant?.jsonData || tenant || {};
}

export interface TenantStatusOwner {
  clusterRoles: string[];
  kind: string;
  name: string;
}

/** The controller-resolved status is authoritative for the relationship graph. */
export function tenantStatusOwners(tenant: any): TenantStatusOwner[] {
  const owners = tenantData(tenant)?.status?.owners;
  if (!Array.isArray(owners)) return [];
  const resolved = new Map<string, TenantStatusOwner>();
  owners.forEach((owner: any) => {
    if (!owner?.name) return;
    const kind = owner.kind || 'User';
    resolved.set(`${kind}/${owner.name}`, {
      clusterRoles: [...new Set<string>(owner.clusterRoles || [])].sort((left, right) =>
        left.localeCompare(right)
      ),
      kind,
      name: owner.name,
    });
  });
  return [...resolved.values()].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
}

function OwnerNode({ data }: any) {
  const isGroup = String(data.kind).toLowerCase() === 'group';
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'primary.main',
        borderRadius: 1.5,
        boxShadow: theme.shadows[1],
        display: 'flex',
        gap: 1,
        height: '100%',
        px: 1.5,
        py: 1,
        width: '100%',
      })}
    >
      <Icon icon={isGroup ? 'mdi:account-multiple' : 'mdi:account'} width={28} height={28} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {data.kind} owner
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        {data.clusterRoles.length > 0 && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {data.clusterRoles.join(', ')}
          </Typography>
        )}
      </Box>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#1976d2', height: 8, width: 8 }}
      />
    </Box>
  );
}

function TenantNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1976d2, #0d47a1)',
        borderRadius: 2,
        boxShadow: theme.shadows[3],
        color: '#fff',
        display: 'flex',
        gap: 1.25,
        height: '100%',
        px: 2,
        py: 1.25,
        width: '100%',
      })}
    >
      {data.hasOwners && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: 'currentColor', height: 9, width: 9 }}
        />
      )}
      <Icon icon="mdi:account-group" width={34} height={34} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          Tenant
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={data.cordoned ? 'Cordoned' : 'Active'}
        color={data.cordoned ? 'warning' : 'success'}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function NamespaceNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: data.cordoned ? 'warning.main' : 'divider',
        borderRadius: 1.5,
        boxShadow: data.cordoned ? `0 0 0 3px ${alpha(theme.palette.warning.main, 0.1)}` : 1,
        display: 'flex',
        gap: 1,
        height: '100%',
        px: 1.5,
        py: 1,
        width: '100%',
      })}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'currentColor', height: 8, width: 8 }}
      />
      <Icon icon="mdi:kubernetes" width={27} height={27} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Namespace
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
          {data.name}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={data.cordoned ? 'Cordoned' : data.ready ? 'Ready' : 'Not Ready'}
        color={data.cordoned ? 'warning' : data.ready ? 'success' : 'error'}
      />
    </Box>
  );
}

const nodeTypes = {
  owner: OwnerNode,
  tenant: TenantNode,
  namespace: NamespaceNode,
};

export function buildTenantNamespaceFlowGraph(tenant: any, namespaces: any[]) {
  const json = tenantData(tenant);
  const tenantName = json?.metadata?.name || tenant?.getName?.() || 'Tenant';
  const owners = tenantStatusOwners(tenant);
  const namespaceRows = Math.min(TARGETS_PER_COLUMN, Math.max(namespaces.length, 1));
  const ownerRows = Math.min(TARGETS_PER_COLUMN, Math.max(owners.length, 1));
  const namespaceBounds = (namespaceRows - 1) * NAMESPACE_STEP_Y + NAMESPACE_HEIGHT;
  const ownerBounds = owners.length > 0 ? (ownerRows - 1) * OWNER_STEP_Y + OWNER_HEIGHT : 0;
  const layoutBounds = Math.max(namespaceBounds, ownerBounds, SOURCE_HEIGHT);
  const layoutCenter = LAYOUT_START_Y + layoutBounds / 2;
  const sourceY = layoutCenter - SOURCE_HEIGHT / 2;
  const namespaceStartY = layoutCenter - namespaceBounds / 2;
  const ownerColumns = owners.length > 0 ? Math.ceil(owners.length / TARGETS_PER_COLUMN) : 0;
  const tenantX = owners.length > 0 ? 74 + ownerColumns * 285 : 24;
  const namespaceStartX = tenantX + 356;
  const sourceId = 'capsule-tenant-source';
  const nodes: Node[] = [
    {
      id: sourceId,
      type: 'tenant',
      position: { x: tenantX, y: sourceY },
      data: { name: tenantName, cordoned: !!json?.spec?.cordoned, hasOwners: owners.length > 0 },
      draggable: false,
      selectable: false,
      style: { height: SOURCE_HEIGHT, width: 250 },
    },
  ];
  const edges: Edge[] = [];

  owners.forEach((owner, index) => {
    const column = Math.floor(index / TARGETS_PER_COLUMN);
    const row = index % TARGETS_PER_COLUMN;
    const columnCount = Math.min(TARGETS_PER_COLUMN, owners.length - column * TARGETS_PER_COLUMN);
    const columnBounds = (columnCount - 1) * OWNER_STEP_Y + OWNER_HEIGHT;
    const id = `tenant-owner-${owner.kind}-${owner.name}`;
    nodes.push({
      id,
      type: 'owner',
      position: {
        x: 24 + column * 285,
        y: layoutCenter - columnBounds / 2 + row * OWNER_STEP_Y,
      },
      data: { ...owner },
      draggable: false,
      selectable: false,
      style: { height: OWNER_HEIGHT, width: OWNER_WIDTH },
    });
    edges.push({
      id: `${id}-${sourceId}`,
      source: id,
      target: sourceId,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#1976d2' },
      style: { stroke: '#1976d2', strokeWidth: 1.75 },
    });
  });

  namespaces.forEach((namespace, index) => {
    const name =
      namespace?.getName?.() || namespace?.metadata?.name || namespace?.jsonData?.metadata?.name;
    const column = Math.floor(index / TARGETS_PER_COLUMN);
    const row = index % TARGETS_PER_COLUMN;
    const space = findSpaceInfo(tenant, name);
    const cordoned = !!space?.conditions?.find(
      (condition: any) => condition.type === 'Cordoned' && String(condition.status) === 'True'
    );
    const ready = space?.conditions?.length
      ? isSpaceReady(space)
      : String(namespace?.jsonData?.status?.phase || 'Active') === 'Active';
    const id = `namespace-${name}`;

    nodes.push({
      id,
      type: 'namespace',
      position: {
        x: namespaceStartX + column * 295,
        y: namespaceStartY + row * NAMESPACE_STEP_Y,
      },
      data: { name, ready, cordoned },
      draggable: false,
      selectable: false,
      style: { height: NAMESPACE_HEIGHT, width: 235 },
    });
    edges.push({
      id: `tenant-namespace-${name}`,
      source: sourceId,
      target: id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.75 },
    });
  });

  return { nodes, edges };
}

export function TenantNamespaceFlow({ tenant, namespaces }: { tenant: any; namespaces: any[] }) {
  const graph = useMemo(
    () => buildTenantNamespaceFlowGraph(tenant, namespaces),
    [tenant, namespaces]
  );
  const ownerCount = tenantStatusOwners(tenant).length;
  const rowCount = Math.max(
    Math.min(namespaces.length, TARGETS_PER_COLUMN),
    Math.min(ownerCount, TARGETS_PER_COLUMN),
    1
  );
  const height = Math.min(570, Math.max(300, rowCount * 106 + 52));

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        height,
        minHeight: 300,
        overflow: 'hidden',
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
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          minZoom={0.25}
          maxZoom={1.4}
        >
          <Background variant={BackgroundVariant.Dots} size={2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default TenantNamespaceFlow;
