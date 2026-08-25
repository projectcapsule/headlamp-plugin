import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
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
import { TenantQuotaFlow } from './TenantQuotaFlow';
import {
  TENANT_QUOTA_LABEL,
  tenantQuotaResources,
  tenantQuotaSystems,
  type TenantQuotaUsageRow,
  tenantQuotaUsageRows,
} from './tenantQuotaOverviewHelpers';

export function TenantQuotaOverview({ tenant }: { tenant?: any }) {
  const tenantName = tenant?.getName?.() || tenant?.jsonData?.metadata?.name || '';
  const cluster = tenant?.cluster;
  const [customQuotas] = CustomQuota.useList({ cluster });
  const [globalCustomQuotas] = GlobalCustomQuota.useList({ cluster });
  const [globalResourceQuotas] = GlobalResourceQuota.useList({ cluster });
  const [resourcePools] = ResourcePool.useList({ cluster });
  const location = useLocation();
  const history = useHistory();
  const systems = useMemo(
    () =>
      tenantQuotaSystems(tenantName, {
        customQuotas,
        globalCustomQuotas,
        globalResourceQuotas,
        resourcePools,
      }),
    [customQuotas, globalCustomQuotas, globalResourceQuotas, resourcePools, tenantName]
  );
  const resources = useMemo(() => tenantQuotaResources(systems), [systems]);
  const selectedResource = quotaResourceFromSearch(location.search, resources);
  const rows = useMemo(
    () => tenantQuotaUsageRows(systems, selectedResource),
    [selectedResource, systems]
  );
  const visibleSystemCount = useMemo(
    () =>
      systems.filter(
        system =>
          selectedResource === ALL_QUOTA_RESOURCES || system.resources.includes(selectedResource)
      ).length,
    [selectedResource, systems]
  );
  const selectResource = (resource: string) =>
    history.replace({
      ...location,
      search: quotaResourceSearch(location.search, resource),
    });

  return (
    <SectionBox title="Quota Overview">
      <Stack spacing={2.5}>
        <Stack
          alignItems={{ xs: 'stretch', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Typography variant="body2" color="text.secondary">
            Quota systems labeled{' '}
            <code>
              {TENANT_QUOTA_LABEL}={tenantName}
            </code>
            .
          </Typography>
          <FormControl disabled={resources.length === 0} size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="tenant-quota-resource-label">Allocation type</InputLabel>
            <Select
              inputProps={{ 'aria-label': 'Tenant quota allocation type' }}
              label="Allocation type"
              labelId="tenant-quota-resource-label"
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

        {systems.length === 0 ? (
          <Typography color="text.secondary">
            No Capsule quota resource is labeled for this Tenant.
          </Typography>
        ) : visibleSystemCount === 0 ? (
          <Typography color="text.secondary">
            No labeled quota system exposes the selected allocation type.
          </Typography>
        ) : (
          <TenantQuotaFlow
            selectedResource={selectedResource}
            systems={systems}
            tenantName={tenantName}
          />
        )}

        <Box>
          <AnchoredSubheading
            title="Quota resource usage"
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 0.25 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            One row per resource and labeled quota system, sorted by highest utilization.
          </Typography>
          <SimpleTable
            columns={[
              {
                label: 'Quota System',
                getter: (row: TenantQuotaUsageRow) => (
                  <Stack spacing={0.1}>
                    <Typography variant="caption" color="text.secondary">
                      {row.system.kind}
                    </Typography>
                    <Typography variant="body2">
                      <CapsuleResourceLink
                        crd={row.system.crd}
                        name={row.system.name}
                        namespace={row.system.namespace}
                      >
                        {row.system.name}
                      </CapsuleResourceLink>
                    </Typography>
                  </Stack>
                ),
                sort: (row: TenantQuotaUsageRow) => `${row.system.kind}/${row.system.name}`,
              },
              { label: 'Resource', getter: (row: TenantQuotaUsageRow) => row.resource },
              {
                label: 'Used',
                getter: (row: TenantQuotaUsageRow) => (
                  <QuotaUsage used={row.used} limit={row.hard} size={20} />
                ),
                sort: (row: TenantQuotaUsageRow) => row.percent,
              },
              { label: 'Hard', getter: (row: TenantQuotaUsageRow) => row.hard },
              { label: 'Available', getter: (row: TenantQuotaUsageRow) => row.available },
              {
                label: 'Utilization',
                getter: (row: TenantQuotaUsageRow) => (
                  <Chip
                    color={usageChipColor(row.percent)}
                    label={`${row.percent.toFixed(1)}%`}
                    size="small"
                  />
                ),
                sort: (row: TenantQuotaUsageRow) => row.percent,
              },
              {
                label: 'Namespaces in Scope',
                getter: (row: TenantQuotaUsageRow) => (
                  <Chip
                    color="primary"
                    label={row.namespaceCount}
                    size="small"
                    variant="outlined"
                  />
                ),
                sort: (row: TenantQuotaUsageRow) => row.namespaceCount,
              },
            ]}
            data={rows}
            defaultSortingColumn={-6}
            emptyMessage="No quota usage is reported for the selected allocation type."
            reflectInURL={false}
          />
        </Box>
      </Stack>
    </SectionBox>
  );
}

export default TenantQuotaOverview;
