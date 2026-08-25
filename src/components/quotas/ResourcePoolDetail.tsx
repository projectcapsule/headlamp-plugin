import { Link, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { ResourcePool, ResourcePoolClaim } from '../../resources/resourcePools';
import { usageChipColor } from '../../utils/quantity';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { QuotaAggregationView } from '../common/QuotaAggregationView';
import { AnchoredSubheading } from '../common/SectionAnchor';
import { ResourcePoolClaimReleaseAction } from './ResourcePoolClaimReleaseAction';
import {
  resourcePoolAggregation,
  resourcePoolAllocationMetrics,
  type ResourcePoolClaimRow,
  resourcePoolClaimRows,
  resourcePoolNamespaces,
  resourcePoolPeakUsage,
} from './resourcePoolHelpers';

export interface ResourcePoolDetailProps {
  name?: string;
}

function poolCondition(pool: any, type: string) {
  return pool?.status?.conditions?.find((condition: any) => condition.type === type);
}

function BooleanCondition({ type, value }: { type: string; value?: boolean }) {
  if (value === undefined) return <Typography variant="caption">—</Typography>;
  return <ConditionStatusChip status={value} type={type} />;
}

function RequestedResources({ requested }: { requested: Record<string, string | number> }) {
  const entries = Object.entries(requested).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return <Typography variant="caption">—</Typography>;
  return (
    <Stack spacing={0.3} sx={{ py: 0.35 }}>
      {entries.map(([resource, value]) => (
        <Stack key={resource} direction="row" spacing={1} justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {resource}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 650 }}>
            {String(value)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function ResourcePoolClaims({ pool, claims }: { pool: any; claims: any[] | null | undefined }) {
  const [refreshRevision, setRefreshRevision] = useState(0);
  const rows = useMemo(() => resourcePoolClaimRows(pool, claims), [pool, claims, refreshRevision]);
  const grouped = useMemo(() => {
    const result = new Map<string, ResourcePoolClaimRow[]>();
    rows.forEach(row => result.set(row.namespace, [...(result.get(row.namespace) || []), row]));
    return [...result.entries()];
  }, [rows]);

  return (
    <SectionBox title="Claims">
      {grouped.length === 0 ? (
        <Typography color="text.secondary">No claims reference this ResourcePool.</Typography>
      ) : (
        <Stack spacing={3}>
          {grouped.map(([namespace, namespaceClaims]) => (
            <Box key={namespace}>
              <AnchoredSubheading
                anchor={`claims-${namespace}`}
                title={`Claims in ${namespace}`}
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 0.75 }}
              >
                <Link
                  routeName="namespace"
                  params={{ name: namespace }}
                  activeCluster={pool?.cluster}
                >
                  {namespace}
                </Link>{' '}
                ({namespaceClaims.length})
              </AnchoredSubheading>
              <SimpleTable
                columns={[
                  {
                    label: 'Claim',
                    getter: (claim: ResourcePoolClaimRow) => (
                      <CapsuleResourceLink
                        crd={CAPSULE_CRDS.ResourcePoolClaim}
                        name={claim.name}
                        namespace={claim.namespace}
                      >
                        {claim.name}
                      </CapsuleResourceLink>
                    ),
                  },
                  {
                    label: 'Requested',
                    getter: (claim: ResourcePoolClaimRow) => (
                      <RequestedResources requested={claim.requested} />
                    ),
                  },
                  {
                    label: 'Ready',
                    getter: (claim: ResourcePoolClaimRow) => (
                      <BooleanCondition type="Ready" value={claim.ready} />
                    ),
                  },
                  {
                    label: 'Bound',
                    getter: (claim: ResourcePoolClaimRow) => (
                      <BooleanCondition type="Bound" value={claim.bound} />
                    ),
                  },
                  {
                    label: 'Exhausted',
                    getter: (claim: ResourcePoolClaimRow) => (
                      <BooleanCondition type="Exhausted" value={claim.exhausted} />
                    ),
                  },
                  { label: 'Message', getter: (claim: ResourcePoolClaimRow) => claim.message },
                  {
                    label: 'Actions',
                    getter: (claim: ResourcePoolClaimRow) =>
                      claim.resource ? (
                        <ResourcePoolClaimReleaseAction
                          claim={claim.resource}
                          onReleased={() => setRefreshRevision(revision => revision + 1)}
                        />
                      ) : (
                        '—'
                      ),
                  },
                ]}
                data={namespaceClaims}
                emptyMessage="No claims in this namespace."
                reflectInURL={false}
              />
            </Box>
          ))}
        </Stack>
      )}
    </SectionBox>
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

function ResourcePoolConfiguration({ pool }: { pool: any }) {
  const selectors = pool?.spec?.selectors || [];
  const defaults = Object.entries(pool?.spec?.defaults || {});
  const scopes = pool?.spec?.quota?.scopes || [];
  const scopeExpressions = pool?.spec?.quota?.scopeSelector?.matchExpressions || [];
  const config = pool?.spec?.config || {};

  return (
    <SectionBox title="Pool Configuration">
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

        {defaults.length > 0 && (
          <Box>
            <AnchoredSubheading title="Namespace defaults" variant="subtitle2" sx={{ mb: 0.75 }} />
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {defaults.map(([resource, value]) => (
                <Chip key={resource} size="small" label={`${resource}: ${String(value)}`} />
              ))}
            </Stack>
          </Box>
        )}

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

        <Box>
          <AnchoredSubheading title="Claim behavior" variant="subtitle2" sx={{ mb: 0.75 }} />
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            <Chip size="small" label={`Defaults zero: ${config.defaultsZero ? 'Yes' : 'No'}`} />
            <Chip size="small" label={`Ordered queue: ${config.orderedQueue ? 'Yes' : 'No'}`} />
            <Chip
              size="small"
              label={`Delete bound claims: ${config.deleteBoundResources ? 'Yes' : 'No'}`}
            />
          </Stack>
        </Box>
      </Stack>
    </SectionBox>
  );
}

export function ResourcePoolDetail(props: ResourcePoolDetailProps) {
  const params = useParams<{ name: string }>();
  const { name = params.name } = props;
  const [pools] = ResourcePool.useList();
  const [claims] = ResourcePoolClaim.useList();
  const pool = pools?.find(item => item.getName() === name);
  const aggregation = useMemo(() => resourcePoolAggregation(pool, claims), [claims, pool]);

  return (
    <Resource.DetailsGrid
      name={name}
      resourceType={ResourcePool}
      extraInfo={item => {
        if (!item) return [];
        const metrics = resourcePoolAllocationMetrics(item);
        const peak = resourcePoolPeakUsage(item);
        const exhausted = poolCondition(item, 'Exhausted');
        return [
          { name: 'Bound claims', value: <Typography>{item.status?.claimCount || 0}</Typography> },
          {
            name: 'Namespaces in scope',
            value: (
              <Typography>
                {Number(item.status?.namespaceCount) || resourcePoolNamespaces(item).length}
              </Typography>
            ),
          },
          {
            name: 'Peak allocation',
            value:
              metrics.length > 0 ? (
                <Chip size="small" label={`${peak.toFixed(1)}%`} color={usageChipColor(peak)} />
              ) : (
                <Chip size="small" label="No limits" />
              ),
          },
          {
            name: 'Exhausted',
            value: <ConditionStatusChip status={exhausted?.status} type="Exhausted" />,
          },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={pool} />
        <QuotaAggregationView
          cluster={pool?.cluster}
          data={aggregation}
          namespaceEmptyMessage="No namespaces have been selected for this ResourcePool yet."
        />
        <ResourcePoolClaims pool={pool} claims={claims} />
        <ResourcePoolConfiguration pool={pool} />
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default ResourcePoolDetail;
