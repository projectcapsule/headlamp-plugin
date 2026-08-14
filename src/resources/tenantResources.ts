import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class TenantResource extends KubeObject<TenantResourceObject> {
  static kind: string = 'TenantResource';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'tenantresources';

  static isNamespaced: boolean = true;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export class GlobalTenantResource extends KubeObject<GlobalTenantResourceObject> {
  static kind: string = 'GlobalTenantResource';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'globaltenantresources';

  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface ResourceEntry {
  apiVersion?: string;
  kind: string;
  name?: string;
  namespace?: string;
  labelSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: string;
      values?: string[];
    }>;
  };
  fieldSelector?: string;
  syncOptions?: {
    force?: boolean;
    ignoreNotFound?: boolean;
  };
}

export interface ResourceStatusEntry {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  uid?: string;
  lastUpdateTime?: string;
}

export interface ProcessedItem {
  group?: string;
  kind: string;
  name: string;
  namespace?: string;
  origin?: string;
  tenant?: string;
  version?: string;
  status?: {
    created?: boolean;
    lastApply?: string;
    message?: string;
    status?: string;
    type?: string;
  };
}

export interface TenantResourceObject extends KubeObjectInterface {
  spec?: {
    cordoned?: boolean;
    dependsOn?: Array<{ name: string }>;
    tenantSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{
        key: string;
        operator: string;
        values?: string[];
      }>;
    };
    resyncPeriod?: string;
    resources?: any[];
  };
  status?: {
    resources?: ResourceStatusEntry[];
    processedItems?: ProcessedItem[];
    size?: number;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime: string;
      reason: string;
      message: string;
    }>;
  };
}

export interface GlobalTenantResourceObject extends KubeObjectInterface {
  spec?: {
    cordoned?: boolean;
    dependsOn?: Array<{ name: string }>;
    tenantSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{
        key: string;
        operator: string;
        values?: string[];
      }>;
    };
    resyncPeriod?: string;
    resources?: any[];
  };
  status?: {
    resources?: ResourceStatusEntry[];
    processedItems?: ProcessedItem[];
    size?: number;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime: string;
      reason: string;
      message: string;
    }>;
  };
}

export {
  getAppliedCount,
  getAppliedObjectsForTable,
  getDefinedReplicationEntries,
  getManagedObjectReadyStatus,
  getManagedObjectStatusMessage,
  getPlural,
  getReplicationDependencies,
  getResourceCondition,
  getSpecResourcesCount,
  hasReadyConditionTrue,
  isResourceReady,
  type ReplicationDependency,
  type ReplicationDependencyState,
} from './tenantResources.helpers';
