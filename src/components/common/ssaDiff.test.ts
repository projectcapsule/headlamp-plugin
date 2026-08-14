import { describe, expect, it } from 'vitest';
import { buildSSAFieldLines, mergeSSAFields, selectReplicationManagedFields } from './ssaDiff';

describe('buildSSAFieldLines', () => {
  it('marks only fields present in the SSA ownership tree', () => {
    const lines = buildSSAFieldLines(
      {
        apiVersion: 'v1',
        metadata: { name: 'settings', labels: { app: 'demo', owner: 'platform' } },
        data: { enabled: 'true' },
      },
      {
        'f:metadata': { 'f:labels': { 'f:app': {} } },
        'f:data': { 'f:enabled': {} },
      }
    );

    expect(lines.find(line => line.text.trim() === 'app: "demo"')?.managed).toBe(true);
    expect(lines.find(line => line.text.trim() === 'owner: "platform"')?.managed).toBe(false);
    expect(lines.find(line => line.text.trim() === 'apiVersion: "v1"')?.managed).toBe(false);
  });

  it('matches Kubernetes keyed-list ownership to the correct array item', () => {
    const lines = buildSSAFieldLines(
      {
        spec: {
          containers: [
            { name: 'app', image: 'app:v2' },
            { name: 'sidecar', image: 'sidecar:v1' },
          ],
        },
      },
      {
        'f:spec': {
          'f:containers': {
            'k:{"name":"app"}': { 'f:name': {}, 'f:image': {} },
          },
        },
      }
    );

    const appImage = lines.find(line => line.text.trim() === 'image: "app:v2"');
    const sidecarImage = lines.find(line => line.text.trim() === 'image: "sidecar:v1"');
    expect(appImage?.managed).toBe(true);
    expect(sidecarImage?.managed).toBe(false);
  });

  it('omits metadata.managedFields from the displayed live object', () => {
    const lines = buildSSAFieldLines(
      { metadata: { name: 'demo', managedFields: [{ manager: 'capsule' }] } },
      { 'f:metadata': { 'f:name': {} } }
    );

    expect(lines.some(line => line.text.includes('managedFields'))).toBe(false);
  });

  it('combines fields owned by the generator and Capsule controller', () => {
    const selected = selectReplicationManagedFields([
      {
        manager: 'a7ft3r96j8zc/green-prod/green/0/generator-0-0/',
        operation: 'Apply',
        fieldsV1: { 'f:data': { 'f:generated': {} } },
      },
      {
        manager: 'projectcapsule.dev/resource/controller',
        operation: 'Update',
        fieldsV1: { 'f:metadata': { 'f:labels': { 'f:capsule': {} } } },
      },
      { manager: 'kubectl', operation: 'Update', fieldsV1: { 'f:other': {} } },
    ]);
    const combined = mergeSSAFields(...selected.map(field => field.fieldsV1));
    const lines = buildSSAFieldLines(
      {
        metadata: { labels: { capsule: 'managed', other: 'manual' } },
        data: { generated: 'yes' },
      },
      combined
    );

    expect(selected.map(field => field.manager)).toEqual([
      'a7ft3r96j8zc/green-prod/green/0/generator-0-0/',
      'projectcapsule.dev/resource/controller',
    ]);
    expect(lines.find(line => line.text.trim() === 'generated: "yes"')?.managed).toBe(true);
    expect(lines.find(line => line.text.trim() === 'capsule: "managed"')?.managed).toBe(true);
    expect(lines.find(line => line.text.trim() === 'other: "manual"')?.managed).toBe(false);
  });
});
