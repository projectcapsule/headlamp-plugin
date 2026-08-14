import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { Box, Stack, Typography } from '@mui/material';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import {
  buildResourcePoolClaimGraph,
  RESOURCE_POOL_CLAIM_BLUE as BLUE,
} from './resourcePoolClaimGraph';

function ClaimNode({ data }: any) {
  const requested = Object.entries(data.requested || {}).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return (
    <Box
      sx={theme => ({
        background: 'linear-gradient(135deg, #1976d2, #0d47a1)',
        borderRadius: 2,
        boxShadow: theme.shadows[3],
        color: '#fff',
        height: '100%',
        px: 1.75,
        py: 1.2,
        width: '100%',
      })}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
        <Icon icon="mdi:ticket-confirmation-outline" width={28} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.82 }}>
            ResourcePoolClaim
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {data.name}
          </Typography>
        </Box>
      </Stack>
      {requested.slice(0, 4).map(([resource, value]) => (
        <Stack key={resource} direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" noWrap sx={{ color: 'inherit', opacity: 0.82 }}>
            {resource}
          </Typography>
          <Typography variant="caption" noWrap sx={{ fontWeight: 650 }}>
            {String(value)}
          </Typography>
        </Stack>
      ))}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function PoolNode({ data }: any) {
  return (
    <Box
      sx={theme => ({
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: BLUE,
        borderRadius: 2,
        boxShadow: theme.shadows[1],
        display: 'flex',
        gap: 1.25,
        height: '100%',
        px: 2,
        width: '100%',
      })}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: BLUE, height: 9, width: 9 }}
      />
      <Icon icon="mdi:pool" color={BLUE} width={34} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="primary.main">
          ResourcePool
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          <CapsuleResourceLink crd={CAPSULE_CRDS.ResourcePool} name={data.name}>
            {data.name}
          </CapsuleResourceLink>
        </Typography>
        {!data.exists && (
          <Typography variant="caption" color="primary.main">
            Referenced pool is not currently visible
          </Typography>
        )}
      </Box>
    </Box>
  );
}

const nodeTypes = { claim: ClaimNode, pool: PoolNode };

export function ResourcePoolClaimFlow({ claim, pool }: { claim: any; pool?: any }) {
  const graph = useMemo(() => buildResourcePoolClaimGraph(claim, pool), [claim, pool]);
  if (graph.nodes.length === 0) {
    return (
      <Typography color="text.secondary">This claim does not reference a ResourcePool.</Typography>
    );
  }
  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        height: 320,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <ReactFlow
          edges={graph.edges}
          fitView
          fitViewOptions={{ maxZoom: 1.1, padding: 0.2 }}
          maxZoom={1.4}
          minZoom={0.4}
          nodeTypes={nodeTypes}
          nodes={graph.nodes}
          nodesConnectable={false}
          nodesDraggable={false}
        >
          <Background variant={BackgroundVariant.Dots} size={2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default ResourcePoolClaimFlow;
