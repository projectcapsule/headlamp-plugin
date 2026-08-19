import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export interface GlobalProxySubject {
  kind: 'User' | 'Group' | 'ServiceAccount' | string;
  name: string;
}

export interface GlobalProxySelectorExpression {
  key: string;
  operator: string;
  values?: string[];
}

export interface GlobalProxyClusterResource {
  apiGroups: string[];
  resources: string[];
  operations?: string[];
  selector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: GlobalProxySelectorExpression[];
  };
}

export interface GlobalProxyRule {
  subjects: GlobalProxySubject[];
  clusterResources?: GlobalProxyClusterResource[];
}

export interface GlobalProxySettingsObject extends KubeObjectInterface {
  spec?: {
    rules?: GlobalProxyRule[];
  };
  status?: {
    observedGeneration?: number;
    conditions?: Array<{
      type: string;
      status: string | boolean;
      lastTransitionTime?: string;
      observedGeneration?: number;
      reason?: string;
      message?: string;
    }>;
  };
}

export class GlobalProxySettings extends KubeObject<GlobalProxySettingsObject> {
  static kind: string = 'GlobalProxySettings';
  static apiVersion: string = 'capsule.clastix.io/v1beta1';
  static apiName: string = 'globalproxysettings';
  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}
