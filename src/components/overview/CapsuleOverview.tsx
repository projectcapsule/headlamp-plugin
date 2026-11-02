import { Icon } from '@iconify/react';
import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useFilterFunc } from '@kinvolk/headlamp-plugin/lib/Utils';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { type ReactNode, useState } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CapsuleIcon } from '../common/CapsuleIcon';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import { CapsuleEvents } from './CapsuleEvents';
import {
  controllerReady,
  DASHBOARD_STATES,
  managedInventory,
  quotaPeak,
  resourceMessage,
  resourceState,
  STATE_COLORS,
  STATE_LABELS,
  summarize,
  tenantNamespaceRows,
} from './dashboardModel';
import type { ResourceData } from './overviewClient';
import { useCapsuleOverview } from './useCapsuleOverview';

function Panel({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Icon icon={icon} width={20} />
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}
function IconBadge({
  icon,
  tone = 'primary',
}: {
  icon: string;
  tone?: 'primary' | 'success' | 'error' | 'warning' | 'info';
}) {
  return (
    <Box
      sx={theme => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 42,
        height: 42,
        flexShrink: 0,
        borderRadius: 2,
        color: theme.palette[tone].main,
        bgcolor: alpha(theme.palette[tone].main, 0.14),
      })}
    >
      <Icon icon={icon} width={24} />
    </Box>
  );
}
function ResourceLink({ item }: { item: ResourceData }) {
  const crd = CAPSULE_CRDS[item.kind as keyof typeof CAPSULE_CRDS];
  return crd ? (
    <CapsuleResourceLink
      crd={crd}
      name={item.metadata.name}
      namespace={item.metadata.namespace}
      cluster={item.cluster}
    >
      {item.metadata.namespace ? `${item.metadata.namespace}/` : ''}
      {item.metadata.name}
    </CapsuleResourceLink>
  ) : (
    <>{item.metadata.name}</>
  );
}
function StateChip({ item }: { item: ResourceData }) {
  const state = resourceState(item);
  return (
    <Chip
      size="small"
      label={STATE_LABELS[state]}
      color={
        state === 'ready'
          ? 'success'
          : state === 'failed'
          ? 'error'
          : ['cordoned', 'warning'].includes(state)
          ? 'warning'
          : state === 'reconciling'
          ? 'info'
          : 'default'
      }
    />
  );
}

