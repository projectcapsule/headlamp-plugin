import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalProxySettings } from '../../resources/globalProxySettings';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import {
  globalProxyClusterResourceCount,
  globalProxyReadyCondition,
  type GlobalProxyRuleRow,
  globalProxyRuleRows,
  globalProxyRules,
  globalProxySubjects,
} from './globalProxySettingsHelpers';

export interface GlobalProxySettingsDetailProps {
  name?: string;
}

function valueChips(values: string[], empty = '—') {
  if (values.length === 0) return <Typography color="text.secondary">{empty}</Typography>;
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5}>
      {values.map(value => (
        <Chip key={value} size="small" label={value || 'core'} variant="outlined" />
      ))}
    </Stack>
  );
}

export function GlobalProxySettingsDetail(props: GlobalProxySettingsDetailProps) {
  const params = useParams<{ crName?: string; name?: string }>();
  const name = props.name || params.crName || params.name || '';
  const [items, error] = GlobalProxySettings.useList();
  const settings = items?.find(item => item.getName() === name);
  const rows = useMemo(() => globalProxyRuleRows(settings), [settings]);

  if (error) {
    return (
      <SectionBox title={`Global Proxy Settings: ${name}`}>
        <Alert severity="info">
          The GlobalProxySettings API is unavailable. Install Capsule Proxy or grant this account
          access to <code>globalproxysettings.capsule.clastix.io</code>.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <Resource.DetailsGrid
      name={name}
      resourceType={GlobalProxySettings}
      extraInfo={item => {
        if (!item) return [];
        const ready = globalProxyReadyCondition(item);
        return [
          {
            name: 'Ready',
            value: <ConditionStatusChip status={ready?.status} type="Ready" />,
          },
          { name: 'Rules', value: <Chip size="small" label={globalProxyRules(item).length} /> },
          {
            name: 'Subjects',
            value: <Chip size="small" label={globalProxySubjects(item).length} />,
          },
          {
            name: 'Cluster resources',
            value: <Chip size="small" label={globalProxyClusterResourceCount(item)} />,
          },
          {
            name: 'Observed generation',
            value: (
              <Typography>
                {item.status?.observedGeneration ?? '—'} / {item.metadata?.generation ?? '—'}
              </Typography>
            ),
          },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={settings} />
        <SectionBox title="Proxy Rules">
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Each row shows the subjects and label selector allowed to discover matching
              cluster-scoped resources through Capsule Proxy.
            </Typography>
          </Box>
          <SimpleTable
            columns={[
              {
                label: 'Rule',
                getter: (row: GlobalProxyRuleRow) => `#${row.ruleIndex + 1}`,
              },
              {
                label: 'Subjects',
                getter: (row: GlobalProxyRuleRow) => (
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {row.subjects.map(subject => (
                      <Chip
                        key={`${subject.kind}/${subject.name}`}
                        size="small"
                        color="primary"
                        label={`${subject.kind}: ${subject.name}`}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ),
              },
              {
                label: 'API Groups',
                getter: (row: GlobalProxyRuleRow) => valueChips(row.apiGroups),
              },
              {
                label: 'Resources',
                getter: (row: GlobalProxyRuleRow) => valueChips(row.resources),
              },
              {
                label: 'Operations',
                getter: (row: GlobalProxyRuleRow) => valueChips(row.operations),
              },
              {
                label: 'Selector',
                getter: (row: GlobalProxyRuleRow) => (
                  <Typography
                    component="code"
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                  >
                    {row.selector}
                  </Typography>
                ),
              },
            ]}
            data={rows}
            emptyMessage="No proxy rules configured."
            reflectInURL={false}
          />
        </SectionBox>
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default GlobalProxySettingsDetail;
