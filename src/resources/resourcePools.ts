import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class ResourcePool extends KubeObject<ResourcePoolObject> {
  static kind: string = 'ResourcePool';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'resourcepools';
  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export class ResourcePoolClaim extends KubeObject<ResourcePoolClaimObject> {
  static kind: string = 'ResourcePoolClaim';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'resourcepoolclaims';
  static isNamespaced: boolean = true;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface CapsuleCondition {
  type: string;
  status: string | boolean;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ResourcePoolStatusClaim {
  claims?: Record<string, string | number>;
  name: string;
  namespace: string;
  uid: string;
}

export interface ResourcePoolObject extends KubeObjectInterface {
  spec?: {
    config?: {
      defaultsZero?: boolean;
      deleteBoundResources?: boolean;
      orderedQueue?: boolean;
    };
    defaults?: Record<string, string | number>;
    quota?: {
      hard?: Record<string, string>;
      scopes?: string[];
      scopeSelector?: {
        matchExpressions?: Array<{
          scopeName: string;
          operator: string;
          values?: string[];
        }>;
      };
    };
    selectors?: Array<{
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{
        key: string;
        operator: string;
        values?: string[];
      }>;
    }>;
  };
  status?: {
    allocation?: {
      available?: Record<string, string | number>;
      hard?: Record<string, string | number>;
      used?: Record<string, string | number>;
    };
    claimCount?: number;
    claims?: Record<string, ResourcePoolStatusClaim[]>;
    namespaceCount?: number;
    namespaces?: string[];
    conditions?: CapsuleCondition[];
    exhaustions?: Record<
      string,
      {
        available?: string | number;
        requesting?: string | number;
      }
    >;
  };
}

export interface ResourcePoolClaimObject extends KubeObjectInterface {
  spec?: {
    claim?: Record<string, string | number>;
    pool?: string;
  };
  status?: {
    conditions?: CapsuleCondition[];
    observedGeneration?: number;
    pool?: {
      name?: string;
      uid?: string;
    };
  };
}
