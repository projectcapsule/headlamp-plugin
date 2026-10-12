// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateResourcePermit, ResourcePermitSetupForm } from './CreateResourcePermitActivity';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  enqueueSnackbar: vi.fn(),
  namespaceList: vi.fn(),
  globalTemplateList: vi.fn(),
  namespacedTemplateList: vi.fn(),
  template: {
    spec: { paramSchema: { type: 'object', properties: {} } },
    status: { namespaces: ['*'] },
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Activity: { close: mocks.close },
  ApiProxy: { post: mocks.post },
  K8s: { ResourceClasses: { Namespace: { useList: mocks.namespaceList } } },
  Router: {
    createRouteURL: (_: string, p: any) =>
      `/c/${p.cluster}/customresources/${p.crd}/${p.namespace}/${p.crName}`,
  },
}));
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: mocks.push }) }));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));
vi.mock('../../resources/resourcePermits', () => ({
  GlobalResourcePermitTemplate: {
    useGet: () => [mocks.template, null],
    useList: mocks.globalTemplateList,
  },
  ResourcePermitTemplate: {
    useGet: () => [mocks.template, null],
    useList: mocks.namespacedTemplateList,
  },
}));
vi.mock('../common/AnchoredSectionBox', () => ({
  AnchoredSectionBox: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../common/CapsuleResourceLink', () => ({
  CapsuleResourceLink: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('./ResourcePermitTemplatePresentation', () => ({
  ResourcePermitTemplateIdentity: () => null,
}));
vi.mock('./ResourcePermitYamlDialog', () => ({ ResourcePermitYamlDialog: () => null }));
vi.mock('./KubernetesResourceSchemaFieldInput', () => ({
  KubernetesResourceSchemaWidget: () => null,
}));

describe('ResourcePermit setup', () => {
  const visibleNamespaces = (names: string[]) => names.map(name => ({ getName: () => name }));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.template.status = { namespaces: ['*'] };
    mocks.namespaceList.mockReturnValue([visibleNamespaces(['solar-test']), null]);
    mocks.globalTemplateList.mockReturnValue([[], null]);
    mocks.namespacedTemplateList.mockReturnValue([[], null]);
  });

  it.each([
    { reported: ['*'], scope: [] },
    { reported: ['unseen-namespace'], scope: ['solar-test'] },
    { reported: [], scope: ['solar-test'] },
    { reported: undefined, scope: [] },
  ])(
    'lists only visible namespaces with template availability $reported',
    ({ reported, scope }) => {
      mocks.template.status = { namespaces: reported as any };
      mocks.namespaceList.mockReturnValue([
        visibleNamespaces(['solar-test', 'solar-dev', 'solar-test']),
        null,
      ]);
      render(
        <ResourcePermitSetupForm
          cluster="main"
          namespaces={scope}
          templateKind="GlobalResourcePermitTemplate"
          templateName="grafana"
        />
      );
      expect(mocks.namespaceList).toHaveBeenCalledWith({ cluster: 'main' });
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Namespace' }));
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'solar-dev',
        'solar-test',
      ]);
      expect(screen.queryByRole('textbox', { name: 'Namespace' })).toBeNull();
    }
  );

  it('uses the same visible namespace list for a namespaced template', () => {
    mocks.namespaceList.mockReturnValue([visibleNamespaces(['solar-dev', 'solar-test']), null]);
    render(
      <ResourcePermitSetupForm
        cluster="main"
        namespaces={['solar-test']}
        templateKind="ResourcePermitTemplate"
        templateName="access"
        templateNamespace="unseen-namespace"
      />
    );
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Namespace' }));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'solar-dev',
      'solar-test',
    ]);
  });

  it.each([
    { items: null, error: null, message: 'Loading visible Namespaces…' },
    { items: [], error: null, message: 'No Namespaces are visible to this account.' },
    {
      items: null,
      error: new Error('Forbidden'),
      message: 'Visible Namespaces could not be loaded. Check Namespace list access.',
    },
  ])('keeps a disabled selector when $message', ({ items, error, message }) => {
    mocks.namespaceList.mockReturnValue([items, error]);
    render(
      <ResourcePermitSetupForm
        cluster="main"
        namespaces={['solar-test']}
        templateKind="GlobalResourcePermitTemplate"
        templateName="grafana"
      />
    );
    expect(screen.getByRole('combobox', { name: 'Namespace' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Namespace' })).toBeNull();
    fireEvent.change(screen.getByLabelText('ResourcePermit name prefix', { exact: false }), {
      target: { value: 'incident' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Template Parameters' }));
    expect(screen.queryByRole('button', { name: 'Create ResourcePermit' })).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('preserves request fields and visible selections when the namespace list updates', () => {
    const form = () => (
      <ResourcePermitSetupForm
        cluster="main"
        namespaces={[]}
        templateKind="GlobalResourcePermitTemplate"
        templateName="grafana"
      />
    );
    const { rerender } = render(form());
    fireEvent.change(screen.getByLabelText('ResourcePermit name prefix', { exact: false }), {
      target: { value: 'incident' },
    });
    mocks.namespaceList.mockReturnValue([visibleNamespaces(['solar-dev', 'solar-test']), null]);
    rerender(form());
    expect(screen.getByRole('combobox', { name: 'Namespace' }).textContent).toBe('solar-test');
    expect(
      (screen.getByLabelText('ResourcePermit name prefix', { exact: false }) as HTMLInputElement)
        .value
    ).toBe('incident');
    mocks.namespaceList.mockReturnValue([visibleNamespaces(['solar-dev']), null]);
    rerender(form());
    expect(screen.getByRole('combobox', { name: 'Namespace' }).textContent).toBe('solar-dev');
  });

  it('keeps readable global templates selectable without matching reported availability', () => {
    mocks.globalTemplateList.mockReturnValue([
      [
        { getName: () => 'grafana', status: { namespaces: ['unseen-namespace'] } },
        { getName: () => 'clusterrole-bindings', status: { namespaces: ['*'] } },
      ],
      null,
    ]);
    render(<CreateResourcePermit cluster="main" namespaces={['solar-test']} />);
    expect(screen.getByRole('button', { name: 'Select template grafana' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Select template clusterrole-bindings' })
    ).toBeTruthy();
  });

  async function submitGeneratedRequest() {
    render(
      <ResourcePermitSetupForm
        cluster="main"
        namespaces={['solar-test']}
        templateKind="GlobalResourcePermitTemplate"
        templateName="access"
      />
    );
    expect(
      (screen.getByRole('checkbox', { name: 'Generate a unique request name' }) as HTMLInputElement)
        .checked
    ).toBe(true);
    expect((screen.getByLabelText('Reason') as HTMLInputElement).required).toBe(false);
    fireEvent.change(screen.getByLabelText('ResourcePermit name prefix', { exact: false }), {
      target: { value: 'incident' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Template Parameters' }));
    const createButton = await screen.findByRole('button', { name: 'Create ResourcePermit' });
    await act(async () => fireEvent.click(createButton));
  }

  it('creates without a reason and navigates to the generated object, closing only its wizard', async () => {
    mocks.post.mockResolvedValue({ metadata: { name: 'incident-x7j2q', namespace: 'solar-test' } });
    await submitGeneratedRequest();
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/c/main/customresources/resourcepermits.capsule.clastix.io/solar-test/incident-x7j2q'
      )
    );
    expect(mocks.post.mock.calls[0][1].metadata).toEqual({
      generateName: 'incident-',
      namespace: 'solar-test',
    });
    expect(mocks.post.mock.calls[0][1].spec).not.toHaveProperty('reason');
    expect(mocks.close).toHaveBeenCalledWith('capsule-create-resource-permit solar-test main');
  });

  it('keeps the wizard open after an API failure', async () => {
    mocks.post.mockRejectedValue(new Error('Request rejected'));
    await submitGeneratedRequest();
    expect(await screen.findByText('Request rejected')).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
