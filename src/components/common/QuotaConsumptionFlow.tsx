import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { alpha, Box, Chip, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material';
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
import { Link as RouterLink } from 'react-router-dom';
import { usageChipColor, usageHex } from '../../utils/quantity';
import { centerSourceOnTargetRows } from './flowLayout';
import {
  ALL_QUOTA_RESOURCES,
  filterQuotaMetrics,
  type QuotaAggregationData,
  type QuotaAggregationMetric,
  quotaMetricPeak,
  type QuotaNamespaceClaim,
} from './quotaAggregation';

const NAMESPACES_PER_COLUMN = 3;
const SOURCE_WIDTH = 290;
const SOURCE_HEIGHT = 112;
const NAMESPACE_WIDTH = 320;
const NAMESPACE_HEIGHT = 156;
const NAMESPACE_WITH_CLAIMS_HEIGHT = 232;
const NAMESPACE_START_Y = 18;
const NAMESPACE_GAP_Y = 24;
const UNKNOWN_USAGE_COLOR = '#1976d2';

function resourceQuotaURL(link: { cluster?: string; name: string; namespace: string }): string {
  const routeCluster =
    link.cluster ||
    (typeof window !== 'undefined' ? window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] : '');
  const clusterPrefix = routeCluster ? `/c/${encodeURIComponent(routeCluster)}` : '';
  return `${clusterPrefix}/resourcequotas/${encodeURIComponent(
    link.namespace
  )}/${encodeURIComponent(link.name)}`;
}

function resourcePoolClaimURL(link: { cluster?: string; name: string; namespace: string }): string {
  const routeCluster =
    link.cluster ||
    (typeof window !== 'undefined' ? window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] : '');
  const clusterPrefix = routeCluster ? `/c/${encodeURIComponent(routeCluster)}` : '';
  return `${clusterPrefix}/customresources/resourcepoolclaims.capsule.clastix.io/${encodeURIComponent(
    link.namespace
  )}/${encodeURIComponent(link.name)}`;
}

function claimTooltip(claim: QuotaNamespaceClaim): string {
  const state = claim.exhausted ? 'Exhausted' : claim.bound ? 'Bound' : 'Not bound';
  const requested = Object.entries(claim.requested)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, value]) => `${resource}=${String(value)}`)
    .join(', ');
  return requested ? `${state} · ${requested}` : state;
}

function QuotaSourceNode({ data }: any) {
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
      <Icon icon="mdi:gauge" width={36} height={36} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          {data.kind}
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ color: 'inherit', opacity: 0.82 }}>
          {data.resourceLabel}
        </Typography>
      </Box>
      {data.metrics.length > 0 && (
        <Chip
          size="small"
          label={`${data.peak.toFixed(1)}%${data.singleResource ? '' : ' peak'}`}
          color={usageChipColor(data.peak)}
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'currentColor', height: 9, width: 9 }}
      />
    </Box>
  );
}

function NamespaceUsageNode({ data }: any) {
  const visibleMetrics = (data.metrics as QuotaAggregationMetric[]).slice(0, 4);
  const claims = (data.claims || []) as QuotaNamespaceClaim[];
  const usageColor = data.metrics.length > 0 ? usageHex(data.peak) : UNKNOWN_USAGE_COLOR;

  const node = (
    <Box
      sx={theme => ({
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: usageColor,
        borderRadius: 1.5,
        boxShadow: `0 0 0 3px ${alpha(usageColor, 0.08)}, ${theme.shadows[1]}`,
        height: '100%',
        px: 1.5,
        py: 1.1,
        transition: theme.transitions.create(['box-shadow', 'transform']),
        width: '100%',
        ...(data.link
          ? {
              cursor: 'pointer',
              '&:hover': {
                boxShadow: `0 0 0 4px ${alpha(usageColor, 0.14)}, ${theme.shadows[4]}`,
                transform: 'translateY(-1px)',
              },
            }
          : {}),
      })}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: usageColor, height: 8, width: 8 }}
      />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Icon icon="mdi:kubernetes" width={25} height={25} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Namespace
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {data.name}
          </Typography>
        </Box>
        {data.metrics.length > 0 && (
          <Chip
            size="small"
            label={`${data.peak.toFixed(1)}%${data.singleResource ? '' : ' peak'}`}
            color={usageChipColor(data.peak)}
          />
        )}
      </Stack>
      {visibleMetrics.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No usage reported
        </Typography>
      ) : (
        <Stack spacing={0.2}>
          {visibleMetrics.map(metric => (
            <Stack key={metric.resource} direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {metric.resource}
              </Typography>
              <Typography variant="caption" noWrap sx={{ fontWeight: 650 }}>
                {metric.used} / {metric.hard}
              </Typography>
            </Stack>
          ))}
          {data.metrics.length > visibleMetrics.length && (
            <Typography variant="caption" color="text.secondary">
              +{data.metrics.length - visibleMetrics.length} more
            </Typography>
          )}
        </Stack>
      )}
      {claims.length > 0 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.8, pt: 0.7 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.45 }}>
            Claims ({claims.length})
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {claims.slice(0, 3).map(claim => {
              const chip = (
                <Chip
                  color={claim.exhausted ? 'error' : 'primary'}
                  label={claim.name}
                  size="small"
                  variant={claim.bound ? 'filled' : 'outlined'}
                  sx={{ height: 22, maxWidth: '100%' }}
                />
              );
              return (
                <Tooltip
                  key={`${claim.name}-${claim.link?.namespace || ''}`}
                  title={claimTooltip(claim)}
                >
                  {claim.link ? (
                    <MuiLink
                      component={RouterLink}
                      to={resourcePoolClaimURL(claim.link)}
                      aria-label={`Open ResourcePoolClaim ${claim.link.namespace}/${claim.link.name}`}
                      className="nodrag nopan"
                      color="inherit"
                      underline="none"
                    >
                      {chip}
                    </MuiLink>
                  ) : (
                    <Box component="span">{chip}</Box>
                  )}
                </Tooltip>
              );
            })}
            {claims.length > 3 && (
              <Chip
                label={`+${claims.length - 3}`}
                size="small"
                variant="outlined"
                sx={{ height: 22 }}
              />
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );

  if (!data.link) return node;
  const to = resourceQuotaURL(data.link);

  return (
    <MuiLink
      component={RouterLink}
      to={to}
      aria-label={`Open ResourceQuota ${data.link.namespace}/${data.link.name}`}
      title={`Open ResourceQuota ${data.link.namespace}/${data.link.name}`}
      className="nodrag nopan"
      color="inherit"
      underline="none"
      sx={{ display: 'block', height: '100%', width: '100%' }}
    >
      {node}
    </MuiLink>
  );
}

