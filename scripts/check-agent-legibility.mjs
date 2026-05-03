#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'docs/INDEX.md',
  'docs/ARCHITECTURE.md',
  'docs/DEVELOPMENT.md',
  'docs/RELIABILITY.md',
  'docs/QUALITY.md',
  'docs/plans/README.md'
];

const requiredPackageScripts = [
  'lint',
  'test',
  'build',
  'docs:check',
  'verify'
];

const pnpmBuiltIns = new Set([
  'add',
  'approve-builds',
  'audit',
  'config',
  'create',
  'dlx',
  'exec',
  'install',
  'link',
  'list',
  'outdated',
  'prune',
  'publish',
  'rebuild',
  'remove',
  'run',
  'setup',
  'store',
  'unlink',
  'update'
]);

const maxAgentsLines = 120;
const failures = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function addFailure(message) {
  failures.push(message);
}

function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function normalizeLinkTarget(target) {
  return decodeURIComponent(target.split('#')[0].trim());
}

function isLocalLink(target) {
  return (
    target.length > 0 &&
    !target.startsWith('#') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(target) &&
    !target.startsWith('mailto:')
  );
}

function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (!exists(file)) {
      addFailure(`Missing required file: ${file}`);
    }
  }
}

function checkAgentsLength() {
  if (!exists('AGENTS.md')) {
    return;
  }

  const lineCount = readText('AGENTS.md').split(/\r?\n/).length;
  if (lineCount > maxAgentsLines) {
    addFailure(
      `AGENTS.md has ${lineCount} lines; keep it at or below ${maxAgentsLines}.`
    );
  }
}

function checkMarkdownLinks(file) {
  if (!exists(file)) {
    return;
  }

  const markdown = stripCodeBlocks(readText(file));
  const linkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const baseDir = path.dirname(path.join(root, file));

  for (const match of markdown.matchAll(linkPattern)) {
    const target = normalizeLinkTarget(match[1]);
    if (!isLocalLink(target)) {
      continue;
    }

    const targetPath = path.resolve(baseDir, target);
    const relativeTarget = path.relative(root, targetPath);

    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      addFailure(`${file} links outside the repository: ${match[1]}`);
      continue;
    }

    if (!fs.existsSync(targetPath)) {
      addFailure(`${file} has a broken local link: ${match[1]}`);
    }
  }
}

function loadPackageJson() {
  try {
    return JSON.parse(readText('package.json'));
  } catch (error) {
    addFailure(`Unable to read package.json: ${error.message}`);
    return { scripts: {} };
  }
}

function checkRequiredScripts(scripts) {
  for (const script of requiredPackageScripts) {
    if (!scripts?.[script]) {
      addFailure(`package.json is missing required script: ${script}`);
    }
  }
}

function checkDocumentedPnpmScripts(scripts) {
  const scriptNames = new Set(Object.keys(scripts ?? {}));
  const pnpmPattern = /`pnpm\s+([a-z0-9:_-]+)\b[^`]*`/gi;

  for (const file of requiredFiles) {
    if (!exists(file)) {
      continue;
    }

    const markdown = readText(file);
    for (const match of markdown.matchAll(pnpmPattern)) {
      const command = match[1];
      if (pnpmBuiltIns.has(command) || scriptNames.has(command)) {
        continue;
      }

      addFailure(
        `${file} references pnpm script "${command}", but package.json does not define it.`
      );
    }
  }
}

checkRequiredFiles();
checkAgentsLength();

for (const file of requiredFiles) {
  checkMarkdownLinks(file);
}

const packageJson = loadPackageJson();
checkRequiredScripts(packageJson.scripts);
checkDocumentedPnpmScripts(packageJson.scripts);

if (failures.length > 0) {
  console.error('Agent legibility check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Agent legibility check passed: ${requiredFiles.length} required files, Markdown links, AGENTS.md length, and package scripts are valid.`
);
