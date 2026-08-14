import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export class CapsuleConfiguration extends KubeObject<CapsuleConfigurationObject> {
  static kind = 'CapsuleConfiguration';
  static apiVersion = 'capsule.clastix.io/v1beta2';
  static apiName = 'capsuleconfigurations';
  static isNamespaced = false;

  get spec() {
    return this.jsonData.spec;
  }
}

export interface CapsuleConfigurationObject extends KubeObjectInterface {
  spec?: {
    allowServiceAccountPromotion?: boolean;
  };
}
