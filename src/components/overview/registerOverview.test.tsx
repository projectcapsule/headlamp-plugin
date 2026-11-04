import { beforeEach, describe, expect, it, vi } from 'vitest';
const { sidebar, routes, registerRoute, registerSidebarEntry } = vi.hoisted(() => {
  const sidebar = new Map<string, any>();
  const routes = new Map<string, any>();
  return {
    sidebar,
    routes,
    registerSidebarEntry: vi.fn((entry: any) => sidebar.set(entry.name, entry)),
    registerRoute: vi.fn((route: any) => routes.set(route.name, route)),
  };
});
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({ registerRoute, registerSidebarEntry }));
vi.mock('./CapsuleOverview', () => ({ CapsuleOverview: () => null }));
import { registerCapsuleOverview } from './registerOverview';
beforeEach(() => {
  sidebar.clear();
  routes.clear();
});
describe('Capsule overview navigation', () => {
  it('preserves other plugins overview entries in Headlamps globally keyed registry', () => {
    const flux = { parent: 'flux', name: 'flux-overview', url: '/flux/overview' };
    const generic = { name: 'overview', url: '/other/overview' };
    sidebar.set(flux.name, flux);
    sidebar.set(generic.name, generic);
    registerCapsuleOverview();
    expect(sidebar.get('flux-overview')).toBe(flux);
    expect(sidebar.get('overview')).toBe(generic);
    const capsule = sidebar.get('capsule-overview');
    expect(capsule.parent).toBe('capsule');
    expect(capsule.url).toBe('/capsule/overview/');
    const route = routes.get('capsule-overview');
    expect(route.path).toBe(capsule.url);
    expect(route.sidebar).toBe(capsule.name);
    expect(route.component()).toBeTruthy();
  });
});
