import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { CustomQuota, GlobalCustomQuota } from '../../resources/customQuotas';
import { GlobalResourceQuota } from '../../resources/globalResourceQuotas';
import { ResourcePool } from '../../resources/resourcePools';
import { usageChipColor } from '../../utils/quantity';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import {
  ALL_QUOTA_RESOURCES,
  quotaResourceFromSearch,
  quotaResourceSearch,
} from '../common/quotaAggregation';
import { QuotaUsage } from '../common/QuotaUsage';
import { AnchoredSubheading } from '../common/SectionAnchor';
import {
  type EffectiveNamespaceQuotaRow,
  effectiveNamespaceQuotaRows,
} from './namespaceEffectiveQuota';
import {
  buildNamespaceQuotaGraph,
  NAMESPACE_QUOTA_BLUE as BLUE,
  NAMESPACE_QUOTA_TARGET_STEP_Y as TARGET_STEP_Y,
  NAMESPACE_QUOTA_TARGETS_PER_COLUMN as TARGETS_PER_COLUMN,
} from './namespaceQuotaGraph';
import { type NamespaceQuotaReference, namespaceQuotaReferences } from './namespaceQuotaReferences';

function NamespaceNode({ data }: any) {
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
      <Icon icon="mdi:kubernetes" width={36} height={36} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.82 }}>
          Namespace
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {data.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.82 }}>
          {data.count} referenced quota system{data.count === 1 ? '' : 's'}
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

