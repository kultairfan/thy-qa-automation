// Reads the Playwright JSON report and sends a short summary to an n8n webhook.
// Env:
//   N8N_WEBHOOK_URL  n8n Webhook node URL (if empty, the summary is only printed)
//   ISSUE_KEY        Jira story key that was tested, e.g. THY-1 (optional)
//   RUN_URL          link to the CI run / report (optional)
//   RESULTS_FILE     path to the Playwright JSON report (default: test-results/results.json)
import { readFileSync, existsSync } from 'node:fs';

const file = process.env.RESULTS_FILE || 'test-results/results.json';
const issueKey = process.env.ISSUE_KEY || '';
const runUrl = process.env.RUN_URL || '';
const webhook = process.env.N8N_WEBHOOK_URL || '';

function collect(suite, path, out) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const last = (test.results || []).at(-1) || {};
      const tags = [...(spec.tags || []), ...(test.tags || [])].map((t) => (t.startsWith('@') ? t : `@${t}`));
      out.push({
        feature: here.filter((t) => !t.endsWith('.spec.js')).join(' > '),
        scenario: spec.title,
        tags: [...new Set(tags)],
        status: test.status === 'expected' ? 'passed' : test.status === 'skipped' ? 'skipped' : test.status === 'flaky' ? 'flaky' : 'failed',
        durationMs: last.duration || 0,
        error: last.error ? String(last.error.message || '').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 1500) : null,
      });
    }
  }
  for (const child of suite.suites || []) collect(child, here, out);
}

let summary;
if (!existsSync(file)) {
  summary = { issueKey, runUrl, status: 'error', message: `Report not found: ${file}. The test run probably crashed before producing results.`, tests: [] };
} else {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const tests = [];
  for (const suite of report.suites || []) collect(suite, [], tests);
  const count = (s) => tests.filter((t) => t.status === s).length;
  summary = {
    issueKey,
    runUrl,
    status: count('failed') > 0 ? 'failed' : tests.length === 0 ? 'no-tests' : 'passed',
    total: tests.length,
    passed: count('passed'),
    failed: count('failed'),
    flaky: count('flaky'),
    skipped: count('skipped'),
    startedAt: report.stats?.startTime || null,
    durationMs: Math.round(report.stats?.duration || 0),
    tests,
  };
}

console.log(JSON.stringify(summary, null, 2));

if (webhook) {
  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary) });
  console.log(`n8n webhook responded with HTTP ${res.status}`);
} else {
  console.log('N8N_WEBHOOK_URL is not set, summary was not sent.');
}
