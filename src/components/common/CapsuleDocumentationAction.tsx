import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';
import { ActionButton } from '@kinvolk/headlamp-plugin/lib/components/common';
import { documentationUrlForResource } from './capsuleDocumentation';

export interface CapsulePluginConfig {
  documentationBaseUrl?: string;
}

export const capsulePluginConfig = new ConfigStore<CapsulePluginConfig>('capsule');
const useCapsulePluginConfig = capsulePluginConfig.useConfig();

export function CapsuleDocumentationAction(props: any) {
  const resource = props.item || props.resource;
  const config = useCapsulePluginConfig();
  const documentationUrl = documentationUrlForResource(resource, config?.documentationBaseUrl);
  if (!documentationUrl) return null;

  const openDocumentation = () => {
    const documentationWindow = window.open(documentationUrl, '_blank', 'noopener,noreferrer');
    if (documentationWindow) documentationWindow.opener = null;
  };

  return (
    <ActionButton
      description="Open Capsule documentation"
      longDescription={`Open Capsule documentation for ${resource?.kind || 'this resource'}`}
      icon="mdi:book-open-page-variant-outline"
      onClick={openDocumentation}
    />
  );
}
