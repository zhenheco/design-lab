import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_VAULT = join(homedir(), 'Documents', 'CC Cli', 'design-library');

export function getVaultPath(): string {
  return process.env.DESIGN_LAB_VAULT_PATH || DEFAULT_VAULT;
}

export function getClientDir(slug: string): string {
  return join(getVaultPath(), 'clients', slug);
}

export function getCasePath(client: string, slug: string): string {
  return join(getClientDir(client), 'cases', `${slug}.md`);
}

export function getAntiCasePath(client: string, slug: string): string {
  return join(getClientDir(client), 'anti-library', `${slug}.md`);
}

export function getClientMetaPath(client: string): string {
  return join(getClientDir(client), 'meta.yaml');
}

export function getStyleGuidePath(): string {
  return join(getVaultPath(), 'personal-style-guide.md');
}

export function getClientStyleGuidePath(slug: string): string {
  return join(getClientDir(slug), 'style-guide.md');
}

export function getScenarioOverridePath(scenario: string): string {
  return join(getVaultPath(), 'scenario-overrides', `${scenario}.md`);
}

export function getIndexDbPath(): string {
  return join(getVaultPath(), '.index', 'library.db');
}

const SLUG_RE = /^[a-z0-9_-]+$/;
const SLUG_MAX_LENGTH = 64;

export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length > SLUG_MAX_LENGTH) return false;
  if (slug.includes('..')) return false;
  return SLUG_RE.test(slug);
}

export function assertSafePath(targetPath: string): void {
  const resolved = resolve(targetPath);
  const vault = resolve(getVaultPath());

  if (!resolved.startsWith(vault)) {
    throw new Error(`Path traversal blocked: ${targetPath}`);
  }
}