const nodeTypes = {
  namespaceUsage: NamespaceUsageNode,
  quotaSource: QuotaSourceNode,
};

export interface QuotaConsumptionFlowGraph {
  edges: Edge[];
  nodes: Node[];
}

/** Creates a stable left-to-right quota-to-namespace consumption graph. */
export function buildQuotaConsumptionFlowGraph(
  data: QuotaAggregationData,
  selectedResource = ALL_QUOTA_RESOURCES
): QuotaConsumptionFlowGraph {
  const namespaces = data.namespaces;
  const singleResource = selectedResource !== ALL_QUOTA_RESOURCES;
  const visibleClaims = namespaces.map(namespace =>
    (namespace.claims || []).filter(
      claim =>
        !singleResource || Object.prototype.hasOwnProperty.call(claim.requested, selectedResource)
    )
  );
  const namespaceHeight = visibleClaims.some(claims => claims.length > 0)
    ? NAMESPACE_WITH_CLAIMS_HEIGHT
    : NAMESPACE_HEIGHT;
  const namespaceStepY = namespaceHeight + NAMESPACE_GAP_Y;
  const rows = Math.min(NAMESPACES_PER_COLUMN, Math.max(namespaces.length, 1));
  const sourceY = centerSourceOnTargetRows({
    rowCount: rows,
    sourceHeight: SOURCE_HEIGHT,
    targetHeight: namespaceHeight,
    targetStartY: NAMESPACE_START_Y,
    targetStepY: namespaceStepY,
  });
  const sourceId = 'quota-source';
  const aggregateMetrics = filterQuotaMetrics(data.metrics, selectedResource);
  const nodes: Node[] = [
    {
      id: sourceId,
      type: 'quotaSource',
      position: { x: 24, y: sourceY },
      data: {
        kind: data.kind,
        metrics: aggregateMetrics,
        name: data.name,
        peak: quotaMetricPeak(aggregateMetrics),
        resourceLabel: singleResource
          ? selectedResource
          : `${aggregateMetrics.length} resource limit${aggregateMetrics.length === 1 ? '' : 's'}`,
        singleResource,
      },
      draggable: false,
      selectable: false,
      style: { height: SOURCE_HEIGHT, width: SOURCE_WIDTH },
    },
  ];
  const edges: Edge[] = [];

  namespaces.forEach((namespace, index) => {
    const metrics = filterQuotaMetrics(namespace.metrics, selectedResource);
    const claims = visibleClaims[index];
    const peak = quotaMetricPeak(metrics);
    const column = Math.floor(index / NAMESPACES_PER_COLUMN);
    const row = index % NAMESPACES_PER_COLUMN;
    const id = `namespace-${namespace.namespace}`;
    const usageColor = metrics.length > 0 ? usageHex(peak) : UNKNOWN_USAGE_COLOR;

    nodes.push({
      id,
      type: 'namespaceUsage',
      position: {
        x: 430 + column * 370,
        y: NAMESPACE_START_Y + row * namespaceStepY,
      },
      data: {
        claims,
        link: namespace.link,
        metrics,
        name: namespace.namespace,
        peak,
        singleResource,
      },
      draggable: false,
      selectable: false,
      style: {
        height: namespaceHeight,
        pointerEvents: namespace.link || claims.length > 0 ? 'all' : 'none',
        width: NAMESPACE_WIDTH,
      },
    });
    edges.push({
      id: `quota-namespace-${namespace.namespace}`,
      source: sourceId,
      target: id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: usageColor },
      style: { stroke: usageColor, strokeWidth: 1.9 },
    });
  });

  return { edges, nodes };
}

export function QuotaConsumptionFlow({
  data,
  selectedResource = ALL_QUOTA_RESOURCES,
}: {
  data: QuotaAggregationData;
  selectedResource?: string;
}) {
  const graph = useMemo(
    () => buildQuotaConsumptionFlowGraph(data, selectedResource),
    [data, selectedResource]
  );
  const namespaceCount = Math.max(0, graph.nodes.length - 1);
  const namespaceHeight = Math.max(
    NAMESPACE_HEIGHT,
    ...graph.nodes.slice(1).map(node => Number(node.style?.height) || NAMESPACE_HEIGHT)
  );
  const height = Math.min(
    namespaceHeight > NAMESPACE_HEIGHT ? 850 : 700,
    Math.max(350, Math.min(namespaceCount, 3) * (namespaceHeight + NAMESPACE_GAP_Y) + 50)
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
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.4}
        >
          <Background variant={BackgroundVariant.Dots} size={2} />
          <Controls showInteractive={false} />
          {namespaceCount > NAMESPACES_PER_COLUMN && <MiniMap pannable zoomable />}
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default QuotaConsumptionFlow;
