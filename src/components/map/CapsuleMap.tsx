import '@xyflow/react/dist/base.css';
import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, NamespacesAutocomplete } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Popover,
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
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { buildMapEdges, layoutMapTree } from './mapGraph';
import type { MapResourceNode, MapSourceDefinition } from './mapTypes';
import { objectId } from './mapTypes';
import { type CapsuleGroupBy, groupResources } from './tenantGrouping';
import { useMapSources } from './useMapSources';

const CATEGORY_ORDER: MapSourceDefinition['category'][] = [
  'Workloads',
  'Storage',
  'Network',
  'Security',
  'Configuration',
  'Tenant',
];

function metadata(object: any) {
  return object?.metadata || object?.jsonData?.metadata || {};
}

function resourceKind(object: any): string {
  return object?.kind || object?.jsonData?.kind || object?.constructor?.kind || 'Resource';
}

function resourceStatus(object: any): { color: string; label: string } {
  const status = object?.status || object?.jsonData?.status || {};
  const conditions = status.conditions || [];
  const failed = conditions.find(
    (condition: any) =>
      condition.status === 'False' && ['Ready', 'Available', 'Healthy'].includes(condition.type)
  );
  if (status.phase === 'Failed' || failed) return { color: '#d32f2f', label: 'Not Ready' };
  if (status.phase === 'Pending') return { color: '#ed6c02', label: 'Pending' };

  const ready = conditions.find(
    (condition: any) =>
      condition.status === 'True' && ['Ready', 'Available', 'Healthy'].includes(condition.type)
  );
  if (status.phase === 'Running' || ready) return { color: '#2e7d32', label: 'Ready' };
  return { color: '#78909c', label: 'Unknown' };
}

const KIND_ICONS: Record<string, string> = {
  ConfigMap: 'mdi:file-cog',
  CronJob: 'mdi:calendar-clock',
  DaemonSet: 'mdi:server-network',
  Deployment: 'mdi:rocket-launch',
  Endpoints: 'mdi:connection',
  GlobalCustomQuota: 'mdi:chart-bar-stacked',
  GlobalResourceQuota: 'mdi:gauge',
  GlobalTenantResource: 'mdi:file-document-multiple',
  HorizontalPodAutoscaler: 'mdi:arrow-expand-horizontal',
  Ingress: 'mdi:call-split',
  Job: 'mdi:briefcase-check',
  LimitRange: 'mdi:tune',
  NetworkPolicy: 'mdi:shield-network',
  PersistentVolumeClaim: 'mdi:database',
  Pod: 'mdi:cube-outline',
  PodDisruptionBudget: 'mdi:shield-check',
  ReplicaSet: 'mdi:content-copy',
  ResourcePool: 'mdi:pool',
  ResourceQuota: 'mdi:gauge',
  Role: 'mdi:shield-account',
  RoleBinding: 'mdi:account-lock',
  Secret: 'mdi:key-variant',
  Service: 'mdi:lan-connect',
  ServiceAccount: 'mdi:account-cog',
  StatefulSet: 'mdi:database-sync',
  Tenant: 'mdi:account-group',
  TenantOwner: 'mdi:account-key',
  TenantResource: 'mdi:file-document',
};

function ResourceMapNode({ data }: any) {
  const object = data.resource.kubeObject;
  const objectMetadata = metadata(object);
  const kind = resourceKind(object);
  const status = resourceStatus(object);

  return (
    <Box
      sx={theme => ({
        width: '100%',
        height: '100%',
        px: 1.25,
        py: 1,
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        boxShadow: 1,
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        overflow: 'hidden',
      })}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Icon icon={KIND_ICONS[kind] || 'mdi:cube'} width={28} height={28} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {kind}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          <Link kubeObject={object}>{objectMetadata.name || 'Unknown'}</Link>
        </Typography>
      </Box>
      <Box
        aria-label={status.label}
        title={status.label}
        sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: status.color, flexShrink: 0 }}
      />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

