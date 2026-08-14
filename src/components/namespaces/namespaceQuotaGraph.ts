import { type Edge, MarkerType, type Node } from '@xyflow/react';
import { centerSourceOnTargetRows } from '../common/flowLayout';
import {
  ALL_QUOTA_RESOURCES,
  filterQuotaMetrics,
  quotaMetricPeak,
} from '../common/quotaAggregation';
import type { NamespaceQuotaReference } from './namespaceQuotaReferences';

export const NAMESPACE_QUOTA_TARGETS_PER_COLUMN = 3;
export const NAMESPACE_QUOTA_SOURCE_HEIGHT = 112;
export const NAMESPACE_QUOTA_TARGET_HEIGHT = 158;
export const NAMESPACE_QUOTA_TARGET_START_Y = 18;
export const NAMESPACE_QUOTA_TARGET_STEP_Y = 182;
export const NAMESPACE_QUOTA_BLUE = '#1976d2';

export function buildNamespaceQuotaGraph(
  namespace: string,
  references: NamespaceQuotaReference[],
  selectedResource = ALL_QUOTA_RESOURCES
): { edges: Edge[]; nodes: Node[] } {
  const visibleReferences = references.filter(
    reference =>
      selectedResource === ALL_QUOTA_RESOURCES || reference.resources.includes(selectedResource)
  );
  const rowCount = Math.min(
    NAMESPACE_QUOTA_TARGETS_PER_COLUMN,
    Math.max(visibleReferences.length, 1)
  );
  const sourceY = centerSourceOnTargetRows({
    rowCount,
    sourceHeight: NAMESPACE_QUOTA_SOURCE_HEIGHT,
    targetHeight: NAMESPACE_QUOTA_TARGET_HEIGHT,
    targetStartY: NAMESPACE_QUOTA_TARGET_START_Y,
    targetStepY: NAMESPACE_QUOTA_TARGET_STEP_Y,
  });
  const nodes: Node[] = [
    {
      data: { count: visibleReferences.length, name: namespace },
      draggable: false,
      id: 'namespace-source',
      position: { x: 24, y: sourceY },
      selectable: false,
      style: { height: NAMESPACE_QUOTA_SOURCE_HEIGHT, width: 290 },
      type: 'namespace',
    },
  ];
  const edges: Edge[] = [];

  visibleReferences.forEach((reference, index) => {
    const id = `quota-${reference.kind}-${reference.namespace || '-'}-${reference.name}`;
    const column = Math.floor(index / NAMESPACE_QUOTA_TARGETS_PER_COLUMN);
    const row = index % NAMESPACE_QUOTA_TARGETS_PER_COLUMN;
    nodes.push({
      data: {
        metrics: filterQuotaMetrics(reference.metrics, selectedResource),
        peak: quotaMetricPeak(filterQuotaMetrics(reference.metrics, selectedResource)),
        reference,
      },
      draggable: false,
      id,
      position: {
        x: 430 + column * 380,
        y: NAMESPACE_QUOTA_TARGET_START_Y + row * NAMESPACE_QUOTA_TARGET_STEP_Y,
      },
      selectable: false,
      style: { height: NAMESPACE_QUOTA_TARGET_HEIGHT, width: 330 },
      type: 'quotaSystem',
    });
    edges.push({
      animated: true,
      id: `namespace-${id}`,
      markerEnd: { color: NAMESPACE_QUOTA_BLUE, type: MarkerType.ArrowClosed },
      source: 'namespace-source',
      style: { stroke: NAMESPACE_QUOTA_BLUE, strokeWidth: 1.9 },
      target: id,
      type: 'smoothstep',
    });
  });
  return { edges, nodes };
}
