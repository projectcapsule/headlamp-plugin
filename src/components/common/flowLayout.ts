/** Centers a source node on the actual bounds of a vertically spaced target column. */
export function centerSourceOnTargetRows({
  rowCount,
  sourceHeight,
  targetHeight,
  targetStartY,
  targetStepY,
}: {
  rowCount: number;
  sourceHeight: number;
  targetHeight: number;
  targetStartY: number;
  targetStepY: number;
}): number {
  const rows = Math.max(1, rowCount);
  const targetColumnHeight = targetHeight + (rows - 1) * targetStepY;
  return targetStartY + (targetColumnHeight - sourceHeight) / 2;
}
