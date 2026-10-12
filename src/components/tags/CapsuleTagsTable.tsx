import type { ReactNode } from 'react';
import { CapsuleTagChips } from './CapsuleTagChips';
import { capsuleResourceTags } from './capsuleTags';

const CAPSULE_RESOURCE_TABLE_IDS = new Set([
  'capsule-configurations',
  'capsule-custom-quotas',

  'capsule-global-custom-quotas',
  'capsule-global-proxy-settings',
  'capsule-global-resource-quotas',
  'capsule-global-tenant-resources',
  'capsule-namespace-customquotas',
  'capsule-namespace-tenantresources',
  'capsule-resource-pools',
  'capsule-tenant-owners',
  'capsule-tenant-resources',
  'capsule-tenants',
  'headlamp-resourcepoolclaims',
]);

const TAGS_COLUMN_ID = 'capsule-tags';

/** Adds one consistent annotation-tag column to every Capsule CR inventory. */
export function addCapsuleTagsTableColumn({ id, columns }: { id?: string; columns: any[] }): any[] {
  if (!id || !CAPSULE_RESOURCE_TABLE_IDS.has(id)) return columns;
  if (columns.some(column => typeof column !== 'string' && column?.id === TAGS_COLUMN_ID)) {
    return columns;
  }

  const tagColumn = {
    id: TAGS_COLUMN_ID,
    label: 'Tags',
    getValue: (item: any) => capsuleResourceTags(item).join(', '),
    render: (item: any): ReactNode => <CapsuleTagChips resource={item} />,
  };
  const processed = [...columns];
  const ageIndex = processed.findIndex(column => column === 'age');
  processed.splice(ageIndex === -1 ? processed.length : ageIndex, 0, tagColumn);
  return processed;
}
