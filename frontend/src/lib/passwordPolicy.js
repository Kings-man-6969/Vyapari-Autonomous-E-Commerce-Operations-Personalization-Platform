/**
 * The account password policy, mirrored on the client.
 *
 * The server is the authority -- `validate_password()` in backend-core-py/app/email.py
 * rejects anything that fails, and the register and reset routes both call it.
 * This exists purely so a user finds out *before* they submit, which matters
 * most on the reset page: that link is single-use, and a typo discovered only
 * after a round trip would burn it.
 *
 * Two copies of a policy will drift. When either side changes, change both.
 */

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (p) => p.length >= 8,
  },
  {
    id: 'letter',
    label: 'At least one letter',
    test: (p) => /[a-zA-Z]/.test(p),
  },
  {
    id: 'digit',
    label: 'At least one number',
    test: (p) => /[0-9]/.test(p),
  },
];

/**
 * Passwords that satisfy the length and composition rules and are still the
 * first thing an attacker tries. Matched case-insensitively, so `Password1`
 * is caught.
 */
export const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123',
  'passw0rd', 'passw0rd1', 'p@ssword', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', '1234567',
  'qwertyui', 'qwerty123', 'qwerty12', 'qwertyuiop',
  'iloveyou', 'letmein1', 'welcome1', 'admin123',
  'abc12345', 'abcd1234', 'test1234', 'changeme',
  'sunshine', 'football', 'baseball', 'trustno1',
]);

/**
 * Evaluates a candidate password.
 *
 * `common` is reported separately from the rule list so the UI can show it as
 * its own line rather than as a rule the user cannot satisfy by typing harder.
 *
 * @returns {{ ok: boolean, checks: Array<{id,label,ok}>, common: boolean }}
 */
export function evaluatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const checks = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(value) }));
  const common = value.length > 0 && COMMON_PASSWORDS.has(value.toLowerCase());
  return { ok: checks.every((c) => c.ok) && !common, checks, common };
}
