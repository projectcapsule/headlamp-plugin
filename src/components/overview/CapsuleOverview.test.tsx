import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { request, scope } = vi.hoisted(() => ({
  request: vi.fn(),
  scope: { cluster: 'cluster-a', namespaces: new Set<string>(), hung: false, forbidden: false },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request }));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: { useCluster: () => scope.cluster, useSelectedClusters: () => [scope.cluster] },
  Router: {
    createRouteURL: (_name: string, params: any) =>
      `/c/${params.cluster || scope.cluster}/customresources/${params.crd}/${params.namespace}/${
        params.crName
      }`,
  },
}));
vi.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({ filter: { namespaces: scope.namespaces } }),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/Utils', () => ({
  useFilterFunc: () => (item: any) =>
    !item.metadata.namespace ||
    !scope.namespaces.size ||
    scope.namespaces.has(item.metadata.namespace),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', async () => {
  const { forwardRef } = await vi.importActual<typeof import('react')>('react');
  return {
    Link: forwardRef<HTMLAnchorElement, any>(({ children, routeName, params }, ref) => (
      <a ref={ref} href={`/${routeName}/${params?.crd || ''}`}>
        {children}
      </a>
    )),
    ResourceListView: ({ title, data }: any) => (
      <section aria-label={title}>
        {data.map((item: any) => (
          <p key={item.metadata.name}>{item.message}</p>
        ))}
      </section>
    ),
  };
});
vi.mock('@kinvolk/headlamp-plugin/lib/components/common', () => ({ DateLabel: () => null }));
vi.mock('../common/SectionAnchor', () => ({
  AnchoredSubheading: ({ title }: any) => <h2>{title}</h2>,
  anchoredResourceListHeaderProps: () => ({}),
}));
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <svg>{children}</svg>,
  Pie: ({ children }: any) => <g>{children}</g>,
  Cell: () => null,
}));
vi.mock('./overviewClient', async original => {
  const source = await original<typeof import('./overviewClient')>();
  return { ...source, overviewClient: source.createOverviewClient(request, 100, 150) };
});
import { CapsuleOverview } from './CapsuleOverview';
const ready = { conditions: [{ type: 'Ready', status: 'True' }], observedGeneration: 1 };
const tenant = (name: string) => ({
  kind: 'Tenant',
  metadata: { name, uid: name, generation: 1 },
  status: { ...ready, namespaces: ['team'], spaces: { team: ready } },
});
const stat = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('h4')?.textContent;
function mount() {
  return render(
    <MemoryRouter>
      <CapsuleOverview />
    </MemoryRouter>
  );
}
beforeEach(() => {
  scope.cluster = 'cluster-a';
  scope.namespaces = new Set();
  scope.hung = false;
  scope.forbidden = false;
  localStorage.clear();
  request.mockReset();
  request.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://cluster');
    if (url.pathname.endsWith('/globalproxysettings')) {
      if (scope.hung) return new Promise(() => {});
      throw Object.assign(new Error('API not installed'), { status: 404 });
    }
    if (url.pathname.endsWith('/globalresourcequotas') && scope.forbidden)
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    if (url.pathname.endsWith('/tenants')) return { items: [tenant('solar'), tenant('wind')] };
    if (url.pathname.endsWith('/deployments'))
      return {
        items: url.pathname.includes('/namespaces/team/')
          ? []
          : [
              {
                kind: 'Deployment',
                metadata: {
                  name: 'capsule-controller-manager',
                  namespace: 'capsule-system',
                  uid: 'controller',
                  generation: 1,
                },
                spec: { replicas: 2 },
                status: { readyReplicas: 2, observedGeneration: 1 },
              },
            ],
      };
    if (url.pathname.endsWith('/events'))
      return {
        items: [
          {
            metadata: { name: 'event' },
            involvedObject: {
              apiVersion: 'capsule.clastix.io/v1beta2',
              kind: 'Tenant',
              name: 'solar',
            },
            message: 'Tenant reconciled',
          },
        ],
      };
    return { items: [] };
  });
});
afterEach(cleanup);

