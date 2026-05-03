#!/usr/bin/env node

const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'LONGPORT_APP_KEY',
  'LONGPORT_APP_SECRET',
  'LONGPORT_ACCESS_TOKEN'
];

const CLERK_REDIRECT_URL_KEYS = [
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL'
];

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg.startsWith('--mode=')) {
        options.mode = arg.slice('--mode='.length);
      } else if (arg === '--skip-load-env') {
        options.loadEnv = false;
      }

      return options;
    },
    { mode: null, loadEnv: true }
  );
}

function getMode(mode) {
  if (mode === 'development' || mode === 'production' || mode === 'test') {
    return mode;
  }

  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }

  return 'development';
}

function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level,
    message,
    ...context
  };

  if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
    // eslint-disable-next-line no-console
    console[level](JSON.stringify(payload));
    return;
  }

  const contextKeys = Object.keys(context);
  const suffix =
    contextKeys.length > 0 ? ` ${JSON.stringify(context, null, 2)}` : '';

  // eslint-disable-next-line no-console
  console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}${suffix}`);
}

function getValue(key) {
  return process.env[key];
}

function hasValue(key) {
  return Boolean(getValue(key)?.trim());
}

function isPlaceholderValue(value) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('example') ||
    normalized.includes('changeme') ||
    normalized.includes('change-me') ||
    normalized.includes('replace_me') ||
    normalized.includes('replace-me') ||
    normalized.includes('placeholder') ||
    normalized.includes('your_') ||
    normalized.includes('your-') ||
    normalized.includes('****') ||
    normalized === 'todo' ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized === '<value>' ||
    normalized === '<secret>'
  );
}

function addIssue(issues, key, message, remediation) {
  issues.push({
    key,
    message,
    remediation
  });
}

function validateRequiredValue(issues, key, label) {
  const value = getValue(key);

  if (!value?.trim()) {
    addIssue(
      issues,
      key,
      `Missing required ${label}.`,
      `Set ${key} in .env.local or the deployment environment.`
    );
    return false;
  }

  if (value !== value.trim()) {
    addIssue(
      issues,
      key,
      `${key} contains leading or trailing whitespace.`,
      `Remove surrounding whitespace from ${key}.`
    );
    return false;
  }

  if (value.includes('\n') || value.includes('\r')) {
    addIssue(
      issues,
      key,
      `${key} contains a line break.`,
      `Keep ${key} on a single line.`
    );
    return false;
  }

  if (isPlaceholderValue(value)) {
    addIssue(
      issues,
      key,
      `${key} still looks like a placeholder value.`,
      `Replace ${key} with a real credential.`
    );
    return false;
  }

  return true;
}

function validateOptionalValue(issues, key, label) {
  const value = getValue(key);

  if (!value?.trim()) {
    return false;
  }

  if (value !== value.trim()) {
    addIssue(
      issues,
      key,
      `${key} contains leading or trailing whitespace.`,
      `Remove surrounding whitespace from ${key}.`
    );
    return false;
  }

  if (value.includes('\n') || value.includes('\r')) {
    addIssue(
      issues,
      key,
      `${key} contains a line break.`,
      `Keep ${key} on a single line.`
    );
    return false;
  }

  if (isPlaceholderValue(value)) {
    addIssue(
      issues,
      key,
      `${key} still looks like a placeholder value.`,
      `Remove ${key} or replace it with a real ${label}.`
    );
    return false;
  }

  return true;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isRootRelativeUrl(value) {
  return value.startsWith('/') && !value.startsWith('//');
}

function looksLikeJwt(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function validateClerk(issues) {
  const hasPublishableKey = validateRequiredValue(
    issues,
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'Clerk publishable key'
  );
  const hasSecretKey = validateRequiredValue(
    issues,
    'CLERK_SECRET_KEY',
    'Clerk secret key'
  );

  const publishableKey = getValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')?.trim();
  const secretKey = getValue('CLERK_SECRET_KEY')?.trim();

  if (hasPublishableKey && !/^pk_(test|live)_[^\s]+$/.test(publishableKey)) {
    addIssue(
      issues,
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key.',
      'Use a key that starts with pk_test_ or pk_live_.'
    );
  }

  if (hasSecretKey && !/^sk_(test|live)_[^\s]+$/.test(secretKey)) {
    addIssue(
      issues,
      'CLERK_SECRET_KEY',
      'CLERK_SECRET_KEY does not look like a Clerk secret key.',
      'Use a key that starts with sk_test_ or sk_live_.'
    );
  }

  if (hasPublishableKey && hasSecretKey) {
    const publishableMode = publishableKey.match(/^pk_(test|live)_/)?.[1];
    const secretMode = secretKey.match(/^sk_(test|live)_/)?.[1];

    if (publishableMode && secretMode && publishableMode !== secretMode) {
      addIssue(
        issues,
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'Clerk publishable and secret keys use different environments.',
        'Use both test keys or both live keys.'
      );
    }
  }

  CLERK_REDIRECT_URL_KEYS.forEach((key) => {
    if (!validateOptionalValue(issues, key, 'Clerk redirect URL')) {
      return;
    }

    const value = getValue(key).trim();

    if (!isRootRelativeUrl(value) && !isHttpUrl(value)) {
      addIssue(
        issues,
        key,
        `${key} must be a root-relative path or absolute HTTP(S) URL.`,
        `Use a value like /auth/sign-in or https://example.com/auth/sign-in.`
      );
    }
  });
}

