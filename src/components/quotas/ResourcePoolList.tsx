import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { ResourcePool } from '../../resources/resourcePools';
import { usageChipColor } from '../../utils/quantity';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { QuotaMetricSummary } from '../common/QuotaMetricSummary';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import {
  resourcePoolAllocationMetrics,
  resourcePoolNamespaces,
  resourcePoolPeakUsage,
  summarizeResourcePools,
} from './resourcePoolHelpers';

function poolCondition(item: any, type: string) {
  return item.status?.conditions?.find((condition: any) => condition.type === type);
}

export function ResourcePoolsList() {
  const [items] = ResourcePool.useList();
  const summary = useMemo(() => summarizeResourcePools(items), [items]);

  return (
    <>
      <SummaryCardGrid columns={4} marginBottom={2} inset>
        <StatCard
          label="RESOURCE POOLS"
          total={summary.total}
          segments={[
            { name: 'Ready', value: summary.readiness.ready, color: '#4caf50' },
            { name: 'Not Ready', value: summary.readiness.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${summary.readiness.ready} Ready`, color: 'success' },
            { label: `${summary.readiness.notReady} Not Ready`, color: 'error' },
          ]}
          footer={<Typography variant="caption">Capsule reconciliation status</Typography>}
        />
        <StatCard
          label="ALLOCATION HEALTH"
          total={summary.total}
          segments={[
            { name: 'Healthy', value: summary.capacity.healthy, color: '#4caf50' },
            { name: 'Warning', value: summary.capacity.warning, color: '#ff9800' },
            { name: 'Critical', value: summary.capacity.critical, color: '#f44336' },
          ]}
          chips={[
            { label: `${summary.capacity.healthy} Healthy`, color: 'success' },
            { label: `${summary.capacity.warning} Warning`, color: 'warning' },
            { label: `${summary.capacity.critical} Critical`, color: 'error' },
          ]}
          footer={
            <Typography variant="caption">
              {summary.exhausted} exhausted pool{summary.exhausted === 1 ? '' : 's'}
            </Typography>
          }
        />
        <StatCard
          label="BOUND CLAIMS"
          total={summary.claims}
          segments={[{ name: 'Claims', value: summary.claims, color: '#7b1fa2' }]}
          chips={[{ label: `${summary.claims} allocated`, color: 'primary' }]}
          footer={<Typography variant="caption">Claims consuming pool allocation</Typography>}
        />
        <StatCard
          label="NAMESPACES IN SCOPE"
          total={summary.namespaces}
          segments={[{ name: 'Namespaces', value: summary.namespaces, color: '#1976d2' }]}
          chips={[{ label: `${summary.namespaces} selected`, color: 'primary' }]}
          footer={<Typography variant="caption">Eligible namespace consumers</Typography>}
        />
      </SummaryCardGrid>

      <ResourceListView
        title="Resource Pools"
        resourceClass={ResourcePool}
        defaultSortingColumn={{ id: 'peak-usage', desc: true }}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.ResourcePool} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item => String(poolCondition(item, 'Ready')?.status || 'Unknown'),
            render: item => (
              <ConditionStatusChip status={poolCondition(item, 'Ready')?.status} type="Ready" />
            ),
          },
          {
            id: 'exhausted',
            label: 'Exhausted',
            getValue: item => String(poolCondition(item, 'Exhausted')?.status || 'Unknown'),
            render: item => (
              <ConditionStatusChip
                status={poolCondition(item, 'Exhausted')?.status}
                type="Exhausted"
              />
            ),
          },
          {
            id: 'claims',
            label: 'Bound Claims',
            getValue: item => Number(item.status?.claimCount) || 0,
          },
          {
            id: 'namespaces',
            label: 'Namespaces',
            getValue: item =>
              Number(item.status?.namespaceCount) || resourcePoolNamespaces(item).length,
          },
          {
            id: 'peak-usage',
            label: 'Peak Usage',
            getValue: item => resourcePoolPeakUsage(item),
            render: item => {
              const metrics = resourcePoolAllocationMetrics(item);
              const peak = resourcePoolPeakUsage(item);
              return metrics.length > 0 ? (
                <Chip size="small" label={`${peak.toFixed(1)}%`} color={usageChipColor(peak)} />
              ) : (
                <Chip size="small" label="No limits" />
              );
            },
          },
          {
            id: 'allocation',
            label: 'Allocation by Resource',
            getValue: item =>
              resourcePoolAllocationMetrics(item)
                .map(metric => `${metric.resource} ${metric.used}/${metric.hard}`)
                .join(' '),
            render: item => <QuotaMetricSummary metrics={resourcePoolAllocationMetrics(item)} />,
          },
          {
            id: 'selectors',
            label: 'Selectors',
            getValue: item => (item.spec?.selectors || []).length,
            render: item => {
              const count = (item.spec?.selectors || []).length;
              return <Chip size="small" label={`${count} selector${count === 1 ? '' : 's'}`} />;
            },
          },
          'age',
        ]}
      />
    </>
  );
}

export default ResourcePoolsList;
