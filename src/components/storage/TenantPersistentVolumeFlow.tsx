import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import type { ChipProps } from '@mui/material';
import { Box, Chip, Typography } from '@mui/material';
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
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import {
  persistentVolumeCapacity,
  persistentVolumeClaimForVolume,
  persistentVolumeData,
  persistentVolumeName,
  persistentVolumePhase,
} from './persistentVolumeTenant';

const RELATIONS_PER_COLUMN = 4;
const TENANT_HEIGHT = 88;
const CLAIM_HEIGHT = 92;
const VOLUME_HEIGHT = 92;
const RELATION_STEP_Y = 118;
const START_Y = 22;

function phaseColor(phase: string): ChipProps['color'] {
  if (phase === 'Bound') return 'info';
  if (phase === 'Available') return 'success';
  if (phase === 'Failed' || phase === 'Lost') return 'error';
  if (phase === 'Released' || phase === 'Pending') return 'warning';
  return 'default';
}

function TenantNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        '& a': { color: 'inherit', fontWeight: 700, textDecorationColor: 'currentColor' },
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
      <Icon icon="mdi:account-group" width={34} height={34} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          Tenant
        </Typography>
        <Typography component="div" variant="subtitle1" noWrap>
          <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={data.name}>
            {data.name}
          </CapsuleResourceLink>
        </Typography>
      </Box>
      <Chip
        color="primary"
        label={`${data.claimCount} PVC · ${data.volumeCount} PV`}
        size="small"
        variant="filled"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function PersistentVolumeClaimNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'info.main',
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
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#1976d2', height: 8, width: 8 }}
      />
      <Icon icon="mdi:database-outline" width={28} height={28} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          PersistentVolumeClaim
        </Typography>
        <Typography component="div" variant="body2" noWrap sx={{ fontWeight: 700 }}>
          <Link
            routeName="persistentVolumeClaim"
            params={{ namespace: data.namespace, name: data.name }}
            activeCluster={data.cluster}
            tooltip
          >
            {data.namespace}/{data.name}
          </Link>
        </Typography>
      </Box>
      <Chip color={phaseColor(data.phase)} label={data.phase} size="small" />
      {data.hasVolume && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: '#1976d2', height: 8, width: 8 }}
        />
      )}
    </Box>
  );
}

function PersistentVolumeNode({ data }: any) {
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
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#1976d2', height: 8, width: 8 }}
      />
      <Icon icon="mdi:database" width={28} height={28} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          PersistentVolume · {data.capacity}
        </Typography>
        <Typography component="div" variant="body2" noWrap sx={{ fontWeight: 700 }}>
          <Link
            routeName="persistentVolume"
            params={{ name: data.name }}
            activeCluster={data.cluster}
            tooltip
          >
            {data.name}
          </Link>
        </Typography>
      </Box>
      <Chip color={phaseColor(data.phase)} label={data.phase} size="small" />
    </Box>
  );
}

const nodeTypes = {
  tenant: TenantNode,
  persistentVolumeClaim: PersistentVolumeClaimNode,
  persistentVolume: PersistentVolumeNode,
};

export function buildTenantPersistentVolumeFlowGraph(
  tenantName: string,
  claims: any[],
  volumes: any[]
) {
  const rowCount = Math.min(RELATIONS_PER_COLUMN, Math.max(volumes.length, 1));
  const relationBounds = (rowCount - 1) * RELATION_STEP_Y + CLAIM_HEIGHT;
  const tenantY = START_Y + relationBounds / 2 - TENANT_HEIGHT / 2;
  const tenantId = `tenant-${tenantName}`;
  const nodes: Node[] = [
    {
      id: tenantId,
      type: 'tenant',
      position: { x: 24, y: tenantY },
      data: { claimCount: claims.length, name: tenantName, volumeCount: volumes.length },
      draggable: false,
      selectable: false,
      style: { height: TENANT_HEIGHT, width: 280 },
    },
  ];
  const edges: Edge[] = [];

  volumes.forEach((volume, index) => {
    const claim = persistentVolumeClaimForVolume(volume, claims);
    const claimData = persistentVolumeData(claim);
    const claimName = claimData?.metadata?.name || claim?.getName?.() || '';
    const namespace = claimData?.metadata?.namespace || claim?.getNamespace?.() || '';
    const column = Math.floor(index / RELATIONS_PER_COLUMN);
    const row = index % RELATIONS_PER_COLUMN;
    const columnCount = Math.min(
      RELATIONS_PER_COLUMN,
      volumes.length - column * RELATIONS_PER_COLUMN
    );
    const columnBounds = (columnCount - 1) * RELATION_STEP_Y + CLAIM_HEIGHT;
    const y = START_Y + relationBounds / 2 - columnBounds / 2 + row * RELATION_STEP_Y;
    const relationX = 390 + column * 710;
    const volumeName = persistentVolumeName(volume);
    const volumeId = `persistent-volume-${volumeName}`;

    let volumeX = relationX;
    let volumeEdgeSource = tenantId;
    if (claim) {
      const claimId = `persistent-volume-claim-${namespace}-${claimName}`;
      nodes.push({
        id: claimId,
        type: 'persistentVolumeClaim',
        position: { x: relationX, y },
        data: {
          cluster: claim?.cluster,
          hasVolume: true,
          name: claimName,
          namespace,
          phase: claimData?.status?.phase || 'Bound',
        },
        draggable: false,
        selectable: false,
        style: { height: CLAIM_HEIGHT, width: 300 },
      });
      edges.push({
        id: `${tenantId}-${claimId}`,
        source: tenantId,
        target: claimId,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1976d2' },
        style: { stroke: '#1976d2', strokeWidth: 1.8 },
      });
      volumeX += 380;
      volumeEdgeSource = claimId;
    }

    nodes.push({
      id: volumeId,
      type: 'persistentVolume',
      position: { x: volumeX, y },
      data: {
        capacity: persistentVolumeCapacity(volume),
        cluster: volume?.cluster,
        name: volumeName,
        phase: persistentVolumePhase(volume),
      },
      draggable: false,
      selectable: false,
      style: { height: VOLUME_HEIGHT, width: 300 },
    });
    edges.push({
      id: `${volumeEdgeSource}-${volumeId}`,
      source: volumeEdgeSource,
      target: volumeId,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#1976d2' },
      style: { stroke: '#1976d2', strokeWidth: 1.8 },
    });
  });

  return { edges, nodes };
}

export function TenantPersistentVolumeFlow({
  claims,
  tenantName,
  volumes,
}: {
  claims: any[];
  tenantName: string;
  volumes: any[];
}) {
  const graph = useMemo(
    () => buildTenantPersistentVolumeFlowGraph(tenantName, claims, volumes),
    [claims, tenantName, volumes]
  );
  const rowCount = Math.min(RELATIONS_PER_COLUMN, Math.max(volumes.length, 1));
  const height = Math.min(570, Math.max(300, rowCount * RELATION_STEP_Y + 48));

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
          minZoom={0.2}
          maxZoom={1.4}
        >
          <Background variant={BackgroundVariant.Dots} size={2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default TenantPersistentVolumeFlow;
