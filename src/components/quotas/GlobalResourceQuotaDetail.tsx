import { K8s } from '@kinvolk/headlamp-plugin/lib';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalResourceQuota } from '../../resources/globalResourceQuotas';
import { usageChipColor } from '../../utils/quantity';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { QuotaAggregationView } from '../common/QuotaAggregationView';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { AnchoredSubheading } from '../common/SectionAnchor';
import {
  globalResourceQuotaAggregation,
  globalResourceQuotaMetrics,
  globalResourceQuotaNamespaces,
  globalResourceQuotaPeakUsage,
} from './globalResourceQuotaHelpers';

export interface GlobalResourceQuotaDetailProps {
  name?: string;
}

function PeakUsageChip({ quota }: { quota: any }) {
  const metrics = globalResourceQuotaMetrics(quota);
  const peak = globalResourceQuotaPeakUsage(quota);
  if (metrics.length === 0) return <Chip size="small" label="No limits" />;
  return <Chip size="small" label={`${peak.toFixed(1)}%`} color={usageChipColor(peak)} />;
}

export function GlobalResourceQuotaDetail(props: GlobalResourceQuotaDetailProps) {
  const params = useParams<{ name: string }>();
  const { name = params.name } = props;
  const [quotas] = GlobalResourceQuota.useList();
  const quota = quotas?.find((item: any) => item.getName() === name);
  const namespaces = useMemo(() => globalResourceQuotaNamespaces(quota), [quota]);
  const [resourceQuotas] = K8s.ResourceClasses.ResourceQuota.useList({
    cluster: quota?.cluster,
    namespace: namespaces,
  });
  const aggregation = useMemo(
    () => globalResourceQuotaAggregation(quota, resourceQuotas),
    [quota, resourceQuotas]
  );

  return (
    <Resource.DetailsGrid
      name={name}
      resourceType={GlobalResourceQuota}
      extraInfo={item => {
        if (!item) return [];
        const namespaces = globalResourceQuotaNamespaces(item);
        const metrics = globalResourceQuotaMetrics(item);
        return [
          {
            name: 'Namespaces in scope',
            value: (
              <Typography>{Number(item.status?.namespaceCount) || namespaces.length}</Typography>
            ),
          },
          {
            name: 'Quota resources',
            value: <Typography>{metrics.length}</Typography>,
          },
          {
            name: 'Peak usage',
            value: <PeakUsageChip quota={item} />,
          },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={quota} />
        <QuotaAggregationView cluster={quota?.cluster} data={aggregation} />
        <QuotaConfiguration quota={quota} />
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

function selectorDescription(selector: any): string {
  const labels = Object.entries(selector?.matchLabels || {}).map(
    ([key, value]) => `${key}=${value}`
  );
  const expressions = (selector?.matchExpressions || []).map(
    (expression: any) =>
      `${expression.key} ${expression.operator}${
        expression.values?.length ? ` (${expression.values.join(', ')})` : ''
      }`
  );
  return [...labels, ...expressions].join(', ') || 'All namespaces';
}

function QuotaConfiguration({ quota }: { quota: any }) {
  const selectors = quota?.spec?.namespaceSelectors || [];
  const scopes = quota?.spec?.quota?.scopes || [];
  const scopeExpressions = quota?.spec?.quota?.scopeSelector?.matchExpressions || [];

  return (
    <SectionBox title="Quota Configuration">
      <Stack spacing={2}>
        <Box>
          <AnchoredSubheading title="Namespace selectors" variant="subtitle2" sx={{ mb: 0.75 }} />
          {selectors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No namespace selectors configured.
            </Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {selectors.map((selector: any, index: number) => (
                <Chip key={index} size="small" label={selectorDescription(selector)} />
              ))}
            </Stack>
          )}
        </Box>
        {(scopes.length > 0 || scopeExpressions.length > 0) && (
          <Box>
            <AnchoredSubheading title="Scope restrictions" variant="subtitle2" sx={{ mb: 0.75 }} />
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {scopes.map((scope: string) => (
                <Chip key={scope} size="small" label={scope} />
              ))}
              {scopeExpressions.map((expression: any, index: number) => (
                <Chip
                  key={`${expression.scopeName}-${index}`}
                  size="small"
                  label={`${expression.scopeName} ${expression.operator}${
                    expression.values?.length ? ` (${expression.values.join(', ')})` : ''
                  }`}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </SectionBox>
  );
}

export default GlobalResourceQuotaDetail;
