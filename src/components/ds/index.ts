/**
 * Solar OS v2 Design System — single import surface.
 * All new v2 UI code MUST import from here. Never import legacy shadcn primitives
 * for new screens. Legacy /components/ui/* remains for backward compatibility.
 */
export * from "./tokens";
export { DsButton } from "./button";
export { DsCard, DsCardHeader, DsCardFooter } from "./card";
export { DsBadge, DsCount } from "./badge";
export { DsAlert } from "./alert";
export { DsEmpty } from "./empty";
export { DsSkeleton, DsSkeletonList } from "./skeleton";
export { DsPageHeader, DsSection } from "./page-header";
export { DsStat } from "./stat";
