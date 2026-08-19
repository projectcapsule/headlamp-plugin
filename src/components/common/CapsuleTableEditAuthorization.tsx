import './CapsuleTableEditAuthorization.css';
import { AuthVisible } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Fragment, type ReactNode } from 'react';

const EDITABLE_CAPSULE_TABLE_IDS = new Set([
  'capsule-configurations',
  'capsule-custom-quotas',
  'capsule-global-custom-quotas',
  'capsule-global-proxy-settings',
  'capsule-global-resource-quotas',
  'capsule-global-tenant-resources',
  'capsule-namespace-customquotas',
  'capsule-namespace-tenantresources',
  'capsule-resource-pools',
  'capsule-tenant-namespaces',
  'capsule-tenant-owners',
  'capsule-tenant-persistent-volumes',
  'capsule-tenant-resources',
  'capsule-tenants',
]);

const AUTHORIZATION_PREWARM_MARKER = 'capsuleEditAuthorizationPrewarm';

/**
 * Start Headlamp's update authorization query as soon as a row is rendered.
 *
 * ResourceTable normally mounts this query only after its row-action menu is
 * opened. Prewarming the same AuthVisible query makes the standard Edit item
 * available in that dropdown without adding a separate action column. When
 * update is denied, Headlamp 0.44 replaces Edit with an icon-only ViewButton;
 * the adjacent stylesheet suppresses that malformed duplicate while retaining
 * ResourceTable's regular View YAML menu item.
 */
export function CapsuleEditAuthorizationPrewarm({ item }: { item: any }) {
  return (
    <span aria-hidden style={{ display: 'none' }}>
      <AuthVisible item={item} authVerb="update">
        <span />
      </AuthVisible>
    </span>
  );
}

export function prewarmCapsuleTableEditAuthorization({
  id,
  columns,
}: {
  id?: string;
  columns: any[];
}) {
  if (!id || !EDITABLE_CAPSULE_TABLE_IDS.has(id)) return columns;

  const nameColumnIndex = columns.findIndex(
    column => typeof column !== 'string' && column?.id === 'name'
  );
  if (nameColumnIndex === -1) return columns;

  const nameColumn = columns[nameColumnIndex];
  if (nameColumn[AUTHORIZATION_PREWARM_MARKER]) return columns;

  const renderValue = (item: any): ReactNode => {
    if (nameColumn.render) return nameColumn.render(item);
    return nameColumn.getValue?.(item) ?? null;
  };

  const processedColumns = [...columns];
  processedColumns[nameColumnIndex] = {
    ...nameColumn,
    [AUTHORIZATION_PREWARM_MARKER]: true,
    render: (item: any) => (
      <Fragment>
        {renderValue(item)}
        <CapsuleEditAuthorizationPrewarm item={item} />
      </Fragment>
    ),
  };

  return processedColumns;
}
