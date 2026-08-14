import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { Box, Chip, Stack, Typography } from '@mui/material';
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
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { centerSourceOnTargetRows } from '../common/flowLayout';
import {
  ALL_QUOTA_RESOURCES,
  filterQuotaMetrics,
  type QuotaAggregationMetric,
} from '../common/quotaAggregation';
import { QuotaMetricSummary } from '../common/QuotaMetricSummary';
import type { TenantQuotaSystem } from './tenantQuotaOverviewHelpers';

export const TENANT_QUOTA_TARGETS_PER_COLUMN = 3;
export const TENANT_QUOTA_SOURCE_HEIGHT = 112;
export const TENANT_QUOTA_TARGET_HEIGHT = 174;
export const TENANT_QUOTA_TARGET_START_Y = 18;
export const TENANT_QUOTA_TARGET_STEP_Y = 196;
const BLUE = '#1976d2';

function TenantQuotaSourceNode({ data }: any) {
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
        width: '100%',
      })}
    >
      <Icon icon="mdi:account-group" width={36} height={36} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.82 }}>
          Tenant quota scope
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.82 }}>
          {data.count} labeled quota system{data.count === 1 ? '' : 's'}
        </Typography>
      </Box>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function TenantQuotaSystemNode({ data }: any) {
  const system = data.system as TenantQuotaSystem;
  const metrics = data.metrics as QuotaAggregationMetric[];
  return (
    <Box
      sx={theme => ({
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: BLUE,
        borderRadius: 1.5,
        boxShadow: theme.shadows[1],
        height: '100%',
        px: 1.5,
        py: 1.1,
        width: '100%',
      })}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: BLUE, height: 8, width: 8 }}
      />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Icon icon={system.kind === 'ResourcePool' ? 'mdi:pool' : 'mdi:gauge'} width={25} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="primary.main">
            {system.kind}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            <CapsuleResourceLink crd={system.crd} name={system.name} namespace={system.namespace}>
              {system.name}
            </CapsuleResourceLink>
          </Typography>
        </Box>
        <Chip
          color="primary"
          label={`${system.aggregation.namespaces.length} ns`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <QuotaMetricSummary metrics={metrics} />
    </Box>
  );
}

const nodeTypes = {
  tenantQuotaSource: TenantQuotaSourceNode,
  tenantQuotaSystem: TenantQuotaSystemNode,
};

export function buildTenantQuotaFlowGraph(
  tenantName: string,
  systems: TenantQuotaSystem[],
  selectedResource = ALL_QUOTA_RESOURCES
): { edges: Edge[]; nodes: Node[] } {
  const visibleSystems = systems.filter(
    system =>
      selectedResource === ALL_QUOTA_RESOURCES || system.resources.includes(selectedResource)
  );
  const rowCount = Math.min(TENANT_QUOTA_TARGETS_PER_COLUMN, Math.max(visibleSystems.length, 1));
  const sourceY = centerSourceOnTargetRows({
    rowCount,
    sourceHeight: TENANT_QUOTA_SOURCE_HEIGHT,
    targetHeight: TENANT_QUOTA_TARGET_HEIGHT,
    targetStartY: TENANT_QUOTA_TARGET_START_Y,
    targetStepY: TENANT_QUOTA_TARGET_STEP_Y,
  });
  const sourceId = 'tenant-quota-source';
  const nodes: Node[] = [
    {
      data: { count: visibleSystems.length, name: tenantName },
      draggable: false,
      id: sourceId,
      position: { x: 24, y: sourceY },
      selectable: false,
      style: { height: TENANT_QUOTA_SOURCE_HEIGHT, width: 290 },
      type: 'tenantQuotaSource',
    },
  ];
  const edges: Edge[] = [];

  visibleSystems.forEach((system, index) => {
    const column = Math.floor(index / TENANT_QUOTA_TARGETS_PER_COLUMN);
    const row = index % TENANT_QUOTA_TARGETS_PER_COLUMN;
    const id = `tenant-quota-${system.kind}-${system.namespace || '-'}-${system.name}`;
    nodes.push({
      data: {
        metrics: filterQuotaMetrics(system.aggregation.metrics, selectedResource),
        system,
      },
      draggable: false,
      id,
      position: {
        x: 430 + column * 390,
        y: TENANT_QUOTA_TARGET_START_Y + row * TENANT_QUOTA_TARGET_STEP_Y,
      },
      selectable: false,
      style: { height: TENANT_QUOTA_TARGET_HEIGHT, width: 350 },
      type: 'tenantQuotaSystem',
    });
    edges.push({
      animated: true,
      id: `${sourceId}-${id}`,
      markerEnd: { color: BLUE, type: MarkerType.ArrowClosed },
      source: sourceId,
      style: { stroke: BLUE, strokeWidth: 1.9 },
      target: id,
      type: 'smoothstep',
    });
  });

  return { edges, nodes };
}

export function TenantQuotaFlow({
  selectedResource,
  systems,
  tenantName,
}: {
  selectedResource: string;
  systems: TenantQuotaSystem[];
  tenantName: string;
}) {
  const graph = useMemo(
    () => buildTenantQuotaFlowGraph(tenantName, systems, selectedResource),
    [selectedResource, systems, tenantName]
  );
  const targetCount = graph.nodes.length - 1;
  const height = Math.min(
    700,
    Math.max(350, Math.min(targetCount, TENANT_QUOTA_TARGETS_PER_COLUMN) * 196 + 50)
  );

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        height,
        minHeight: 350,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <ReactFlow
          edges={graph.edges}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.18 }}
          maxZoom={1.4}
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={graph.nodes}
          nodesConnectable={false}
          nodesDraggable={false}
        >
          <Background variant={BackgroundVariant.Dots} size={2} />
          <Controls showInteractive={false} />
          {targetCount > TENANT_QUOTA_TARGETS_PER_COLUMN && <MiniMap pannable zoomable />}
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default TenantQuotaFlow;
