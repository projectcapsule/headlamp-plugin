import { type Edge, MarkerType, type Node } from '@xyflow/react';

export const RESOURCE_POOL_CLAIM_BLUE = '#1976d2';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function buildResourcePoolClaimGraph(
  claim: any,
  pool?: any
): { edges: Edge[]; nodes: Node[] } {
  const json = objectData(claim);
  const poolName = json.status?.pool?.name || json.spec?.pool;
  if (!claim || !poolName) return { edges: [], nodes: [] };
  return {
    edges: [
      {
        animated: true,
        id: 'claim-pool',
        markerEnd: { color: RESOURCE_POOL_CLAIM_BLUE, type: MarkerType.ArrowClosed },
        source: 'claim',
        style: { stroke: RESOURCE_POOL_CLAIM_BLUE, strokeWidth: 2 },
        target: 'pool',
        type: 'smoothstep',
      },
    ],
    nodes: [
      {
        data: {
          name: json.metadata?.name || claim?.getName?.(),
          requested: json.spec?.claim || {},
        },
        draggable: false,
        id: 'claim',
        position: { x: 24, y: 55 },
        selectable: false,
        style: { height: 150, width: 310 },
        type: 'claim',
      },
      {
        data: { exists: !!pool, name: poolName },
        draggable: false,
        id: 'pool',
        position: { x: 470, y: 74 },
        selectable: false,
        style: { height: 112, width: 310 },
        type: 'pool',
      },
    ],
  };
}
