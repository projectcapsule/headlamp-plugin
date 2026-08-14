import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class TenantOwner extends KubeObject<TenantOwnerObject> {
  static kind: string = 'TenantOwner';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'tenantowners';
  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface TenantOwnerObject extends KubeObjectInterface {
  spec?: {
    aggregate?: boolean;
    clusterRoles?: string[];
    kind?: string;
    name?: string;
  };
  status?: {
    observedGeneration?: number;
    tenants?: string[];
    conditions?: Array<{
      type: string;
      status: string | boolean;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
  };
}
