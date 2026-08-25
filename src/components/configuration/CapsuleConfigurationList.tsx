import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CapsuleConfiguration } from '../../resources/capsuleConfigurations';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import {
  capsuleConfigurationMessage,
  capsuleConfigurationReconciledUsers,
  type CapsuleConfigurationState,
  capsuleConfigurationState,
  capsuleConfigurationTenants,
  capsuleConfigurationWebhookRows,
  summarizeCapsuleConfigurations,
} from './capsuleConfigurationHelpers';

export function CapsuleConfigurationHealthChip({ state }: { state: CapsuleConfigurationState }) {
  const colors: Record<CapsuleConfigurationState, 'error' | 'info' | 'success' | 'warning'> = {
    'Not Ready': 'error',
    Ready: 'success',
    Reconciling: 'warning',
    Unknown: 'info',
  };
  return <Chip size="small" label={state} color={colors[state]} />;
}

export function CapsuleConfigurationList() {
  const [items, error] = CapsuleConfiguration.useList();
  const summary = useMemo(() => summarizeCapsuleConfigurations(items), [items]);

  if (error) {
    return (
      <SectionBox title="Capsule Configuration">
        <Alert severity="info">
          CapsuleConfiguration is unavailable. Install Capsule or grant this account access to{' '}
          <code>capsuleconfigurations.capsule.clastix.io</code>.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <>
      <SummaryCardGrid columns={4} marginBottom={2} inset>
        <StatCard
          label="CONFIGURATION HEALTH"
          total={summary.total}
          segments={[
            { name: 'Ready', value: summary.ready, color: '#4caf50' },
            { name: 'Reconciling', value: summary.reconciling, color: '#ff9800' },
            { name: 'Not Ready', value: summary.notReady, color: '#f44336' },
            { name: 'Unknown', value: summary.unknown, color: '#1976d2' },
          ]}
          chips={[
            { label: `${summary.ready} Ready`, color: 'success' },
            { label: `${summary.reconciling} Reconciling`, color: 'warning' },
            { label: `${summary.notReady} Not Ready`, color: 'error' },
            { label: `${summary.unknown} Unknown`, color: 'info' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Controller reconciliation and generation health
            </Typography>
          }
        />
        <StatCard
          label="MANAGED TENANTS"
          total={summary.tenants}
          segments={[{ name: 'Tenants', value: summary.tenants, color: '#1976d2' }]}
          chips={[{ label: `${summary.tenants} Reported`, color: 'primary' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Tenants reported in configuration status
            </Typography>
          }
        />
        <StatCard
          label="RECONCILED IDENTITIES"
          total={summary.identities}
          segments={[
            { name: 'Users', value: summary.users, color: '#1976d2' },
            { name: 'Groups', value: summary.groups, color: '#7b1fa2' },
            { name: 'Service Accounts', value: summary.serviceAccounts, color: '#00897b' },
          ]}
          chips={[
            { label: `${summary.users} Users`, color: 'primary' },
            { label: `${summary.groups} Groups`, color: 'info' },
            { label: `${summary.serviceAccounts} Service Accounts`, color: 'info' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Effective users known to Capsule
            </Typography>
          }
        />
        <StatCard
          label="ADMISSION WEBHOOKS"
          total={summary.webhooks}
          segments={[
            { name: 'Mutating', value: summary.mutatingWebhooks, color: '#1976d2' },
            { name: 'Validating', value: summary.validatingWebhooks, color: '#7b1fa2' },
          ]}
          chips={[
            { label: `${summary.mutatingWebhooks} Mutating`, color: 'primary' },
            { label: `${summary.validatingWebhooks} Validating`, color: 'info' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Dynamic Capsule admission handlers
            </Typography>
          }
        />
      </SummaryCardGrid>

      <ResourceListView
        id="capsule-configurations"
        title="Capsule Configuration"
        resourceClass={CapsuleConfiguration}
        headerProps={anchoredResourceListHeaderProps('Capsule Configuration')}
        defaultSortingColumn={{ id: 'name', desc: false }}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.CapsuleConfiguration} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'health',
            label: 'Health',
            getValue: item => capsuleConfigurationState(item),
            render: item => (
              <CapsuleConfigurationHealthChip state={capsuleConfigurationState(item)} />
            ),
            filterVariant: 'select',
          },
          {
            id: 'message',
            label: 'Message',
            getValue: item => capsuleConfigurationMessage(item),
          },
          {
            id: 'generation',
            label: 'Generation',
            getValue: item => item.metadata?.generation || 0,
            render: item => (
              <Typography variant="body2">
                {item.status?.observedGeneration ?? '—'} / {item.metadata?.generation ?? '—'}
              </Typography>
            ),
          },
          {
            id: 'tenants',
            label: 'Managed Tenants',
            getValue: item => capsuleConfigurationTenants(item).length,
            render: item => (
              <Chip size="small" label={capsuleConfigurationTenants(item).length} color="primary" />
            ),
          },
          {
            id: 'identities',
            label: 'Identities',
            getValue: item => capsuleConfigurationReconciledUsers(item).length,
            render: item => (
              <Chip
                size="small"
                label={capsuleConfigurationReconciledUsers(item).length}
                color="info"
              />
            ),
          },
          {
            id: 'webhooks',
            label: 'Admission Webhooks',
            getValue: item => capsuleConfigurationWebhookRows(item).length,
            render: item => (
              <Chip size="small" label={capsuleConfigurationWebhookRows(item).length} />
            ),
          },
          {
            id: 'events-namespace',
            label: 'Events Namespace',
            getValue: item => item.spec?.events?.namespace || '',
          },
          'age',
        ]}
      />
    </>
  );
}

export default CapsuleConfigurationList;
