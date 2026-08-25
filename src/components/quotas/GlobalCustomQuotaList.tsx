import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { GlobalCustomQuota } from '../../resources/customQuotas';
import { usagePercent, usageSeverity } from '../../utils/quantity';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { QuotaUsage } from '../common/QuotaUsage';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';

export function GlobalCustomQuotasList() {
  const [items] = GlobalCustomQuota.useList();

  const health = useMemo(() => {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    (items || []).forEach(item => {
      const p = usagePercent(item.status?.usage?.used, item.spec?.limit);
      const severity = usageSeverity(p);
      if (severity === 'critical') critical++;
      else if (severity === 'warning') warning++;
      else healthy++;
    });
    const total = items?.length || 0;
    const namespaces = (items || []).reduce((totalNamespaces, item) => {
      const referenced = new Set([
        ...(item.status?.namespaces || []),
        ...(item.status?.claims || []).map(claim => claim.namespace).filter(Boolean),
      ]);
      return totalNamespaces + referenced.size;
    }, 0);
    return { healthy, warning, critical, total, namespaces };
  }, [items]);

  return (
    <>
      <SummaryCardGrid columns={2} marginBottom={2} inset>
        <StatCard
          label="GLOBAL CUSTOM QUOTAS"
          total={health.total}
          segments={[
            { name: 'Healthy', value: health.healthy, color: '#4caf50' },
            { name: 'Warning', value: health.warning, color: '#ff9800' },
            { name: 'Critical', value: health.critical, color: '#f44336' },
          ]}
          chips={[
            { label: `${health.healthy} Healthy`, color: 'success' },
            { label: `${health.warning} Warning`, color: 'warning' },
            { label: `${health.critical} Critical`, color: 'error' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Based on usage % (healthy &lt;85%)
            </Typography>
          }
        />
        <StatCard
          label="NAMESPACES IN SCOPE"
          total={health.namespaces}
          segments={[{ name: 'Namespaces', value: health.namespaces, color: '#1976d2' }]}
          chips={[
            {
              label: `${health.namespaces} namespace reference${
                health.namespaces === 1 ? '' : 's'
              }`,
              color: 'info',
            },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Across all GlobalCustomQuotas
            </Typography>
          }
        />
      </SummaryCardGrid>

      <ResourceListView
        id="capsule-global-custom-quotas"
        title="Global Custom Quotas"
        resourceClass={GlobalCustomQuota}
        headerProps={anchoredResourceListHeaderProps('Global Custom Quotas')}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.GlobalCustomQuota} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'limit',
            label: 'Limit',
            getValue: item => item.spec?.limit || '',
          },
          {
            id: 'used',
            label: 'Used',
            getValue: item => item.status?.usage?.used || '0',
            render: item => (
              <QuotaUsage used={item.status?.usage?.used} limit={item.spec?.limit} size={18} />
            ),
          },
          {
            id: 'available',
            label: 'Available',
            getValue: item => item.status?.usage?.available || '',
          },
          {
            id: 'namespaces',
            label: 'Namespaces',
            getValue: item =>
              new Set([
                ...(item.status?.namespaces || []),
                ...(item.status?.claims || []).map(claim => claim.namespace).filter(Boolean),
              ]).size,
          },
          {
            id: 'sources',
            label: 'Sources',
            getValue: item => (item.spec?.sources || []).length,
            render: item => {
              const count = (item.spec?.sources || []).length;
              return <Chip size="small" label={`${count} source${count === 1 ? '' : 's'}`} />;
            },
          },
          'age',
        ]}
      />
    </>
  );
}
