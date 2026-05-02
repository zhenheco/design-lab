import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/migrate-v1-to-v2.sh', import.meta.url));

function writeMarkdownFile(path: string, frontmatter: string, body = 'body\n') {
    writeFileSync(path, `---\n${frontmatter}---\n${body}`);
}

function createStandardV1Vault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-migrate-'));
    mkdirSync(join(vault, 'cases'));
    mkdirSync(join(vault, 'anti-library'));
    writeMarkdownFile(
        join(vault, 'cases', '0001.md'),
        'schema_version: 1\nslug: 0001\nscenario: landing\nsentiment: positive\nquotes_from_user: ["乾淨"]\n'
    );
    writeMarkdownFile(
        join(vault, 'anti-library', '0002.md'),
        'schema_version: 1\nslug: 0002\nscenario: brand\nsentiment: negative\nquotes_from_user: ["太花"]\n'
    );
    writeMarkdownFile(join(vault, 'personal-style-guide.md'), 'schema_version: 2\n');
    return vault;
}

function runMigration(vault: string) {
    return spawnSync('bash', [SCRIPT, vault], {
        encoding: 'utf8'
    });
}

function listMarkdownFiles(dir: string) {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir).filter((entry) => entry.endsWith('.md'));
}

function findBackupDirs(vault: string) {
    const parent = dirname(vault);
    const prefix = `${basename(vault)}.v1-backup-`;
    return readdirSync(parent)
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => join(parent, entry));
}

test('migration: standard v1 vault migrates correctly', () => {
    const vault = createStandardV1Vault();
    const result = runMigration(vault);

    assert.equal(result.status, 0);
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases', '0001.md')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library', '0002.md')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));

    const caseContent = readFileSync(join(vault, 'clients', '_personal', 'cases', '0001.md'), 'utf8');
    const antiContent = readFileSync(join(vault, 'clients', '_personal', 'anti-library', '0002.md'), 'utf8');
    const metaContent = readFileSync(join(vault, 'clients', '_personal', 'meta.yaml'), 'utf8');

    assert.match(caseContent, /^schema_version: 2/m);
    assert.match(caseContent, /^client: _personal/m);
    assert.match(antiContent, /^schema_version: 2/m);
    assert.match(antiContent, /^client: _personal/m);
    assert.match(metaContent, /^slug: _personal$/m);
    assert.match(metaContent, /^type: self$/m);
    assert.match(metaContent, /^schema_version: 2$/m);
    assert.match(metaContent, /^theme_color:/m);

    assert.deepEqual(listMarkdownFiles(join(vault, 'cases')), []);
    assert.deepEqual(listMarkdownFiles(join(vault, 'anti-library')), []);
});

test('migration: empty cases and anti-library still creates _personal structure', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-migrate-'));
    writeMarkdownFile(join(vault, 'personal-style-guide.md'), 'schema_version: 2\n');

    const result = runMigration(vault);

    assert.equal(result.status, 0);
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'cases')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'anti-library')));
    assert.ok(existsSync(join(vault, 'clients', '_personal', 'meta.yaml')));
});

test('migration: second run is idempotent', () => {
    const vault = createStandardV1Vault();
    const firstRun = runMigration(vault);
    assert.equal(firstRun.status, 0);

    const migratedCase = join(vault, 'clients', '_personal', 'cases', '0001.md');
    appendFileSync(migratedCase, '\nIDEMPOTENT-MARKER\n');

    const secondRun = runMigration(vault);
    const content = readFileSync(migratedCase, 'utf8');

    assert.equal(secondRun.status, 0);
    assert.match(content, /IDEMPOTENT-MARKER/);
    assert.equal((content.match(/^schema_version: 2$/gm) ?? []).length, 1);
    assert.equal((content.match(/^client: _personal$/gm) ?? []).length, 1);
    assert.equal(findBackupDirs(vault).length, 1);
});

test('migration: backup directory created as sibling', () => {
    const vault = createStandardV1Vault();
    const result = runMigration(vault);
    const backups = findBackupDirs(vault);

    assert.equal(result.status, 0);
    assert.ok(backups.length >= 1);
    assert.ok(existsSync(join(backups[0], 'cases', '0001.md')));
    assert.ok(existsSync(join(backups[0], 'anti-library', '0002.md')));

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    assert.match(combinedOutput, /[Bb]ackup.*v1-backup-/);
});
