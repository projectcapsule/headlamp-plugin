import { Icon } from '@iconify/react';
import { Box, IconButton, Tooltip, Typography, type TypographyProps } from '@mui/material';
import { type ReactNode, useEffect } from 'react';

/** Converts a visible section title into a stable, URL-safe fragment identifier. */
export function sectionAnchorId(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'section';
}

function hashTarget(): string {
  if (typeof window === 'undefined') return '';
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return window.location.hash.slice(1);
  }
}

export function SectionAnchorLink({ anchor, label }: { anchor?: string; label: string }) {
  const id = sectionAnchorId(anchor || label);

  useEffect(() => {
    if (hashTarget() !== id) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [id]);

  return (
    <Box
      component="span"
      id={id}
      sx={{
        alignItems: 'center',
        display: 'inline-flex',
        scrollMarginTop: '9rem',
        verticalAlign: 'middle',
      }}
    >
      <Tooltip title={`Link to ${label}`}>
        <IconButton
          aria-label={`Link to ${label}`}
          component="a"
          href={`#${id}`}
          size="small"
          sx={{
            color: 'text.secondary',
            ml: 0.25,
            opacity: 0.55,
            p: 0.25,
            transition: theme => theme.transitions.create('opacity'),
            '&:focus-visible, &:hover': { opacity: 1 },
          }}
        >
          <Icon icon="mdi:link-variant" width={18} height={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export interface AnchoredSubheadingProps extends Omit<TypographyProps, 'children' | 'title'> {
  anchor?: string;
  children?: ReactNode;
  title: string;
}

/** A lower-level shareable heading for groups nested inside a SectionBox. */
export function AnchoredSubheading({
  anchor,
  children,
  title,
  ...typographyProps
}: AnchoredSubheadingProps) {
  return (
    <Typography {...typographyProps}>
      {children ?? title}
      <SectionAnchorLink anchor={anchor} label={title} />
    </Typography>
  );
}

/**
 * Adds an anchor to a ResourceListView heading while preserving Headlamp's
 * create, filter, and caller-provided header actions.
 */
export function anchoredResourceListHeaderProps(
  title: string,
  { anchor, headerProps = {} }: { anchor?: string; headerProps?: any } = {}
) {
  return {
    ...headerProps,
    actions: [
      ...(headerProps.actions || []),
      <SectionAnchorLink key="capsule-section-anchor" anchor={anchor} label={title} />,
    ],
  };
}

export default SectionAnchorLink;
