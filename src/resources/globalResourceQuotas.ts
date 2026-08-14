import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class GlobalResourceQuota extends KubeObject<GlobalResourceQuotaObject> {
  static kind: string = 'GlobalResourceQuota';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'globalresourcequotas';
  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface GlobalResourceQuotaObject extends KubeObjectInterface {
  spec?: {
    namespaceSelectors?: Array<{
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{
        key: string;
        operator: string;
        values?: string[];
      }>;
    }>;
    quota?: {
      hard?: Record<string, string | number>;
      scopes?: string[];
      scopeSelector?: {
        matchExpressions?: Array<{
          scopeName: string;
          operator: string;
          values?: string[];
        }>;
      };
    };
  };
  status?: {
    namespaceCount?: number;
    namespaces?: string[];
    observedGeneration?: number;
    conditions?: Array<{
      type: string;
      status: string | boolean;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
    namespaceUsage?: Record<
      string,
      {
        used?: Record<string, string | number>;
      }
    >;
    total?: {
      available?: Record<string, string | number>;
      hard?: Record<string, string | number>;
      used?: Record<string, string | number>;
    };
  };
}
