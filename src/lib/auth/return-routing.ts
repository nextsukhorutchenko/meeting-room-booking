import {safeReturnTo} from '../i18n/ui-errors';

export const authReturnToHeader = 'x-roomwork-return-to';

export function loginPathForReturnTo(value: string | null): string {
  return `/login?returnTo=${encodeURIComponent(safeReturnTo(value))}`;
}