export function CapsuleOverview() {
  const snapshot = useCapsuleOverview();
  const filter = useFilterFunc<any>();
  const [show, setShow] = useState(() =>
    localStorage.getItem('capsule.overview.show') === 'configured' ? 'configured' : 'all'
  );
  const groups = snapshot.groups.map(group => ({
    ...group,
    items:
      group.items?.filter(
        item =>
          filter(item) &&
          (group.kind !== 'Tenant' ||
            !snapshot.selectedTenants.length ||
            snapshot.selectedTenants.includes(item.metadata.name))
      ) ?? null,
  }));
  const all = groups.flatMap(group => group.items || []);
  const tenants = groups.find(group => group.kind === 'Tenant')?.items || [];
  const quotas = groups
    .filter(group => group.category === 'Quotas' && group.kind !== 'ResourcePoolClaim')
    .flatMap(group => group.items || []);
  const replications = groups
    .filter(group => group.category === 'Replications')
    .flatMap(group => group.items || []);
  const tenantRows = snapshot.scopes.flatMap(scope =>
    tenantNamespaceRows(
      tenants.filter(tenant => tenant.cluster === scope.cluster),
      scope.namespaces,
      scope.namespacedExcluded
    )
  );
  const spaces = [
    ...new Map(
      tenantRows.flatMap(row =>
        row.spaces.map(space => [`${row.tenant.cluster}/${space.name}`, space] as const)
      )
    ).values(),
  ];
  const inventory = snapshot.scopes.flatMap(scope =>
    managedInventory(
      replications.filter(item => item.cluster === scope.cluster),
      scope.namespaces,
      scope.namespacedExcluded
    )
  );
  const managed = {
    ready: inventory.filter(item => item.state === 'ready').length,
    failed: inventory.filter(item => item.state === 'failed').length,
    unknown: inventory.filter(item => item.state === 'unknown').length,
    total: inventory.length,
  };
  const totals = summarize(all);
  const controllerIssues = snapshot.controllers.filter(item => !controllerReady(item));
  const failures = all.filter(item => ['failed', 'warning'].includes(resourceState(item)));
  const namespaceFailures = tenantRows.flatMap(row =>
    row.spaces
      .filter(space => space.state === 'failed')
      .map(space => ({ ...space, tenant: row.tenant }))
  );
  const issueCount = failures.length + controllerIssues.length + namespaceFailures.length;
  const unavailable = groups.filter(group => group.error);
  const partial = !!unavailable.length || !!snapshot.controllerError || !!snapshot.eventError;
  const initialLoading = snapshot.loading && !snapshot.updatedAt;
  const empty = !all.length && !snapshot.controllers.length;
  const statusIncomplete = totals.unknown > 0 || spaces.some(space => space.state === 'unknown');
  const health = initialLoading
    ? 'Loading health…'
    : issueCount
    ? `${issueCount} need attention`
    : partial
    ? 'Partial visibility'
    : empty
    ? 'No Capsule resources in this scope'
    : statusIncomplete
    ? 'Status incomplete'
    : totals.cordoned
    ? 'Resources cordoned'
    : 'Healthy';
  const healthColor = issueCount
    ? 'error'
    : initialLoading || partial || empty || statusIncomplete || totals.cordoned
    ? 'warning'
    : 'success';
  const versions = [
    ...new Set(
      snapshot.controllers
        .map(item => item.metadata.labels?.['app.kubernetes.io/version'])
        .filter(Boolean)
    ),
  ].join(', ');
  const twoColumns = {
    display: 'grid',
    gap: 2,
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 2fr)' },
  };
  const stateSegments = (items: ResourceData[]) => {
    const counts = summarize(items);
    return DASHBOARD_STATES.map(state => ({
      name: STATE_LABELS[state],
      value: counts[state],
      color: STATE_COLORS[state],
    }));
  };
  const tenantGroup = groups.find(group => group.kind === 'Tenant');
  const namespaceReady = spaces.filter(space => space.state === 'ready').length;
  const namespaceFailed = spaces.filter(space => space.state === 'failed').length;

  return (
    <Box sx={{ display: 'grid', gap: 2, px: { xs: 1, md: 2 }, pt: 2, pb: 8 }}>
      <Paper
        variant="outlined"
        sx={theme => ({
          p: 2.5,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.1
          )} 0%, transparent 60%)`,
        })}
      >
        <CapsuleIcon size={56} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Capsule
            </Typography>
            {versions && <Chip size="small" color="primary" label={versions} />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Multi-tenancy and namespace governance ·{' '}
            {snapshot.selectedTenants.length
              ? snapshot.selectedTenants.join(', ')
              : 'No Tenant Filter'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {snapshot.namespaces.length
              ? `Namespaces: ${snapshot.namespaces.join(', ')}`
              : 'All visible namespaces'}{' '}
            · Global resources remain cluster-wide
          </Typography>
        </Box>
        <Chip label={health} color={healthColor} variant="outlined" />
        <Button
          variant="outlined"
          size="small"
          startIcon={<Icon icon="mdi:refresh" />}
          disabled={snapshot.loading}
          onClick={snapshot.refresh}
        >
          {snapshot.loading && snapshot.updatedAt ? 'Refreshing…' : 'Refresh'}
        </Button>
        {snapshot.updatedAt && (
          <Typography variant="caption" color="text.secondary">
            Updated {new Date(snapshot.updatedAt).toLocaleTimeString()}
          </Typography>
        )}
      </Paper>
      {initialLoading && <LinearProgress aria-label="Loading Capsule dashboard" />}
      {partial && (
        <Alert severity="warning">
          Some resource lists are unavailable. Counts and health cover only readable resources.
          {unavailable.map(group => ` ${group.label}: ${group.error?.message}.`).join('')}
          {snapshot.controllerError ? ` Controllers: ${snapshot.controllerError.message}.` : ''}
          {snapshot.eventError ? ` Events: ${snapshot.eventError.message}.` : ''}
        </Alert>
      )}
      {!snapshot.loading && empty && !partial && (
        <Alert severity="info">
          No Capsule resources are visible. Check your cluster, Tenant and namespace selection.
        </Alert>
      )}
      <SummaryCardGrid columns={3} marginBottom={0}>
        {snapshot.controllers.map(controller => {
          const desired = controller.spec?.replicas ?? 1;
          const ready = controller.status?.readyReplicas || 0;
          const color = !desired ? 'info' : controllerReady(controller) ? 'success' : 'error';
          return (
            <Paper
              key={`${controller.cluster}/${controller.metadata.uid}`}
              variant="outlined"
              sx={{ p: 2, borderRadius: 2 }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconBadge icon="mdi:cog-sync-outline" tone={color} />
                <Box sx={{ minWidth: 0 }}>
                  <Link
                    routeName="deployment"
                    activeCluster={controller.cluster}
                    params={{
                      namespace: controller.metadata.namespace,
                      name: controller.metadata.name,
                    }}
                    sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                  >
                    {controller.metadata.name}
                  </Link>
                  <Typography variant="body2">
                    {!desired ? 'Scaled to zero' : `${ready}/${desired} ready`}
                  </Typography>
                </Box>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={!desired ? 0 : Math.min(100, (ready / desired) * 100)}
                color={color}
                sx={{ my: 1.5, height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                {controller.spec?.template?.spec?.containers?.[0]?.image?.split(':').pop()} ·{' '}
                {controller.metadata.namespace}
              </Typography>
            </Paper>
          );
        })}
      </SummaryCardGrid>
      {!snapshot.loading && !snapshot.controllerError && !snapshot.controllers.length && (
        <Alert severity="info">
          No Capsule controller deployments with the standard Capsule labels are visible to your
          user.
        </Alert>
      )}
      <SummaryCardGrid columns={4} marginBottom={0}>
        <StatCard
          label="TENANTS"
          total={tenantGroup?.items ? tenants.length : '…'}
          segments={stateSegments(tenants)}
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.Tenant }}
          footer={<Typography variant="caption">{summarize(tenants).cordoned} cordoned</Typography>}
        />
        <StatCard
          label="MANAGED NAMESPACES"
          total={spaces.length}
          routeName="namespaces"
          segments={[
            { name: 'Ready', value: namespaceReady, color: STATE_COLORS.ready },
            { name: 'Not Ready', value: namespaceFailed, color: STATE_COLORS.failed },
            {
              name: 'Unknown',
              value: spaces.length - namespaceReady - namespaceFailed,
              color: STATE_COLORS.unknown,
            },
          ]}
          footer={<Typography variant="caption">Tenant-reported namespace status</Typography>}
        />
        <StatCard
          label="QUOTA SYSTEMS"
          total={quotas.length}
          segments={stateSegments(quotas)}
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.GlobalResourceQuota }}
          footer={<Typography variant="caption">Pools, global and namespaced quotas</Typography>}
        />
        <StatCard
          label="MANAGED RESOURCES"
          total={managed.total}
          segments={[
            { name: 'Reported applied', value: managed.ready, color: STATE_COLORS.ready },
            { name: 'Reported failed', value: managed.failed, color: STATE_COLORS.failed },
            { name: 'Unknown', value: managed.unknown, color: STATE_COLORS.unknown },
          ]}
          routeName="map"
          routeSearch={{ group: 'tenant', show: 'all' }}
          footer={
            <Typography variant="caption">
              Controller-reported inventory, not live health
            </Typography>
          }
        />
      </SummaryCardGrid>
      <Box sx={twoColumns}>
        <Panel
          title="Needs attention"
          icon="mdi:bell-alert-outline"
          action={issueCount > 0 && <Chip label={issueCount} size="small" color="error" />}
        >
          <Stack spacing={1.5} sx={{ maxHeight: 380, overflow: 'auto' }}>
            {controllerIssues.map(controller => (
              <Box key={`${controller.cluster}/${controller.metadata.uid}`}>
                <Link
                  routeName="deployment"
                  activeCluster={controller.cluster}
                  params={{
                    name: controller.metadata.name,
                    namespace: controller.metadata.namespace,
                  }}
                >
                  {controller.metadata.name}
                </Link>
                <Typography variant="body2" color="text.secondary">
                  Controller replicas are not ready.
                </Typography>
              </Box>
            ))}
            {failures.map(item => (
              <Box
                key={`${item.cluster}/${
                  item.metadata.uid ||
                  `${item.kind}/${item.metadata.namespace}/${item.metadata.name}`
                }`}
                sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <ResourceLink item={item} />
                  <StateChip item={item} />
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {resourceMessage(item)}
                </Typography>
              </Box>
            ))}
            {namespaceFailures.map(space => (
              <Box key={`${space.tenant.cluster}/${space.name}`}>
                <Link
                  routeName="namespace"
                  activeCluster={space.tenant.cluster}
                  params={{ name: space.name }}
                >
                  {space.name}
                </Link>
                <Typography variant="body2" color="text.secondary">
                  {space.message}
                </Typography>
              </Box>
            ))}
            {!issueCount && (
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconBadge
                  icon="mdi:check-circle-outline"
                  tone={initialLoading || partial || statusIncomplete ? 'warning' : 'success'}
                />
                <Box>
                  <Typography variant="subtitle2">
                    {initialLoading
                      ? 'Checking resources…'
                      : partial || statusIncomplete
                      ? 'Visibility is incomplete'
                      : empty
                      ? 'No resources to assess'
                      : 'Nothing needs attention'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Controller readiness, Capsule conditions and quota capacity.
                  </Typography>
                </Box>
              </Stack>
            )}
          </Stack>
        </Panel>
        <Panel title="Tenant namespace readiness" icon="mdi:folder-check-outline">
          <Box sx={{ maxHeight: 380, overflow: 'auto' }}>
            {tenantRows.map(row => (
              <Box key={`${row.tenant.cluster}/${row.tenant.metadata.name}`} sx={{ mb: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <ResourceLink item={row.tenant} />
                  <Typography variant="body2">
                    {row.ready}/{row.spaces.length} ready
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={row.spaces.length ? (row.ready / row.spaces.length) * 100 : 0}
                  color={row.failed ? 'error' : 'success'}
                  sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {!row.spaces.length
                    ? 'No namespace status in this scope'
                    : `${row.failed} not ready · ${
                        row.spaces.length - row.ready - row.failed
                      } unknown`}
                </Typography>
              </Box>
            ))}
            {!tenantRows.length && (
              <Typography color="text.secondary">No visible Tenants.</Typography>
            )}
          </Box>
        </Panel>
      </Box>
      <Box sx={twoColumns}>
        <Panel title="Quota capacity" icon="mdi:gauge">
          <Stack spacing={1.5} sx={{ maxHeight: 320, overflow: 'auto' }}>
            {[...quotas]
              .sort((a, b) => (quotaPeak(b) ?? -1) - (quotaPeak(a) ?? -1))
              .map(item => {
                const peak = quotaPeak(item);
                return (
                  <Box
                    key={`${item.cluster}/${
                      item.metadata.uid || `${item.kind}/${item.metadata.name}`
                    }`}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <ResourceLink item={item} />
                      <Typography variant="body2">
                        {peak === undefined ? 'No usage reported' : `${peak.toFixed(1)}% peak`}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {item.kind}
                    </Typography>
                    {peak !== undefined && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, peak))}
                        color={peak >= 95 ? 'error' : peak >= 85 ? 'warning' : 'success'}
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                      />
                    )}
                  </Box>
                );
              })}
            {!quotas.length && (
              <Typography color="text.secondary">No quota systems in this scope.</Typography>
            )}
          </Stack>
        </Panel>
        <Panel title="Installation" icon="mdi:tune-variant">
          <Stack spacing={1}>
            <Typography variant="body2">
              Controller namespaces:{' '}
              {[...new Set(snapshot.controllers.map(item => item.metadata.namespace))].join(', ') ||
                '—'}
            </Typography>
            <Typography variant="body2">
              Visible resource types:{' '}
              {groups.filter(group => group.items && !group.missing && !group.error).length}
            </Typography>
            <Typography variant="body2">
              Controllers:{' '}
              {snapshot.controllers.filter(item => (item.spec?.replicas ?? 1) > 0).length} active ·{' '}
              {snapshot.controllers.filter(item => item.spec?.replicas === 0).length} scaled to zero
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {DASHBOARD_STATES.filter(state => totals[state] > 0).map(state => (
                <Chip key={state} size="small" label={`${totals[state]} ${STATE_LABELS[state]}`} />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Replicated object counts come from Capsule status. Open the resource detail for live
              object inspection.
            </Typography>
          </Stack>
        </Panel>
      </Box>
      <Panel
        title="Resources"
        icon="mdi:view-grid-outline"
        action={
          <TextField
            select
            size="small"
            label="Show"
            value={show}
            onChange={event => {
              setShow(event.target.value);
              localStorage.setItem('capsule.overview.show', event.target.value);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="configured">Configured</MenuItem>
            <MenuItem value="all">All types</MenuItem>
          </TextField>
        }
      >
        <SummaryCardGrid columns={4} marginBottom={0}>
          {['Tenancy', 'Quotas', 'Replications', 'Proxy & settings'].map(category => (
            <Box key={category}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {category}
              </Typography>
              <Stack spacing={1}>
                {groups
                  .filter(
                    group =>
                      group.category === category &&
                      (show === 'all' || !group.items || group.items.length || group.error)
                  )
                  .map(group => {
                    const counts = summarize(group.items || []);
                    return (
                      <Link
                        key={group.id}
                        routeName="customresources"
                        params={{ crd: group.crd }}
                        sx={{
                          textDecoration: 'none',
                          color: 'inherit',
                          '&:hover': { textDecoration: 'none' },
                        }}
                      >
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Icon icon={group.icon} width={22} />
                            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                              {group.label}
                            </Typography>
                            <Typography variant="h6">{group.items ? counts.total : '…'}</Typography>
                          </Stack>
                          <Typography
                            variant="caption"
                            color={counts.failed ? 'error.main' : 'text.secondary'}
                          >
                            {group.missing
                              ? 'API not installed'
                              : group.error
                              ? 'Unavailable'
                              : !group.items
                              ? 'Loading…'
                              : `${counts.ready} ready · ${counts.failed} not ready${
                                  counts.unknown ? ` · ${counts.unknown} unknown` : ''
                                }${counts.cordoned ? ` · ${counts.cordoned} cordoned` : ''}`}
                          </Typography>
                        </Paper>
                      </Link>
                    );
                  })}
              </Stack>
            </Box>
          ))}
        </SummaryCardGrid>
      </Panel>
      <CapsuleEvents events={snapshot.events} error={snapshot.eventError} />
    </Box>
  );
}
