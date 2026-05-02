import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintCss, parseRulesFromGuide } from '../lib/lint.js';

const SAMPLE_RULES = [
    {
        id: 'no-gradient',
        rule: '不要漸層',
        detector: { type: 'regex', pattern: 'linear-gradient|radial-gradient|conic-gradient', target: 'css' },
        autoFix: { replace: /linear-gradient\([^)]+\)/g, with: '#1F2937' }
    },
    {
        id: 'no-pure-black',
        rule: '不要純黑',
        detector: { type: 'regex', pattern: '#000(?![0-9a-fA-F])|#000000|rgb\\(0,\\s*0,\\s*0\\)', target: 'css' }
    }
];

test('lintCss: detects gradient violation', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #000); }';
    const result = lintCss(css, SAMPLE_RULES);
    assert.equal(result.violations.length, 2); // gradient + pure black
    assert.ok(result.violations.some(v => v.ruleId === 'no-gradient'));
    assert.ok(result.violations.some(v => v.ruleId === 'no-pure-black'));
});

test('lintCss: clean css has no violations', () => {
    const css = '.hero { background: #1F2937; color: #FFFFFF; }';
    const result = lintCss(css, SAMPLE_RULES);
    assert.equal(result.violations.length, 0);
});

test('lintCss: auto-fix replaces gradient with solid color', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #aaa); }';
    const result = lintCss(css, SAMPLE_RULES, { autoFix: true });
    assert.match(result.fixedCss, /background:\s*#1F2937/);
    assert.equal(result.fixes.length, 1);
});

test('lintCss: skips rules in lint_skip list', () => {
    const css = '.hero { background: linear-gradient(45deg, #fff, #aaa); }';
    const result = lintCss(css, SAMPLE_RULES, { lintSkip: ['no-gradient'] });
    assert.equal(result.violations.filter(v => v.ruleId === 'no-gradient').length, 0);
});

test('parseRulesFromGuide: extracts NEVER rules from style-guide markdown', () => {
    const md = `---
version: 1
---
## NEVER
- id: no-gradient
  rule: "不要漸層"
  detector:
    type: regex
    pattern: 'linear-gradient'
    target: css
- id: no-pure-black
  rule: "不要純黑"
  detector:
    type: regex
    pattern: '#000000'
    target: css
`;
    const rules = parseRulesFromGuide(md);
    assert.equal(rules.length, 2);
    assert.equal(rules[0].id, 'no-gradient');
    assert.equal(rules[1].id, 'no-pure-black');
});
