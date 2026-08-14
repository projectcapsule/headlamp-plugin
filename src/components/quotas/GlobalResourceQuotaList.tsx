import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { GlobalResourceQuota } from '../../resources/globalResourceQuotas';
import { usageChipColor } from '../../utils/quantity';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { QuotaMetricSummary } from '../common/QuotaMetricSummary';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import {
  globalResourceQuotaMetrics,
  globalResourceQuotaNamespaces,
  globalResourceQuotaPeakUsage,
  summarizeGlobalResourceQuotas,
} from './globalResourceQuotaHelpers';

function readyCondition(item: any) {
  return item.status?.conditions?.find((condition: any) => condition.type === 'Ready');
}

export function GlobalResourceQuotasList() {
  const [items] = GlobalResourceQuota.useList();
  const summary = useMemo(() => summarizeGlobalResourceQuotas(items), [items]);

  return (
    <>
      <SummaryCardGrid columns={3} marginBottom={2} inset>
        <StatCard
          label="GLOBAL RESOURCE QUOTAS"
          total={summary.total}
          segments={[
            { name: 'Ready', value: summary.readiness.ready, color: '#4caf50' },
            { name: 'Not Ready', value: summary.readiness.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${summary.readiness.ready} Ready`, color: 'success' },
            { label: `${summary.readiness.notReady} Not Ready`, color: 'error' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Capsule quota readiness
            </Typography>
          }
        />
        <StatCard
          label="CAPACITY HEALTH"
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
            <Typography variant="caption" color="text.secondary">
              Highest resource utilization per quota
            </Typography>
          }
        />
        <StatCard
          label="NAMESPACES IN SCOPE"
          total={summary.namespaces}
          segments={[{ name: 'Namespaces', value: summary.namespaces, color: '#1976d2' }]}
          chips={[
            {
              label: `${summary.namespaces} namespace${summary.namespaces === 1 ? '' : 's'}`,
              color: 'primary',
            },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Current namespace consumers
            </Typography>
          }
        />
      </SummaryCardGrid>

      <ResourceListView
        title="Global Resource Quotas"
        resourceClass={GlobalResourceQuota}
        defaultSortingColumn={{ id: 'name', desc: false }}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.GlobalResourceQuota} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item => String(readyCondition(item)?.status || 'Unknown'),
            render: item => {
              const condition = readyCondition(item);
              return <ConditionStatusChip status={condition?.status} type="Ready" />;
            },
          },
          {
            id: 'namespaces',
            label: 'Namespaces',
            getValue: item =>
              Number(item.status?.namespaceCount) || globalResourceQuotaNamespaces(item).length,
          },
          {
            id: 'peak-usage',
            label: 'Peak Usage',
            getValue: item => globalResourceQuotaPeakUsage(item),
            render: item => {
              const metrics = globalResourceQuotaMetrics(item);
              const peak = globalResourceQuotaPeakUsage(item);
              return metrics.length > 0 ? (
                <Chip size="small" label={`${peak.toFixed(1)}%`} color={usageChipColor(peak)} />
              ) : (
                <Chip size="small" label="No limits" />
              );
            },
          },
          {
            id: 'usage',
            label: 'Usage by Resource',
            getValue: item =>
              globalResourceQuotaMetrics(item)
                .map(metric => `${metric.resource} ${metric.used}/${metric.hard}`)
                .join(' '),
            render: item => <QuotaMetricSummary metrics={globalResourceQuotaMetrics(item)} />,
          },
          {
            id: 'selectors',
            label: 'Selectors',
            getValue: item => (item.spec?.namespaceSelectors || []).length,
            render: item => {
              const count = (item.spec?.namespaceSelectors || []).length;
              return <Chip size="small" label={`${count} selector${count === 1 ? '' : 's'}`} />;
            },
          },
          'age',
        ]}
      />
    </>
  );
}

export default GlobalResourceQuotasList;
