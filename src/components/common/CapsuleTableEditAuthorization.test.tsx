import { Fragment } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CapsuleEditAuthorizationPrewarm,
  prewarmCapsuleTableEditAuthorization,
} from './CapsuleTableEditAuthorization';

vi.mock('@kinvolk/headlamp-plugin/lib/components/common', () => ({
  AuthVisible: ({ children }: any) => children,
}));

describe('Capsule table Edit authorization', () => {
  const columns = [
    {
      id: 'name',
      label: 'Name',
      getValue: (item: any) => item.name,
      render: (item: any) => item.name,
    },
    { id: 'ready', label: 'Ready', getValue: () => 'True' },
  ];

  it('prewarms Edit without adding a visible table column', () => {
    const result = prewarmCapsuleTableEditAuthorization({ id: 'capsule-tenants', columns });

    expect(result).toHaveLength(columns.length);
    expect(result.map(column => column.id)).toEqual(['name', 'ready']);

    const rendered = result[0].render({ name: 'solar' });
    expect(rendered.type).toBe(Fragment);
    expect(rendered.props.children[0]).toBe('solar');
    expect(rendered.props.children[1].type).toBe(CapsuleEditAuthorizationPrewarm);
  });

  it('does not process read-only, unknown, or already processed tables', () => {
    expect(prewarmCapsuleTableEditAuthorization({ id: 'capsule-overview-events', columns })).toBe(
      columns
    );
    expect(prewarmCapsuleTableEditAuthorization({ id: 'headlamp-pods', columns })).toBe(columns);

    const processed = prewarmCapsuleTableEditAuthorization({ id: 'capsule-tenants', columns });
    expect(
      prewarmCapsuleTableEditAuthorization({ id: 'capsule-tenants', columns: processed })
    ).toBe(processed);
  });
});
