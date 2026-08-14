import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class Tenants extends KubeObject<TenantsObject> {
  static kind: string = 'Tenant';
  static apiVersion: string = 'capsule.clastix.io/v1beta2';
  static apiName: string = 'tenants';

  static isNamespaced: boolean = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }

  get annotations() {
    return this.jsonData.metadata?.annotations || {};
  }

  get infoIcon() {
    return this.annotations['info.projectcapsule.dev/icon'];
  }

  get infoDescription() {
    return this.annotations['info.projectcapsule.dev/description'];
  }

  get infoLinks() {
    const str = this.annotations['info.projectcapsule.dev/links'];
    if (!str) return [];
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  get infoBanner() {
    return this.annotations['info.projectcapsule.dev/banner'];
  }
}

export interface TenantsObject extends KubeObjectInterface {
  spec?: {
    cordoned?: boolean;
    owners?: Array<{
      apiGroup: string;
      kind: string;
      name: string;
    }>;
    tenant?: string;
    namespaces?: string[];
    storageClasses?: string[] | { allowed?: string[]; allowedRegex?: string };
    ingressClasses?: { allowed?: string[] };
    nodeSelector?: Record<string, string>;
    namespaceOptions?: {
      quota?: number;
    };
    permissions?: {
      allowOwnerPromotion?: boolean;
    };
    forbiddenAnnotations?: string[];
    forbiddenLabels?: string[];
    // Note: additionalPodSpecs and other advanced options exist in Capsule but are not fully modeled here
    // as the plugin primarily visualizes common ones (nodeSelector, storage/ingress classes).
  };
  status?: {
    observedGeneration?: number;
    state: string;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime: string;
      reason: string;
      message: string;
    }>;
    namespaces?: string[] | number;
    size?: number;
    spaces?: Record<string, any> | any[];
    promotions?: Array<{
      clusterRoles?: string[];
      kind: 'User' | 'Group' | 'ServiceAccount';
      name: string;
      targets?: string[];
    }>;
  };
}
