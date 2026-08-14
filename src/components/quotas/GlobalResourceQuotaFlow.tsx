import { useMemo } from 'react';
import { ALL_QUOTA_RESOURCES } from '../common/quotaAggregation';
import {
  buildQuotaConsumptionFlowGraph,
  QuotaConsumptionFlow,
  type QuotaConsumptionFlowGraph,
} from '../common/QuotaConsumptionFlow';
import { globalResourceQuotaAggregation } from './globalResourceQuotaHelpers';

export type GlobalResourceQuotaFlowGraph = QuotaConsumptionFlowGraph;

/** Compatibility helper for the dedicated GlobalResourceQuota graph tests and consumers. */
export function buildGlobalResourceQuotaFlowGraph(
  item: any,
  selectedResource = ALL_QUOTA_RESOURCES
): GlobalResourceQuotaFlowGraph {
  return buildQuotaConsumptionFlowGraph(globalResourceQuotaAggregation(item), selectedResource);
}

export function GlobalResourceQuotaFlow({
  quota,
  selectedResource = ALL_QUOTA_RESOURCES,
}: {
  quota: any;
  selectedResource?: string;
}) {
  const data = useMemo(() => globalResourceQuotaAggregation(quota), [quota]);
  return <QuotaConsumptionFlow data={data} selectedResource={selectedResource} />;
}

export default GlobalResourceQuotaFlow;
