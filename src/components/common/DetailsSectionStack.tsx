import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export interface DetailsSectionStackProps {
  children: ReactNode;
}

/**
 * Keeps Capsule subsections inside Headlamp's Resource.DetailsGrid item.
 *
 * DetailsGrid owns the page gutter. Rendering SectionBox components as siblings
 * after DetailsGrid puts them on a different horizontal origin; this single
 * child wrapper keeps every custom subsection aligned with metadata and events.
 */
export function DetailsSectionStack({ children }: DetailsSectionStackProps) {
  return <Box sx={{ minWidth: 0, width: '100%', '& > :last-child': { mb: 0 } }}>{children}</Box>;
}

export default DetailsSectionStack;
