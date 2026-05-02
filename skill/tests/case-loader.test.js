import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCaseSummaries } from '../lib/case-loader.js';

function setupVault() {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cl-'));
    mkdirSync(join(vault, 'cases'));
    writeFileSync(join(vault, 'cases', '0001-stripe.md'),
        '---\nschema_version: 1\nslug: 0001-stripe\nscenario: landing\nsentiment: positive\nquotes_from_user: ["乾淨"]\n---\nbody');
    writeFileSync(join(vault, 'cases', '0002-linear.md'),
        '---\nschema_version: 1\nslug: 0002-linear\nscenario: saas-ui\nsentiment: positive\nquotes_from_user: ["精緻"]\n---\nbody');
    return vault;
}

test('loadCaseSummaries: returns all positive cases', () => {
    const vault = setupVault();
    const summaries = loadCaseSummaries(vault);
    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].slug, '0001-stripe');
    assert.equal(summaries[1].slug, '0002-linear');
});

test('loadCaseSummaries: filter by scenario', () => {
    const vault = setupVault();
    const summaries = loadCaseSummaries(vault, { scenario: 'landing' });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].slug, '0001-stripe');
});

test('loadCaseSummaries: returns empty array if cases dir missing', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-cl-'));
    const summaries = loadCaseSummaries(vault);
    assert.equal(summaries.length, 0);
});
