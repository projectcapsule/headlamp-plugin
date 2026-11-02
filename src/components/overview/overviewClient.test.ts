// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: vi.fn() }));
import { type CollectionSpec, createOverviewClient } from './overviewClient';
const spec: CollectionSpec = {
  id: 'Tenant',
  kind: 'Tenant',
  plural: 'tenants',
  versions: ['capsule.clastix.io/v1beta2'],
  namespaced: false,
};
describe('bounded Capsule overview requests', () => {
  it('paginates cluster-scoped APIs without adding a namespace and pins the cluster', async () => {
    const request = vi.fn(async (path: string, options: any) => {
      expect(options.cluster).toBe('cluster-b');
      expect(options.method).toBe('GET');
      expect(path).not.toContain('/namespaces/');
      return new URL(path, 'http://cluster').searchParams.has('continue')
        ? { items: [{ metadata: { name: 'two' } }] }
        : { items: [{ metadata: { name: 'one' } }], metadata: { continue: 'next/page' } };
    });
    const result = await createOverviewClient(request).load(
      spec,
      { cluster: 'cluster-b', namespaces: ['team'] },
      new AbortController().signal
    );
    expect(result.items.map(item => item.metadata.name)).toEqual(['one', 'two']);
    expect(result.items.every(item => item.kind === 'Tenant' && item.cluster === 'cluster-b')).toBe(
      true
    );
  });
  it('settles every queued API even if transports ignore cancellation', async () => {
    const results = new Map();
    await createOverviewClient(() => new Promise(() => {}), 100, 15).run(
      Array.from({ length: 13 }, (_, index) => ({ ...spec, id: String(index) })),
      [{ cluster: 'a' }],
      (id, result) => results.set(id, result),
      new AbortController().signal
    );
    expect(results.size).toBe(13);
    expect([...results.values()].every(result => result.error.status === 408)).toBe(true);
  });
  it('does not broaden an excluded namespace selection while retaining global resources', async () => {
    const request = vi.fn(async () => ({ items: [] }));
    const client = createOverviewClient(request);
    const scope = { cluster: 'a', namespacedExcluded: true };
    await client.load({ ...spec, namespaced: true }, scope, new AbortController().signal);
    expect(request).not.toHaveBeenCalled();
    await client.load(spec, scope, new AbortController().signal);
    expect(request).toHaveBeenCalledOnce();
  });
});
