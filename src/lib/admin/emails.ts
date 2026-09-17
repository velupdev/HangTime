/** HangTime owners who can open /admin. Lowercase emails only. */
export const ADMIN_EMAILS = ["joe@ace805.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
