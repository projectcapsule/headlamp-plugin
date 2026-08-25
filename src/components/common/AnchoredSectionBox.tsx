import { SectionBox, type SectionBoxProps } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { SectionAnchorLink } from './SectionAnchor';

export interface AnchoredSectionBoxProps extends Omit<SectionBoxProps, 'title'> {
  anchor?: string;
  title: string;
}

/** Headlamp SectionBox with a shareable fragment link beside its standard heading. */
export function AnchoredSectionBox({
  anchor,
  headerProps,
  title,
  ...props
}: AnchoredSectionBoxProps) {
  const titleSideActions = [
    ...(headerProps?.titleSideActions || []),
    <SectionAnchorLink key="capsule-section-anchor" anchor={anchor} label={title} />,
  ];

  return (
    <SectionBox
      {...props}
      title={title}
      headerProps={{
        noPadding: false,
        headerStyle: 'subsection',
        ...headerProps,
        titleSideActions,
      }}
    />
  );
}

export default AnchoredSectionBox;