function GroupMapNode({ data }: any) {
  const group = data.group;
  const tenant = group.subtitle === 'Tenant';

  return (
    <Box
      sx={theme => ({
        width: '100%',
        height: '100%',
        bgcolor: alpha(
          tenant ? theme.palette.primary.main : theme.palette.background.paper,
          tenant ? 0.055 : 0.5
        ),
        border: tenant ? '2px solid' : '1px solid',
        borderColor: tenant ? 'primary.main' : 'divider',
        borderRadius: tenant ? 2 : 1.5,
      })}
    >
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ position: 'absolute', top: 10, left: 13, right: 13, minWidth: 0 }}
      >
        <Icon
          icon={
            tenant ? 'mdi:account-group' : group.subtitle === 'Namespace' ? 'mdi:cube' : 'mdi:grid'
          }
          width={20}
          height={20}
        />
        <Typography variant="caption" color="text.secondary">
          {group.subtitle}
        </Typography>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {group.label}
        </Typography>
      </Stack>
    </Box>
  );
}

const nodeTypes = {
  capsuleResource: ResourceMapNode,
  capsuleGroup: GroupMapNode,
};

function MapFilters({
  sources,
  selection,
  onChange,
}: {
  sources: MapSourceDefinition[];
  selection: Set<string>;
  onChange: (selection: Set<string>) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const toggleSource = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const toggleCategory = (categorySources: MapSourceDefinition[]) => {
    const next = new Set(selection);
    const allSelected = categorySources.every(source => selection.has(source.id));
    categorySources.forEach(source => (allSelected ? next.delete(source.id) : next.add(source.id)));
    onChange(next);
  };

  return (
    <>
      <Chip
        icon={<Icon icon="mdi:filter" />}
        label={`Filters (${selection.size}/${sources.length})`}
        color="primary"
        onClick={event => setAnchorEl(event.currentTarget)}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ width: 380, maxWidth: '90vw', maxHeight: '72vh', overflow: 'auto', p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              size="small"
              onClick={() => onChange(new Set(sources.map(source => source.id)))}
            >
              Show all
            </Button>
            <Button size="small" onClick={() => onChange(new Set())}>
              Hide all
            </Button>
          </Stack>
          {CATEGORY_ORDER.map((category, categoryIndex) => {
            const categorySources = sources.filter(source => source.category === category);
            const selectedCount = categorySources.filter(source => selection.has(source.id)).length;
            return (
              <Box key={category}>
                {categoryIndex > 0 && <Divider sx={{ my: 1 }} />}
                <FormControlLabel
                  sx={{ m: 0, width: '100%' }}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedCount === categorySources.length}
                      indeterminate={selectedCount > 0 && selectedCount < categorySources.length}
                      onChange={() => toggleCategory(categorySources)}
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      {category} ({selectedCount}/{categorySources.length})
                    </Typography>
                  }
                />
                <Box sx={{ ml: 3 }}>
                  {categorySources.map(source => (
                    <FormControlLabel
                      key={source.id}
                      sx={{ m: 0, width: '100%' }}
                      control={
                        <Checkbox
                          size="small"
                          checked={selection.has(source.id)}
                          onChange={() => toggleSource(source.id)}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Icon icon={source.icon} width={18} height={18} />
                          <Typography variant="body2">{source.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {source.items?.length ?? '…'}
                          </Typography>
                        </Stack>
                      }
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}

function GroupChip({
  value,
  active,
  onClick,
}: {
  value: CapsuleGroupBy;
  active: boolean;
  onClick: () => void;
}) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <Chip
      label={label}
      color={active ? 'primary' : undefined}
      variant={active ? 'filled' : 'outlined'}
      icon={active ? <Icon icon="mdi:check" /> : undefined}
      onClick={onClick}
      sx={{ borderRadius: 0, '&:first-of-type': { borderRadius: '16px 0 0 16px' } }}
    />
  );
}

/**
 * Supported-plugin implementation of Headlamp's Map route.
 *
 * It deliberately imports only public Headlamp APIs. React Flow is bundled by
 * this plugin so private Headlamp map modules never become missing globals in
 * the browser.
 */
export function CapsuleMap({ height = '100%' }: { height?: string }) {
  const sources = useMapSources();
  const [allNamespaces] = K8s.ResourceClasses.Namespace.useList();
  const selectedNamespaces = useSelector((state: any) => state.filter.namespaces) as Set<string>;
  const location = useLocation();
  const history = useHistory();
  const query = new URLSearchParams(location.search);
  const requestedGroup = query.get('group');
  const groupBy: CapsuleGroupBy | undefined = ['tenant', 'namespace', 'instance', 'node'].includes(
    requestedGroup || ''
  )
    ? (requestedGroup as CapsuleGroupBy)
    : 'namespace';

  const [selectedSources, setSelectedSources] = useState(
    () =>
      new Set(
        sources
          .filter(source => query.get('show') === 'all' || source.enabledByDefault)
          .map(source => source.id)
      )
  );

  const setGroupBy = (nextGroup: CapsuleGroupBy | undefined) => {
    const params = new URLSearchParams(location.search);
    if (nextGroup) params.set('group', nextGroup);
    else params.delete('group');
    history.replace({ ...location, search: params.toString() });
  };

  const enabledSources = useMemo(
    () => sources.filter(source => selectedSources.has(source.id)),
    [sources, selectedSources]
  );
  const resourceNodes = useMemo(() => {
    const namespaces = selectedNamespaces || new Set<string>();
    const byId = new Map<string, MapResourceNode>();
    enabledSources.forEach(source => {
      (source.items || []).forEach(object => {
        const objectMetadata = metadata(object);
        if (
          namespaces.size > 0 &&
          (!objectMetadata.namespace || !namespaces.has(objectMetadata.namespace))
        ) {
          return;
        }
        const id = objectId(object);
        if (!byId.has(id)) byId.set(id, { id, kubeObject: object, sourceId: source.id });
      });
    });
    return [...byId.values()];
  }, [enabledSources, selectedNamespaces]);

  const tenants = sources.find(source => source.id === 'tenants')?.items || [];
  const tree = useMemo(
    () => groupResources(resourceNodes, groupBy, allNamespaces || [], tenants),
    [resourceNodes, groupBy, allNamespaces, tenants]
  );
  const flowNodes = useMemo(() => layoutMapTree(tree), [tree]);
  const flowEdges = useMemo(() => buildMapEdges(resourceNodes), [resourceNodes]);
  const isLoading = enabledSources.some(source => source.items === null) || allNamespaces === null;

  return (
    <Box sx={{ height, minHeight: 600, display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ p: 2, pb: 1 }}
      >
        <NamespacesAutocomplete />
        <MapFilters sources={sources} selection={selectedSources} onChange={setSelectedSources} />
        <Typography variant="body2" sx={{ ml: 1 }}>
          Group by
        </Typography>
        <Stack direction="row" spacing={0}>
          {(['tenant', 'namespace', 'instance', 'node'] as CapsuleGroupBy[]).map(group => (
            <GroupChip
              key={group}
              value={group}
              active={groupBy === group}
              onClick={() => setGroupBy(groupBy === group ? undefined : group)}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {resourceNodes.length} resources
        </Typography>
      </Stack>

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={isLoading ? [] : flowNodes}
            edges={isLoading ? [] : flowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
            minZoom={0.08}
            maxZoom={1.5}
          >
            <Background variant={BackgroundVariant.Dots} size={2} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </ReactFlowProvider>

        {isLoading && (
          <Stack
            spacing={1}
            alignItems="center"
            sx={{ position: 'absolute', inset: 0, justifyContent: 'center' }}
          >
            <CircularProgress size={32} />
            <Typography color="text.secondary">Loading resource map…</Typography>
          </Stack>
        )}
        {!isLoading && flowNodes.length === 0 && (
          <Typography
            color="text.secondary"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            No resources to show. Change the filters or namespace selection.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default CapsuleMap;
