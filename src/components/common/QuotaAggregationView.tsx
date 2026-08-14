import { Link, SectionBox, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
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
import { usageChipColor } from '../../utils/quantity';
import {
  ALL_QUOTA_RESOURCES,
  compareQuotaUtilizationDescending,
  filterQuotaMetrics,
  type QuotaAggregationData,
  quotaMetricPeak,
  quotaResourceFromSearch,
  quotaResourceSearch,
} from './quotaAggregation';
import { QuotaConsumptionFlow } from './QuotaConsumptionFlow';
import { QuotaUsage } from './QuotaUsage';

export function QuotaAggregationView({
  cluster,
  data,
  namespaceEmptyMessage = 'No namespace consumption has been reported for this quota yet.',
}: {
  cluster?: string;
  data: QuotaAggregationData;
  namespaceEmptyMessage?: string;
}) {
  const location = useLocation();
  const history = useHistory();
  const resources = useMemo(
    () =>
      [...new Set(data.metrics.map(metric => metric.resource))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [data.metrics]
  );
  const selectedResource = quotaResourceFromSearch(location.search, resources);
  const metrics = useMemo(
    () =>
      filterQuotaMetrics(data.metrics, selectedResource)
        .slice()
        .sort(compareQuotaUtilizationDescending),
    [data.metrics, selectedResource]
  );
  const rows = useMemo(
    () =>
      data.namespaces
        .map(namespace => {
          const namespaceMetrics = filterQuotaMetrics(namespace.metrics, selectedResource);
          return {
            metrics: namespaceMetrics,
            namespace: namespace.namespace,
            peak: quotaMetricPeak(namespaceMetrics),
          };
        })
        .sort(compareQuotaUtilizationDescending),
    [data.namespaces, selectedResource]
  );
  const singleResource = selectedResource !== ALL_QUOTA_RESOURCES;
  const selectResource = (resource: string) => {
    history.replace({
      ...location,
      search: quotaResourceSearch(location.search, resource),
    });
  };

  return (
    <>
      <SectionBox title="Aggregate Usage">
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              Show all reported resources or focus the tables and namespace graph on one resource.
            </Typography>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="quota-resource-filter-label">Resource</InputLabel>
              <Select
                labelId="quota-resource-filter-label"
                label="Resource"
                value={selectedResource}
                onChange={event => selectResource(event.target.value)}
                inputProps={{ 'aria-label': 'Quota resource' }}
              >
                <MenuItem value={ALL_QUOTA_RESOURCES}>All resources</MenuItem>
                {resources.map(resource => (
                  <MenuItem key={resource} value={resource}>
                    {resource}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <SimpleTable
            columns={[
              { label: 'Resource', getter: (metric: any) => metric.resource },
              {
                label: 'Used',
                getter: (metric: any) => (
                  <QuotaUsage used={metric.used} limit={metric.hard} size={20} />
                ),
                sort: (metric: any) => metric.percent,
              },
              { label: 'Hard', getter: (metric: any) => metric.hard },
              { label: 'Available', getter: (metric: any) => metric.available },
              {
                label: 'Utilization',
                getter: (metric: any) => (
                  <Chip
                    size="small"
                    label={`${metric.percent.toFixed(1)}%`}
                    color={usageChipColor(metric.percent)}
                  />
                ),
                sort: (metric: any) => metric.percent,
              },
            ]}
            data={metrics}
            defaultSortingColumn={-5}
            emptyMessage="No aggregate quota usage has been reported."
            reflectInURL={false}
          />
        </Stack>
      </SectionBox>

      <SectionBox title="Namespace Consumption">
        {data.namespaces.length === 0 ? (
          <Typography color="text.secondary">{namespaceEmptyMessage}</Typography>
        ) : (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {singleResource
                  ? `Percentages show each namespace's utilization of ${selectedResource}.`
                  : `Percentages are calculated independently for every resource; each badge shows the namespace's highest utilization.`}
              </Typography>
              <QuotaConsumptionFlow data={data} selectedResource={selectedResource} />
            </Box>
            <SimpleTable
              columns={[
                {
                  label: 'Namespace',
                  getter: (row: any) => (
                    <Link
                      routeName="namespace"
                      params={{ name: row.namespace }}
                      activeCluster={cluster}
                      tooltip
                    >
                      {row.namespace}
                    </Link>
                  ),
                },
                {
                  label: singleResource ? 'Usage' : 'Usage by Resource',
                  getter: (row: any) =>
                    row.metrics.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        No usage reported
                      </Typography>
                    ) : (
                      <Stack spacing={0.35} sx={{ py: 0.5 }}>
                        {row.metrics.map((metric: any) => (
                          <Stack
                            key={metric.resource}
                            direction="row"
                            spacing={1}
                            justifyContent="space-between"
                          >
                            <Typography variant="caption" color="text.secondary">
                              {metric.resource}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 650 }}>
                              {metric.used} / {metric.hard}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    ),
                  sort: (row: any) =>
                    row.metrics.map((metric: any) => `${metric.resource}:${metric.used}`).join(' '),
                },
                {
                  label: singleResource ? 'Utilization' : 'Peak Usage',
                  getter: (row: any) =>
                    row.metrics.length > 0 ? (
                      <Chip
                        size="small"
                        label={`${row.peak.toFixed(1)}%`}
                        color={usageChipColor(row.peak)}
                      />
                    ) : (
                      <Chip size="small" label="Not reported" />
                    ),
                  sort: (row: any) => (row.metrics.length > 0 ? row.peak : -1),
                },
              ]}
              data={rows}
              defaultSortingColumn={-3}
              emptyMessage="No namespace consumption has been reported."
              reflectInURL={false}
            />
          </Stack>
        )}
      </SectionBox>
    </>
  );
}

export default QuotaAggregationView;
