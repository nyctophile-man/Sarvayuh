import { LIGHT } from '@/lib/theme/colors';
import { makeSharedStyles } from '@/lib/theme/styles';

/**
 * Legacy static palette. Prefer `useTheme()` from `@/lib/theme` so light and
 * dark mode apply everywhere; these exports stay for the light appearance and
 * for code that has not been converted yet.
 */
export const C = LIGHT;
export const s = makeSharedStyles(LIGHT);
