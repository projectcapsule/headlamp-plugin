import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import { CapsuleOverview } from './CapsuleOverview';

export const CAPSULE_OVERVIEW_ID = 'capsule-overview';

export function registerCapsuleOverview() {
  registerSidebarEntry({
    parent: 'capsule',
    name: CAPSULE_OVERVIEW_ID,
    label: 'Overview',
    icon: 'mdi:view-dashboard',
    url: '/capsule/overview/',
  });
  registerRoute({
    path: '/capsule/overview/',
    sidebar: CAPSULE_OVERVIEW_ID,
    name: CAPSULE_OVERVIEW_ID,
    component: () => <CapsuleOverview />,
    exact: true,
  });
}
