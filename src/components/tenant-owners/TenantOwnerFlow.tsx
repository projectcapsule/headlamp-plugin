import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { alpha, Box, Chip, Link as MuiLink, Typography } from '@mui/material';
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
import { Link as RouterLink } from 'react-router-dom';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { centerSourceOnTargetRows } from '../common/flowLayout';
import { tenantOwnerIdentity } from './tenantOwnerReferences';

const TENANTS_PER_COLUMN = 4;
const SOURCE_HEIGHT = 96;
const TENANT_HEIGHT = 76;
const TENANT_START_Y = 18;
const TENANT_STEP_Y = 106;

function objectData(item: any) {
  return item?.jsonData || item || {};
}

function tenantURL(name: string, cluster?: string): string {
  const routeCluster =
    cluster ||
    (typeof window !== 'undefined' ? window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] : '');
  const clusterPrefix = routeCluster ? `/c/${encodeURIComponent(routeCluster)}` : '';
  return `${clusterPrefix}/customresources/${CAPSULE_CRDS.Tenant}/-/${encodeURIComponent(name)}`;
}

function OwnerNode({ data }: any) {
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
      <Icon icon="mdi:account-key" width={35} height={35} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          TenantOwner · {data.kind}
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ color: 'inherit', opacity: 0.82 }}>
          {data.identity}
        </Typography>
      </Box>
      <Chip size="small" label={`${data.references} tenant${data.references === 1 ? '' : 's'}`} />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function TenantReferenceNode({ data }: any) {
  const stateColor = data.cordoned ? '#ff9800' : '#4caf50';
  return (
    <MuiLink
      component={RouterLink}
      to={tenantURL(data.name, data.cluster)}
      aria-label={`Open Tenant ${data.name}`}
      title={`Open Tenant ${data.name}`}
      className="nodrag nopan"
      color="inherit"
      underline="none"
      sx={{ display: 'block', height: '100%', width: '100%' }}
    >
      <Box
        sx={theme => ({
          alignItems: 'center',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: stateColor,
          borderRadius: 1.5,
          boxShadow: `0 0 0 3px ${alpha(stateColor, 0.08)}, ${theme.shadows[1]}`,
          cursor: 'pointer',
          display: 'flex',
          gap: 1,
          height: '100%',
          px: 1.5,
          py: 1,
          transition: theme.transitions.create(['box-shadow', 'transform']),
          width: '100%',
          '&:hover': {
            boxShadow: `0 0 0 4px ${alpha(stateColor, 0.14)}, ${theme.shadows[4]}`,
            transform: 'translateY(-1px)',
          },
        })}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: stateColor, height: 8, width: 8 }}
        />
        <Icon icon="mdi:account-group" width={28} height={28} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Tenant
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {data.name}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={data.cordoned ? 'Cordoned' : 'Active'}
          color={data.cordoned ? 'warning' : 'success'}
        />
      </Box>
    </MuiLink>
  );
}

const nodeTypes = {
  owner: OwnerNode,
  tenantReference: TenantReferenceNode,
};

export function buildTenantOwnerFlowGraph(owner: any, tenants: any[]) {
  const ownerJson = objectData(owner);
  const identity = tenantOwnerIdentity(owner);
  const ownerName = ownerJson.metadata?.name || owner?.getName?.() || 'TenantOwner';
  const targetRows = Math.min(TENANTS_PER_COLUMN, Math.max(tenants.length, 1));
  const sourceY = centerSourceOnTargetRows({
    rowCount: targetRows,
    sourceHeight: SOURCE_HEIGHT,
    targetHeight: TENANT_HEIGHT,
    targetStartY: TENANT_START_Y,
    targetStepY: TENANT_STEP_Y,
  });
  const sourceId = 'tenant-owner-source';
  const nodes: Node[] = [
    {
      id: sourceId,
      type: 'owner',
      position: { x: 24, y: sourceY },
      data: {
        identity: identity.name,
        kind: identity.kind,
        name: ownerName,
        references: tenants.length,
      },
      draggable: false,
      selectable: false,
      style: { height: SOURCE_HEIGHT, width: 300 },
    },
  ];
  const edges: Edge[] = [];

  tenants.forEach((tenant, index) => {
    const json = objectData(tenant);
    const name = json.metadata?.name || tenant?.getName?.();
    const state = json.status?.state || (json.spec?.cordoned ? 'Cordoned' : 'Active');
    const column = Math.floor(index / TENANTS_PER_COLUMN);
    const row = index % TENANTS_PER_COLUMN;
    const id = `tenant-${name}`;

    nodes.push({
      id,
      type: 'tenantReference',
      position: { x: 430 + column * 300, y: TENANT_START_Y + row * TENANT_STEP_Y },
      data: {
        cluster: tenant?.cluster || owner?.cluster,
        cordoned: state === 'Cordoned',
        name,
      },
      draggable: false,
      selectable: false,
      style: { height: TENANT_HEIGHT, pointerEvents: 'all', width: 240 },
    });
    edges.push({
      id: `owner-tenant-${name}`,
      source: sourceId,
      target: id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.75 },
    });
  });

  return { edges, nodes };
}

export function TenantOwnerFlow({ owner, tenants }: { owner: any; tenants: any[] }) {
  const graph = useMemo(() => buildTenantOwnerFlowGraph(owner, tenants), [owner, tenants]);
  const height = Math.min(570, Math.max(300, Math.min(tenants.length, 4) * 106 + 52));

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

export default TenantOwnerFlow;
