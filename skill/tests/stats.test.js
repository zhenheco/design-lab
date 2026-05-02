import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeStats } from '../lib/stats.js';

test('computeStats: count by scenario', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dl-st-'));
    mkdirSync(join(vault, 'cases'));
    mkdirSync(join(vault, 'anti-library'));

    writeFileSync(join(vault, 'cases', 'a.md'),
        '---\nslug: a\nscenario: landing\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'cases', 'b.md'),
        '---\nslug: b\nscenario: landing\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'cases', 'c.md'),
        '---\nslug: c\nscenario: saas-ui\nsentiment: positive\n---\n');
    writeFileSync(join(vault, 'anti-library', 'd.md'),
        '---\nslug: d\nscenario: brand\nsentiment: negative\n---\n');

    const stats = computeStats(vault);
    assert.equal(stats.totals.positive, 3);
    assert.equal(stats.totals.negative, 1);
    assert.equal(stats.byScenario.landing, 2);
    assert.equal(stats.byScenario['saas-ui'], 1);
    assert.equal(stats.byScenario.brand, 1);
});
