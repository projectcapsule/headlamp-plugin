import { SectionBox, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CapsuleConfiguration } from '../../resources/capsuleConfigurations';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import {
  type CapsuleConfigurationIdentityRow,
  capsuleConfigurationIdentityRows,
  capsuleConfigurationReconciledUsers,
  capsuleConfigurationState,
  capsuleConfigurationTenants,
  type CapsuleConfigurationWebhookRow,
  capsuleConfigurationWebhookRows,
} from './capsuleConfigurationHelpers';
import { CapsuleConfigurationHealthChip } from './CapsuleConfigurationList';

export interface CapsuleConfigurationDetailProps {
  name?: string;
}

interface ConfigurationValueRow {
  key: string;
  value: React.ReactNode;
}

function booleanChip(value: boolean | undefined) {
  if (value === undefined) {
    return <Chip size="small" label="Not configured" color="info" variant="outlined" />;
  }
  return (
    <Chip size="small" label={value ? 'Enabled' : 'Disabled'} color={value ? 'success' : 'info'} />
  );
}

function stringChips(values: string[] | undefined, empty = 'None') {
  if (!values?.length) return <Typography color="text.secondary">{empty}</Typography>;
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5}>
      {values.map(value => (
        <Chip key={value} size="small" label={value} variant="outlined" />
      ))}
    </Stack>
  );
}

function ConfigurationTable({ rows }: { rows: ConfigurationValueRow[] }) {
  return (
    <SimpleTable
      columns={[
        { label: 'Setting', getter: (row: ConfigurationValueRow) => row.key },
        { label: 'Value', getter: (row: ConfigurationValueRow) => row.value },
      ]}
      data={rows}
      emptyMessage="No configuration values."
      reflectInURL={false}
    />
  );
}

