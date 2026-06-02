import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVaultPath,
  getClientDir,
  getCasePath,
  getAntiCasePath,
  getClientMetaPath,
  getStyleGuidePath,
  getClientStyleGuidePath,
  getScenarioOverridePath,
  getIndexDbPath,
  isValidSlug,
  assertSafePath,
} from '../lib/paths.ts';
import { homedir } from 'node:os';
import { join } from 'node:path';

test('paths: getVaultPath default', () => {
  delete process.env.DESIGN_LAB_VAULT_PATH;
  assert.equal(getVaultPath(), join(homedir(), 'Documents', 'CC Cli', 'design-library'));
});

test('paths: getVaultPath honors env override', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/custom-vault';
  assert.equal(getVaultPath(), '/tmp/custom-vault');
  delete process.env.DESIGN_LAB_VAULT_PATH;
});

test('paths: derived paths', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/v';
  assert.equal(getClientDir('aicycle'), '/tmp/v/clients/aicycle');
  assert.equal(getCasePath('aicycle', '0001'), '/tmp/v/clients/aicycle/cases/0001.md');
  assert.equal(getAntiCasePath('aicycle', '0001'), '/tmp/v/clients/aicycle/anti-library/0001.md');
  assert.equal(getClientMetaPath('aicycle'), '/tmp/v/clients/aicycle/meta.yaml');
  assert.equal(getStyleGuidePath(), '/tmp/v/personal-style-guide.md');
  assert.equal(getClientStyleGuidePath('whatcanido'), '/tmp/v/clients/whatcanido/style-guide.md');
  assert.equal(getScenarioOverridePath('landing'), '/tmp/v/scenario-overrides/landing.md');
  assert.equal(getIndexDbPath(), '/tmp/v/.index/library.db');
  delete process.env.DESIGN_LAB_VAULT_PATH;
});

test('paths: isValidSlug accept lowercase a-z 0-9 _ -', () => {
  for (const s of ['aicycle', 'client-foo', '_personal', 'a1b2']) {
    assert.equal(isValidSlug(s), true, `expected ${s} to be valid`);
  }
});

test('paths: isValidSlug reject unsafe', () => {
  for (const s of ['../etc', 'a/b', 'A-Big', 'foo bar', '']) {
    assert.equal(isValidSlug(s), false, `expected ${s} to be invalid`);
  }
});

test('paths: assertSafePath blocks traversal', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/v';
  assert.doesNotThrow(() => assertSafePath('/tmp/v/clients/aicycle/cases/x.md'));
  assert.throws(() => assertSafePath('/tmp/v/../../etc/passwd'), /Path traversal blocked/);
  assert.throws(() => assertSafePath('/etc/passwd'), /Path traversal blocked/);
  delete process.env.DESIGN_LAB_VAULT_PATH;
});

test('paths: getClientStyleGuidePath rejects invalid slugs', () => {
  process.env.DESIGN_LAB_VAULT_PATH = '/tmp/v';
  for (const slug of ['../../etc', 'a/b', '']) {
    assert.throws(
      () => getClientStyleGuidePath(slug),
      /invalid client slug/,
      `expected ${slug} to be rejected`
    );
  }
  delete process.env.DESIGN_LAB_VAULT_PATH;
});
