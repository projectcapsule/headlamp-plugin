import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export interface CapsuleConfigurationIdentity {
  kind: 'User' | 'Group' | 'ServiceAccount' | string;
  name: string;
}

export interface CapsuleConfigurationWebhook {
  failurePolicy?: string;
  matchPolicy?: string;
  name: string;
  path?: string;
  rules?: Array<Record<string, unknown>>;
}

export interface CapsuleConfigurationAdmissionGroup {
  client?: {
    service?: {
      name?: string;
      namespace?: string;
      port?: number;
    };
    url?: string;
  };
  name?: string;
  webhooks?: CapsuleConfigurationWebhook[];
}

export class CapsuleConfiguration extends KubeObject<CapsuleConfigurationObject> {
  static kind = 'CapsuleConfiguration';
  static apiVersion = 'capsule.clastix.io/v1beta2';
  static apiName = 'capsuleconfigurations';
  static isNamespaced = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface CapsuleConfigurationObject extends KubeObjectInterface {
  spec?: {
    administrators?: CapsuleConfigurationIdentity[];
    admission?: {
      mutating?: CapsuleConfigurationAdmissionGroup;
      serviceName?: string;
      validating?: CapsuleConfigurationAdmissionGroup;
    };
    allowServiceAccountPromotion?: boolean;
    cacheInvalidation?: string;
    enableTLSReconciler?: boolean;
    events?: {
      namespace?: string;
    };
    forceTenantPrefix?: boolean;
    ignoreUserWithGroups?: string[];
    nodeMetadata?: {
      forbiddenAnnotations?: { denied?: string[]; deniedRegex?: string };
      forbiddenLabels?: { denied?: string[]; deniedRegex?: string };
    };
    overrides?: Record<string, string>;
    protectedNamespaceRegex?: string;
    rbac?: {
      administrationClusterRoles?: string[];
      deleter?: string;
      promotionClusterRoles?: string[];
      provisioner?: string;
    };
    users?: CapsuleConfigurationIdentity[];
  };
  status?: {
    conditions?: Array<{
      lastTransitionTime?: string;
      message?: string;
      observedGeneration?: number;
      reason?: string;
      status: string | boolean;
      type: string;
    }>;
    observedGeneration?: number;
    tenants?: string[];
    users?: CapsuleConfigurationIdentity[];
  };
}
