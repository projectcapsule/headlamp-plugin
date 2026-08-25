import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { AnchoredSubheading } from './SectionAnchor';

export interface SummaryCardGridProps {
  children: ReactNode;
  /** Maximum number of cards in a row at the large breakpoint. */
  columns?: 1 | 2 | 3 | 4;
  /** Optional heading for a semantic group of summary cards. */
  title?: string;
  /** Bottom margin after the group. */
  marginBottom?: number;
  /** Match Headlamp SectionBox gutters when the grid precedes a list section. */
  inset?: boolean;
}

/**
 * Shared responsive layout for summary cards.
 *
 * All cards in the same visual row stretch to an equal height. On narrow
 * screens the grid collapses to one or two columns without leaving partial
 * MUI Grid widths or uneven right margins.
 */
export function SummaryCardGrid({
  children,
  columns = 3,
  title,
  marginBottom = 3,
  inset = false,
}: SummaryCardGridProps) {
  const smallColumns = Math.min(columns, 2);
  const mediumColumns = columns === 4 ? 2 : columns;

  return (
    <Box
      component={title ? 'section' : 'div'}
      sx={{
        mb: marginBottom,
        minWidth: 0,
        px: inset ? { xs: 0, sm: 2 } : 0,
        pt: inset ? { xs: 2, sm: 3 } : 0,
      }}
    >
      {title && (
        <AnchoredSubheading
          title={title}
          variant="h6"
          component="h2"
          sx={{ fontWeight: 500, mb: 1.5 }}
        />
      )}
      <Box
        sx={{
          alignItems: 'stretch',
          display: 'grid',
          gap: 2,
          gridAutoRows: '1fr',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: `repeat(${smallColumns}, minmax(0, 1fr))`,
            md: `repeat(${mediumColumns}, minmax(0, 1fr))`,
            lg: `repeat(${columns}, minmax(0, 1fr))`,
          },
          minWidth: 0,
          width: '100%',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default SummaryCardGrid;
