import Resource, { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { GlobalCustomQuota } from '../../resources/customQuotas';
import { parseKubernetesQuantity, usageHex } from '../../utils/quantity';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { QuotaAggregationView } from '../common/QuotaAggregationView';
import { QuotaClaims } from '../common/QuotaClaims';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { customQuotaAggregation } from './customQuotaAggregationHelpers';

export interface GlobalCustomQuotaDetailProps {
  name?: string;
}

export function GlobalCustomQuotaDetail(props: GlobalCustomQuotaDetailProps) {
  const params = useParams<{ name: string }>();
  const { name = params.name } = props;

  const [quotas] = GlobalCustomQuota.useList();
  const quota = quotas?.find((q: any) => q.getName() === name);
  const cluster = quota?.cluster;

  return (
    <>
      <Resource.DetailsGrid
        name={name}
        resourceType={GlobalCustomQuota}
        extraInfo={item => {
          if (!item) return [];
          const limit = item.spec?.limit || '—';
          const used = item.status?.usage?.used || '0';
          const available = item.status?.usage?.available || '—';
          const numSources = (item.spec?.sources || []).length;
          const numNamespaces = (item.status?.namespaces || []).length;
          const uVal = parseKubernetesQuantity(used);
          const lVal = parseKubernetesQuantity(limit) || 1;
          const p = lVal > 0 ? (uVal / lVal) * 100 : 0;
          return [
            { name: 'Limit', value: <Typography>{limit}</Typography> },
            {
              name: 'Used',
              value: (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{used}</Typography>
                  <Tooltip
                    title={`${p.toFixed(1)}% of limit (green <85%, orange 85% to <95%, red >=95%)`}
                  >
                    <Box>
                      {(() => {
                        const pieData = [
                          {
                            name: 'Used',
                            value: uVal,
                            fill: usageHex(p),
                          },
                          {
                            name: 'Remaining',
                            value: Math.max(0, lVal - uVal),
                            fill: '#e0e0e0',
                          },
                        ];
                        return (
                          <PieChart width={28} height={28}>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={8}
                              outerRadius={13}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        );
                      })()}
                    </Box>
                  </Tooltip>
                </Box>
              ),
            },
            { name: 'Available', value: <Typography>{available}</Typography> },
            {
              name: 'Sources',
              value: <Chip size="small" label={numSources} />,
            },
            {
              name: 'Namespaces in scope',
              value: <Typography>{numNamespaces}</Typography>,
            },
          ];
        }}
      >
        <DetailsSectionStack>
          <ConditionsAndEvents resource={quota} />
          <QuotaAggregationView
            cluster={cluster}
            data={customQuotaAggregation(quota, 'GlobalCustomQuota')}
            namespaceEmptyMessage="No namespaces or per-claim consumption have been reported for this quota yet."
          />
          <GlobalCustomQuotaSources name={name} />
          <QuotaClaims quota={quota} cluster={cluster} />
        </DetailsSectionStack>
      </Resource.DetailsGrid>
    </>
  );
}

function GlobalCustomQuotaSources({ name }: { name: string }) {
  const [quotas] = GlobalCustomQuota.useList();
  const quota = quotas?.find((q: any) => q.getName() === name);
  const sources = quota?.spec?.sources || [];

  return (
    <SectionBox title="Sources">
      {sources.length === 0 ? (
        <Typography color="text.secondary">No sources defined.</Typography>
      ) : (
        <SimpleTable
          columns={[
            {
              label: 'Group',
              getter: s => s.group || 'core',
            },
            {
              label: 'Version',
              getter: s => s.version || 'v1',
            },
            {
              label: 'Kind',
              getter: s => s.kind,
            },
            {
              label: 'Operation',
              getter: s => s.op,
            },
            {
              label: 'Path',
              getter: s => s.path || '—',
            },
          ]}
          data={sources}
          emptyMessage="No sources defined."
          reflectInURL={false}
        />
      )}
    </SectionBox>
  );
}
