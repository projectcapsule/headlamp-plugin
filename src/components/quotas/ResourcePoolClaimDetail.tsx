import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { ResourcePool, ResourcePoolClaim } from '../../resources/resourcePools';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { ResourcePoolClaimFlow } from './ResourcePoolClaimFlow';

export interface ResourcePoolClaimDetailProps {
  name?: string;
  namespace?: string;
}

function condition(item: any, type: string) {
  return item?.status?.conditions?.find((entry: any) => entry.type === type);
}

export function ResourcePoolClaimDetail(props: ResourcePoolClaimDetailProps) {
  const params = useParams<{ crName?: string; name?: string; namespace: string }>();
  const name = props.name || params.crName || params.name || '';
  const namespace = props.namespace || params.namespace || '';
  const [claims] = ResourcePoolClaim.useList({ namespace });
  const [pools] = ResourcePool.useList();
  const claim = claims?.find(item => item.getName() === name && item.getNamespace() === namespace);
  const poolName = claim?.status?.pool?.name || claim?.spec?.pool;
  const pool = pools?.find(item => item.getName() === poolName);
  const requested = Object.entries(claim?.spec?.claim || {}).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return (
    <Resource.DetailsGrid
      name={name}
      namespace={namespace}
      resourceType={ResourcePoolClaim}
      extraInfo={item => {
        if (!item) return [];
        const referencedPool = item.status?.pool?.name || item.spec?.pool;
        return [
          {
            name: 'ResourcePool',
            value: referencedPool ? (
              <CapsuleResourceLink crd={CAPSULE_CRDS.ResourcePool} name={referencedPool}>
                {referencedPool}
              </CapsuleResourceLink>
            ) : (
              <Typography>—</Typography>
            ),
          },
          {
            name: 'Ready',
            value: <ConditionStatusChip status={condition(item, 'Ready')?.status} type="Ready" />,
          },
          {
            name: 'Bound',
            value: <ConditionStatusChip status={condition(item, 'Bound')?.status} type="Bound" />,
          },
          {
            name: 'Exhausted',
            value: (
              <ConditionStatusChip status={condition(item, 'Exhausted')?.status} type="Exhausted" />
            ),
          },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={claim} />
        <SectionBox title="ResourcePool Relationship">
          <ResourcePoolClaimFlow claim={claim} pool={pool} />
        </SectionBox>
        <SectionBox title="Requested Allocation">
          <SimpleTable
            columns={[
              { label: 'Resource', getter: (entry: [string, unknown]) => entry[0] },
              { label: 'Requested', getter: (entry: [string, unknown]) => String(entry[1]) },
            ]}
            data={requested}
            defaultSortingColumn={1}
            emptyMessage="No resources were requested by this claim."
            reflectInURL={false}
          />
        </SectionBox>
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default ResourcePoolClaimDetail;
