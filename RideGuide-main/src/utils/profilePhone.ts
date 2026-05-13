/** True when the user has a non-empty phone on their profile (Privacy screen). */
export function hasSavedProfilePhone(phone: string | null | undefined): boolean {
  return typeof phone === 'string' && phone.trim().length > 0;
}
