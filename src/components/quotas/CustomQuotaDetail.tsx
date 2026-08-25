import Resource, { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { CustomQuota } from '../../resources/customQuotas';
import { parseKubernetesQuantity, usageHex } from '../../utils/quantity';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { QuotaAggregationView } from '../common/QuotaAggregationView';
import { QuotaClaims } from '../common/QuotaClaims';
import { customQuotaAggregation } from './customQuotaAggregationHelpers';

export interface CustomQuotaDetailProps {
  name?: string;
  namespace?: string;
}

export function CustomQuotaDetail(props: CustomQuotaDetailProps) {
  const params = useParams<{ namespace: string; name: string }>();
  const { name = params.name, namespace = params.namespace } = props;

  const [quotas] = CustomQuota.useList();
  const quota = quotas?.find(
    (q: any) => q.getName() === name && (!namespace || q.getNamespace() === namespace)
  );

  return (
    <>
      <Resource.DetailsGrid
        name={name}
        namespace={namespace}
        resourceType={CustomQuota}
        extraInfo={item => {
          if (!item) return [];
          const limit = item.spec?.limit || '—';
          const used = item.status?.usage?.used || '0';
          const available = item.status?.usage?.available || '—';
          const numSources = (item.spec?.sources || []).length;
          const uVal = parseKubernetesQuantity(used);
          const lVal = parseKubernetesQuantity(limit) || 1;
          const p = lVal > 0 ? (uVal / lVal) * 100 : 0;
          const color = usageHex(p);
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
                          { name: 'Used', value: uVal, fill: color },
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
          ];
        }}
      >
        <DetailsSectionStack>
          <ConditionsAndEvents resource={quota} />
          <QuotaAggregationView data={customQuotaAggregation(quota, 'CustomQuota')} />
          <CustomQuotaSources name={name} namespace={namespace} />
          <QuotaClaims quota={quota} />
        </DetailsSectionStack>
      </Resource.DetailsGrid>
    </>
  );
}

function CustomQuotaSources({ name, namespace }: { name: string; namespace?: string }) {
  const [quotas] = CustomQuota.useList();
  const quota = quotas?.find(
    (q: any) => q.getName() === name && (!namespace || q.getNamespace() === namespace)
  );
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
