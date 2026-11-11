/**
 * pg 8 parses `sslmode=require|prefer|verify-ca` as `verify-full` and prints a
 * security warning on every new connection. Pinning `verify-full` keeps that
 * behavior and silences the warning. Other modes (including `verify-full` and
 * `disable`) are left untouched.
 *
 * @param {string} connectionString
 * @returns {string}
 */
export function quietPgSslMode(connectionString) {
  return connectionString.replace(
    /([?&])sslmode=(require|prefer|verify-ca)(?=&|#|$)/gi,
    "$1sslmode=verify-full",
  );
}