function validateSupabase(issues) {
  if (
    validateRequiredValue(issues, 'NEXT_PUBLIC_SUPABASE_URL', 'Supabase URL') &&
    !isHttpUrl(getValue('NEXT_PUBLIC_SUPABASE_URL').trim())
  ) {
    addIssue(
      issues,
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL must be an absolute HTTP(S) URL.',
      'Use the project API URL from Supabase, for example https://project-ref.supabase.co.'
    );
  }

  const hasPublishableKey = hasValue(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  );
  const hasLegacyAnonKey = hasValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!hasPublishableKey && !hasLegacyAnonKey) {
    addIssue(
      issues,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      'Missing Supabase publishable key.',
      'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    return;
  }

  const selectedKey = hasPublishableKey
    ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
    : 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

  if (!validateRequiredValue(issues, selectedKey, 'Supabase publishable key')) {
    return;
  }

  const selectedValue = getValue(selectedKey).trim();

  if (
    selectedKey === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY' &&
    !selectedValue.startsWith('sb_publishable_') &&
    !looksLikeJwt(selectedValue)
  ) {
    addIssue(
      issues,
      selectedKey,
      `${selectedKey} does not look like a Supabase publishable or legacy anon key.`,
      'Use a value that starts with sb_publishable_ or a legacy JWT-style anon key.'
    );
  }

  if (
    selectedKey === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' &&
    !looksLikeJwt(selectedValue)
  ) {
    addIssue(
      issues,
      selectedKey,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a legacy JWT-style anon key.',
      'Use the anon key from Supabase project settings.'
    );
  }
}

function validateLongbridge(issues) {
  validateRequiredValue(issues, 'LONGPORT_APP_KEY', 'Longbridge app key');
  validateRequiredValue(issues, 'LONGPORT_APP_SECRET', 'Longbridge app secret');
  validateRequiredValue(
    issues,
    'LONGPORT_ACCESS_TOKEN',
    'Longbridge access token'
  );

  validateOptionalValue(issues, 'LONGPORT_REGION', 'Longbridge region');
}

function validateSentry(issues) {
  if (
    validateOptionalValue(
      issues,
      'NEXT_PUBLIC_SENTRY_DISABLED',
      'Sentry disabled flag'
    ) &&
    !/^(true|false)$/i.test(getValue('NEXT_PUBLIC_SENTRY_DISABLED').trim())
  ) {
    addIssue(
      issues,
      'NEXT_PUBLIC_SENTRY_DISABLED',
      'NEXT_PUBLIC_SENTRY_DISABLED must be true or false when set.',
      'Use NEXT_PUBLIC_SENTRY_DISABLED=true to disable Sentry.'
    );
  }

  if (
    validateOptionalValue(issues, 'NEXT_PUBLIC_SENTRY_DSN', 'Sentry DSN') &&
    !isHttpUrl(getValue('NEXT_PUBLIC_SENTRY_DSN').trim())
  ) {
    addIssue(
      issues,
      'NEXT_PUBLIC_SENTRY_DSN',
      'NEXT_PUBLIC_SENTRY_DSN must be a valid Sentry DSN URL when set.',
      'Use a DSN URL from Sentry project settings or leave it empty to use the app default.'
    );
  }

  ['NEXT_PUBLIC_SENTRY_ORG', 'NEXT_PUBLIC_SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN']
    .filter((key) => hasValue(key))
    .forEach((key) => {
      validateOptionalValue(issues, key, 'Sentry value');
    });
}

function validateEnvironment() {
  const issues = [];

  validateClerk(issues);
  validateSupabase(issues);
  validateLongbridge(issues);
  validateSentry(issues);

  return {
    status: issues.length > 0 ? 'blocked' : 'ready',
    checkedKeys: REQUIRED_ENV_KEYS,
    issues
  };
}

function runPreflight(options = {}) {
  const projectDir = options.projectDir ?? process.cwd();
  const mode = getMode(options.mode);
  const loadEnv = options.loadEnv ?? true;
  let loadedEnvFiles = [];

  if (loadEnv) {
    loadedEnvFiles = loadEnvConfig(
      projectDir,
      mode === 'development'
    ).loadedEnvFiles.map((file) => file.path);
  }

  const result = validateEnvironment();

  if (result.status === 'ready') {
    log('info', 'Environment preflight passed', {
      mode,
      loadedEnvFiles,
      checkedKeys: result.checkedKeys
    });
    return result;
  }

  log('error', 'Environment preflight failed', {
    mode,
    loadedEnvFiles,
    issueCount: result.issues.length,
    issues: result.issues
  });

  if (options.exitOnFailure !== false) {
    process.exit(1);
  }

  return result;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  runPreflight({
    mode: options.mode,
    loadEnv: options.loadEnv,
    projectDir: path.resolve(__dirname, '..')
  });
}

module.exports = {
  runPreflight,
  validateEnvironment
};