describe('mounted Capsule dashboard with its real loader', () => {
  it('does not report healthy when Tenant namespace readiness is missing', async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options: any) =>
      path.includes('/tenants?')
        ? { items: [{ ...tenant('solar'), status: { ...ready, namespaces: ['team'] } }] }
        : original(path, options)
    );
    mount();
    await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
    expect(screen.getByText('Status incomplete')).toBeTruthy();
    expect(screen.queryByText('Healthy')).toBeNull();
  });
  it('renders data, absent optional APIs and Events, then finishes loading and supports refresh', async () => {
    mount();
    await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
    expect(stat('TENANTS')).toBe('2');
    expect(stat('MANAGED NAMESPACES')).toBe('1');
    expect(screen.getByText('API not installed')).toBeTruthy();
    expect(screen.getByText('capsule-controller-manager')).toBeTruthy();
    expect(screen.getByText('Tenant reconciled')).toBeTruthy();
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(13);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(26));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh' }).getAttribute('disabled')).toBeNull()
    );
    expect(stat('TENANTS')).toBe('2');
  });
  it('keeps readable data visible when an optional API stalls or another API is forbidden', async () => {
    scope.hung = true;
    scope.forbidden = true;
    mount();
    await waitFor(() => expect(stat('TENANTS')).toBe('2'));
    await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
    expect(screen.getByText('Partial visibility')).toBeTruthy();
    expect(screen.getByText(/Global Proxy Settings: Request timed out/)).toBeTruthy();
    expect(screen.getByText(/Global Resource Quotas: Forbidden/)).toBeTruthy();
    expect(screen.getByText('capsule-controller-manager')).toBeTruthy();
  });
  it('does not refetch on stable rerenders and pins a new cluster after navigation', async () => {
    const result = mount();
    await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
    result.rerender(
      <MemoryRouter>
        <CapsuleOverview />
      </MemoryRouter>
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(request).toHaveBeenCalledTimes(13);
    scope.cluster = 'cluster-b';
    result.rerender(
      <MemoryRouter>
        <CapsuleOverview />
      </MemoryRouter>
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(26));
    expect(request.mock.calls.slice(13).every(call => call[1].cluster === 'cluster-b')).toBe(true);
  });
  it('reacts to the Tenant selector without losing global resource context', async () => {
    mount();
    await waitFor(() => expect(stat('TENANTS')).toBe('2'));
    localStorage.setItem('selectedTenantNames', JSON.stringify(['solar']));
    fireEvent(window, new CustomEvent('tenantSelectionChanged'));
    await waitFor(() => expect(stat('TENANTS')).toBe('1'));
    expect(screen.queryByRole('link', { name: 'wind' })).toBeNull();
    expect(screen.getByRole('link', { name: 'solar' }).getAttribute('href')).toContain(
      '/customresources/tenants.capsule.clastix.io/-/solar'
    );
  });
  it('keeps allowed namespace reads narrow while discovering controllers outside the application filter', async () => {
    scope.namespaces = new Set(['team']);
    localStorage.setItem(
      'cluster_settings.cluster-a',
      JSON.stringify({ allowedNamespaces: ['team', 'capsule-system'] })
    );
    mount();
    await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
    const namespaced = request.mock.calls.filter(call =>
      /\/(customquotas|tenantresources|resourcepoolclaims|events)\?/.test(call[0])
    );
    expect(namespaced.length).toBeGreaterThan(0);
    expect(namespaced.every(call => call[0].includes('/namespaces/team/'))).toBe(true);
    expect(
      request.mock.calls.some(call => call[0].includes('/namespaces/capsule-system/deployments'))
    ).toBe(true);
    expect(stat('TENANTS')).toBe('2');
  });
  it.skipIf(!process.env.CAPSULE_OVERVIEW_FIXTURES)(
    'renders captured live API counts and controller cards',
    async () => {
      const fixture = JSON.parse(readFileSync(process.env.CAPSULE_OVERVIEW_FIXTURES!, 'utf8'));
      request.mockImplementation(async (path: string) => {
        const response = fixture.responses[new URL(path, 'http://cluster').pathname];
        if (!response) throw new Error(`No live response for ${path}`);
        if (response.error) throw Object.assign(new Error(response.error.message), response.error);
        return response;
      });
      mount();
      await waitFor(() => expect(screen.queryByLabelText('Loading Capsule dashboard')).toBeNull());
      expect(stat('TENANTS')).toBe(String(fixture.counts.Tenant));
      for (const item of fixture.responses['/apis/apps/v1/deployments'].items)
        expect(screen.getByText(item.metadata.name)).toBeTruthy();
      expect(screen.queryByText('Partial visibility')).toBeNull();
      expect(screen.getByRole('button', { name: 'Refresh' }).getAttribute('disabled')).toBeNull();
    }
  );
});
