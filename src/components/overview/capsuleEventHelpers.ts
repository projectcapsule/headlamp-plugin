export const CAPSULE_API_GROUP = 'capsule.clastix.io';

export function isCapsuleResourceEvent(event: any): boolean {
  const involvedObject = event?.involvedObject || event?.jsonData?.involvedObject;
  const apiVersion = String(involvedObject?.apiVersion || '');
  return apiVersion === CAPSULE_API_GROUP || apiVersion.startsWith(`${CAPSULE_API_GROUP}/`);
}

export function capsuleEventTimestamp(event: any): string {
  return (
    event?.lastOccurrence ||
    event?.jsonData?.series?.lastObservedTime ||
    event?.jsonData?.lastTimestamp ||
    event?.jsonData?.eventTime ||
    event?.metadata?.creationTimestamp ||
    ''
  );
}