function QuotaSystemNode({ data }: any) {
  const reference = data.reference as NamespaceQuotaReference;
  const metrics = data.metrics as NamespaceQuotaReference['metrics'];
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
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Icon icon={reference.kind === 'ResourcePool' ? 'mdi:pool' : 'mdi:gauge'} width={25} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="primary.main">
            {reference.kind}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            <CapsuleResourceLink
              crd={reference.crd}
              name={reference.name}
              namespace={reference.namespace}
            >
              {reference.name}
            </CapsuleResourceLink>
          </Typography>
        </Box>
      </Stack>
      {metrics.length === 0 ? (
        <Typography variant="caption" color="primary.main">
          In scope; no allocation reported
        </Typography>
      ) : (
        <Stack spacing={0.2}>
          {metrics.slice(0, 4).map(metric => (
            <Stack key={metric.resource} direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {metric.resource}
              </Typography>
              <Typography variant="caption" noWrap sx={{ fontWeight: 650 }}>
                {metric.used} / {metric.hard}
              </Typography>
            </Stack>
          ))}
          {metrics.length > 4 && (
            <Typography variant="caption" color="primary.main">
              +{metrics.length - 4} more
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

const nodeTypes = { namespace: NamespaceNode, quotaSystem: QuotaSystemNode };

function LimitingSystemLink({ row }: { row: EffectiveNamespaceQuotaRow }) {
  if (row.source.kind === 'ResourceQuota') {
    return row.source.resource ? (
      <Link kubeObject={row.source.resource}>{row.source.name}</Link>
    ) : (
      row.source.name
    );
  }

  const reference = row.source.reference;
  return reference ? (
    <CapsuleResourceLink crd={reference.crd} name={reference.name} namespace={reference.namespace}>
      {reference.name}
    </CapsuleResourceLink>
  ) : (
    row.source.name
  );
}

export function NamespaceQuotaSystems({ namespace }: { namespace: any }) {
  const name = namespace?.getName?.() || namespace?.jsonData?.metadata?.name;
  const cluster = namespace?.cluster;
  const [customQuotas] = CustomQuota.useList({ cluster, namespace: name });
  const [globalCustomQuotas] = GlobalCustomQuota.useList({ cluster });
  const [globalResourceQuotas] = GlobalResourceQuota.useList({ cluster });
  const [resourcePools] = ResourcePool.useList({ cluster });
  const [resourceQuotas] = K8s.ResourceClasses.ResourceQuota.useList({ cluster, namespace: name });
  const location = useLocation();
  const history = useHistory();
  const references = useMemo(
    () =>
      namespaceQuotaReferences(name, {
        customQuotas,
        globalCustomQuotas,
        globalResourceQuotas,
        resourcePools,
      }),
    [customQuotas, globalCustomQuotas, globalResourceQuotas, name, resourcePools]
  );
  const effectiveRows = useMemo(
    () => effectiveNamespaceQuotaRows(references, resourceQuotas),
    [references, resourceQuotas]
  );
  const resources = useMemo(() => effectiveRows.map(row => row.resource), [effectiveRows]);
  const selectedResource = quotaResourceFromSearch(location.search, resources);
  const visibleRows = useMemo(
    () =>
      selectedResource === ALL_QUOTA_RESOURCES
        ? effectiveRows
        : effectiveRows.filter(row => row.resource === selectedResource),
    [effectiveRows, selectedResource]
  );
  const graph = useMemo(
    () => buildNamespaceQuotaGraph(name, references, selectedResource),
    [name, references, selectedResource]
  );
  const selectResource = (resource: string) =>
    history.replace({
      ...location,
      search: quotaResourceSearch(location.search, resource),
    });
  const targetCount = graph.nodes.length - 1;
  const height = Math.min(700, Math.max(350, Math.min(targetCount, 3) * TARGET_STEP_Y + 50));

  return (
    <SectionBox title="Capsule Quota Systems">
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary">
            Quota systems whose current status includes this namespace.
          </Typography>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="namespace-quota-resource-label">Allocation type</InputLabel>
            <Select
              inputProps={{ 'aria-label': 'Quota allocation type' }}
              label="Allocation type"
              labelId="namespace-quota-resource-label"
              onChange={event => selectResource(event.target.value)}
              value={selectedResource}
            >
              <MenuItem value={ALL_QUOTA_RESOURCES}>All allocation types</MenuItem>
              {resources.map(resource => (
                <MenuItem key={resource} value={resource}>
                  {resource}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Box>
          <AnchoredSubheading
            title="Effective resource limits"
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 0.25 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            One row per resource. Usage and capacity come from the matching quota system with the
            lowest hard limit; an equal native ResourceQuota is preferred as the concrete Kubernetes
            usage source.
          </Typography>
          <SimpleTable
            columns={[
              { label: 'Resource', getter: (row: EffectiveNamespaceQuotaRow) => row.resource },
              {
                label: 'Used',
                getter: (row: EffectiveNamespaceQuotaRow) => (
                  <QuotaUsage used={row.used} limit={row.hard} size={20} />
                ),
                sort: (row: EffectiveNamespaceQuotaRow) => row.percent,
              },
              { label: 'Effective Hard', getter: (row: EffectiveNamespaceQuotaRow) => row.hard },
              { label: 'Available', getter: (row: EffectiveNamespaceQuotaRow) => row.available },
              {
                label: 'Utilization',
                getter: (row: EffectiveNamespaceQuotaRow) => (
                  <Chip
                    size="small"
                    label={`${row.percent.toFixed(1)}%`}
                    color={usageChipColor(row.percent)}
                  />
                ),
                sort: (row: EffectiveNamespaceQuotaRow) => row.percent,
              },
              {
                label: 'Limiting System',
                getter: (row: EffectiveNamespaceQuotaRow) => (
                  <Stack spacing={0.15}>
                    <Typography variant="caption" color="text.secondary">
                      {row.source.kind}
                    </Typography>
                    <Typography variant="body2">
                      <LimitingSystemLink row={row} />
                    </Typography>
                  </Stack>
                ),
                sort: (row: EffectiveNamespaceQuotaRow) => `${row.source.kind}/${row.source.name}`,
              },
              {
                label: 'Matching Systems',
                getter: (row: EffectiveNamespaceQuotaRow) => (
                  <Chip size="small" color="primary" label={row.systems} />
                ),
                sort: (row: EffectiveNamespaceQuotaRow) => row.systems,
              },
            ]}
            data={visibleRows}
            defaultSortingColumn={-5}
            emptyMessage="No quota usage is reported for the selected allocation type."
            reflectInURL={false}
          />
        </Box>

        {references.length === 0 ? (
          <Typography color="text.secondary">
            No Capsule quota system currently references this namespace.
          </Typography>
        ) : targetCount === 0 ? (
          <Typography color="text.secondary">
            No referencing quota system exposes the selected allocation type.
          </Typography>
        ) : (
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
                {targetCount > TARGETS_PER_COLUMN && <MiniMap pannable zoomable />}
              </ReactFlow>
            </ReactFlowProvider>
          </Box>
        )}
      </Stack>
    </SectionBox>
  );
}

export default NamespaceQuotaSystems;
