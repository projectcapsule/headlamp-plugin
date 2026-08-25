import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { GlobalProxySettings } from '../../resources/globalProxySettings';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import {
  globalProxyClusterResourceCount,
  globalProxyReadyCondition,
  globalProxyRules,
  globalProxySubjects,
  summarizeGlobalProxySettings,
} from './globalProxySettingsHelpers';

export function GlobalProxySettingsList() {
  const [items, error] = GlobalProxySettings.useList();
  const summary = useMemo(() => summarizeGlobalProxySettings(items), [items]);

  if (error) {
    return (
      <SectionBox title="Global Proxy Settings">
        <Alert severity="info">
          The GlobalProxySettings API is unavailable. Install Capsule Proxy or grant this account
          access to <code>globalproxysettings.capsule.clastix.io</code>.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <>
      <SummaryCardGrid columns={3} marginBottom={2} inset>
        <StatCard
          label="GLOBAL PROXY SETTINGS"
          total={summary.total}
          segments={[
            { name: 'Ready', value: summary.ready, color: '#4caf50' },
            { name: 'Not Ready', value: summary.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${summary.ready} Ready`, color: 'success' },
            { label: `${summary.notReady} Not Ready`, color: 'error' },
          ]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Capsule Proxy reconciliation
            </Typography>
          }
        />
        <StatCard
          label="SUBJECTS"
          total={summary.subjects}
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
              Unique identities receiving proxy access
            </Typography>
          }
        />
        <StatCard
          label="PROXY RULES"
          total={summary.rules}
          segments={[
            { name: 'Cluster Resources', value: summary.clusterResources, color: '#1976d2' },
          ]}
          chips={[{ label: `${summary.clusterResources} Cluster Resources`, color: 'primary' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Label-filtered cluster resource grants
            </Typography>
          }
        />
      </SummaryCardGrid>

      <ResourceListView
        id="capsule-global-proxy-settings"
        title="Global Proxy Settings"
        resourceClass={GlobalProxySettings}
        headerProps={anchoredResourceListHeaderProps('Global Proxy Settings')}
        defaultSortingColumn={{ id: 'name', desc: false }}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.GlobalProxySettings} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item => String(globalProxyReadyCondition(item)?.status || 'Unknown'),
            render: item => (
              <ConditionStatusChip status={globalProxyReadyCondition(item)?.status} type="Ready" />
            ),
            filterVariant: 'select',
          },
          {
            id: 'message',
            label: 'Message',
            getValue: item =>
              globalProxyReadyCondition(item)?.message ||
              globalProxyReadyCondition(item)?.reason ||
              '',
          },
          {
            id: 'rules',
            label: 'Rules',
            getValue: item => globalProxyRules(item).length,
            render: item => <Chip size="small" label={globalProxyRules(item).length} />,
          },
          {
            id: 'subjects',
            label: 'Subjects',
            getValue: item => globalProxySubjects(item).length,
            render: item => <Chip size="small" label={globalProxySubjects(item).length} />,
          },
          {
            id: 'cluster-resources',
            label: 'Cluster Resources',
            getValue: item => globalProxyClusterResourceCount(item),
            render: item => <Chip size="small" label={globalProxyClusterResourceCount(item)} />,
          },
          'age',
        ]}
      />
    </>
  );
}

export default GlobalProxySettingsList;
