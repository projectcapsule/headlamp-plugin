export const CAPSULE_API_GROUP = 'capsule.clastix.io';

export function isCapsuleResourceEvent(event: any): boolean {
  const involvedObject = event?.involvedObject || event?.jsonData?.involvedObject;
  const apiVersion = String(involvedObject?.apiVersion || '');
  return apiVersion === CAPSULE_API_GROUP || apiVersion.startsWith(`${CAPSULE_API_GROUP}/`);
}

export function capsuleEventTimestamp(event: any): string {
  const data = event?.jsonData || event || {};
  return (
    event?.lastOccurrence ||
    data.series?.lastObservedTime ||
    data.lastTimestamp ||
    data.eventTime ||
    data.metadata?.creationTimestamp ||
    ''
  );
}
