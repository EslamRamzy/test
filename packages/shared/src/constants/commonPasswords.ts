/**
 * A small, curated list of extremely common passwords (docs/architecture/04
 * §4: "checked against a small list of common passwords"). Deliberately not
 * a multi-thousand-entry breach-corpus import — the goal is to catch the
 * obviously bad choices someone would actually type
 * (`password123`, `qwertyuiop`, the site's own name), not to replicate a
 * dedicated credential-screening service. Checked case-insensitively, and
 * against the password with all whitespace removed, so `Password 1234` does
 * not slip past `password1234`.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  'password',
  'password1',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'qwerty123',
  'letmein123',
  'admin12345',
  'welcome123',
  'iloveyou123',
  'trustno1123',
  'dragon12345',
  'monkey12345',
  'football123',
  'baseball123',
  'sunshine123',
  'princess123',
  'superman123',
  'changeme123',
  'passw0rd123',
  'correcthorsebatterystaple',
  'administrator',
  'letmeinplease',
];