export function CapsuleConfigurationDetail(props: CapsuleConfigurationDetailProps) {
  const params = useParams<{ crName?: string; name?: string }>();
  const name = props.name || params.crName || params.name || '';
  const [configuration, error] = CapsuleConfiguration.useGet(name);
  const webhooks = useMemo(() => capsuleConfigurationWebhookRows(configuration), [configuration]);
  const identities = useMemo(
    () => capsuleConfigurationIdentityRows(configuration),
    [configuration]
  );
  const tenants = useMemo(() => capsuleConfigurationTenants(configuration), [configuration]);

  if (error) {
    return (
      <SectionBox title={`Capsule Configuration: ${name}`}>
        <Alert severity="info">
          CapsuleConfiguration is unavailable or this account cannot read it.
        </Alert>
      </SectionBox>
    );
  }

  const spec = configuration?.spec;
  const featureRows: ConfigurationValueRow[] = [
    {
      key: 'ServiceAccount owner promotion',
      value: booleanChip(spec?.allowServiceAccountPromotion),
    },
    { key: 'Force Tenant prefix', value: booleanChip(spec?.forceTenantPrefix) },
    { key: 'TLS reconciler', value: booleanChip(spec?.enableTLSReconciler) },
    {
      key: 'Cache invalidation',
      value: <Typography>{spec?.cacheInvalidation || '—'}</Typography>,
    },
    {
      key: 'Events namespace',
      value: <Typography>{spec?.events?.namespace || '—'}</Typography>,
    },
    {
      key: 'Protected Namespace regex',
      value: <Typography component="code">{spec?.protectedNamespaceRegex || 'None'}</Typography>,
    },
    {
      key: 'Ignored user groups',
      value: stringChips(spec?.ignoreUserWithGroups),
    },
  ];
  const rbacRows: ConfigurationValueRow[] = [
    { key: 'Provisioner role', value: <Typography>{spec?.rbac?.provisioner || '—'}</Typography> },
    { key: 'Deleter role', value: <Typography>{spec?.rbac?.deleter || '—'}</Typography> },
    {
      key: 'Administration roles',
      value: stringChips(spec?.rbac?.administrationClusterRoles),
    },
    {
      key: 'Promotion roles',
      value: stringChips(spec?.rbac?.promotionClusterRoles),
    },
    ...Object.entries(spec?.overrides || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({
        key: `Override: ${key}`,
        value: <Typography component="code">{value}</Typography>,
      })),
    {
      key: 'Forbidden Node labels',
      value: stringChips(spec?.nodeMetadata?.forbiddenLabels?.denied),
    },
    {
      key: 'Forbidden Node annotations',
      value: stringChips(spec?.nodeMetadata?.forbiddenAnnotations?.denied),
    },
  ];

  return (
    <Resource.DetailsGrid
      name={name}
      resourceType={CapsuleConfiguration}
      extraInfo={item => {
        if (!item) return [];
        const itemWebhooks = capsuleConfigurationWebhookRows(item);
        return [
          {
            name: 'Health',
            value: <CapsuleConfigurationHealthChip state={capsuleConfigurationState(item)} />,
          },
          {
            name: 'Observed generation',
            value: (
              <Typography>
                {item.status?.observedGeneration ?? '—'} / {item.metadata?.generation ?? '—'}
              </Typography>
            ),
          },
          {
            name: 'Managed Tenants',
            value: <Chip size="small" label={capsuleConfigurationTenants(item).length} />,
          },
          {
            name: 'Reconciled identities',
            value: <Chip size="small" label={capsuleConfigurationReconciledUsers(item).length} />,
          },
          {
            name: 'Admission webhooks',
            value: <Chip size="small" label={itemWebhooks.length} />,
          },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={configuration} />

        <SectionBox title="Feature Configuration">
          <ConfigurationTable rows={featureRows} />
        </SectionBox>

        <SectionBox title="Admission Webhooks">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Dynamic handlers configured by Capsule. CA bundles are intentionally omitted from this
            overview.
          </Typography>
          <SimpleTable
            columns={[
              {
                label: 'Type',
                getter: (row: CapsuleConfigurationWebhookRow) => (
                  <Chip
                    size="small"
                    label={row.type}
                    color={row.type === 'Mutating' ? 'primary' : 'info'}
                  />
                ),
              },
              { label: 'Name', getter: (row: CapsuleConfigurationWebhookRow) => row.name },
              {
                label: 'Failure Policy',
                getter: (row: CapsuleConfigurationWebhookRow) => row.failurePolicy || '—',
              },
              {
                label: 'Match Policy',
                getter: (row: CapsuleConfigurationWebhookRow) => row.matchPolicy || '—',
              },
              { label: 'Rules', getter: (row: CapsuleConfigurationWebhookRow) => row.ruleCount },
              { label: 'Path', getter: (row: CapsuleConfigurationWebhookRow) => row.path || '—' },
              {
                label: 'Endpoint',
                getter: (row: CapsuleConfigurationWebhookRow) => row.endpoint,
              },
            ]}
            data={webhooks}
            emptyMessage="No dynamic admission webhooks configured."
            reflectInURL={false}
          />
        </SectionBox>

        <SectionBox title="Identities">
          <SimpleTable
            columns={[
              {
                label: 'Source',
                getter: (row: CapsuleConfigurationIdentityRow) => (
                  <Chip
                    size="small"
                    label={row.source}
                    color={row.source === 'Administrator' ? 'warning' : 'info'}
                    variant={row.source === 'Reconciled User' ? 'outlined' : 'filled'}
                  />
                ),
              },
              { label: 'Kind', getter: (row: CapsuleConfigurationIdentityRow) => row.kind },
              { label: 'Name', getter: (row: CapsuleConfigurationIdentityRow) => row.name },
            ]}
            data={identities}
            emptyMessage="No identities configured or reconciled."
            reflectInURL={false}
          />
        </SectionBox>

        <SectionBox title="RBAC and Controller Overrides">
          <ConfigurationTable rows={rbacRows} />
        </SectionBox>

        <SectionBox title="Managed Tenants">
          {tenants.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {tenants.map(tenant => (
                <CapsuleResourceLink key={tenant} crd={CAPSULE_CRDS.Tenant} name={tenant}>
                  <Chip size="small" label={tenant} color="primary" clickable />
                </CapsuleResourceLink>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">No Tenants reported in status.</Typography>
          )}
        </SectionBox>
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default CapsuleConfigurationDetail;
