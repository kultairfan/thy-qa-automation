// Reads the Playwright JSON report, prints a readable summary to the console,
// writes it to the GitHub Actions job summary and sends it to an n8n webhook.
// Env:
//   N8N_WEBHOOK_URL  n8n Webhook node URL (if empty, nothing is sent)
//   ISSUE_KEY        Jira story key that was tested, e.g. THY-23 (optional)
//   RUN_URL          link to the CI run / report (optional)
//   RESULTS_FILE     path to the Playwright JSON report (default: test-results/results.json)
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const file = process.env.RESULTS_FILE || 'test-results/results.json';
const issueKey = process.env.ISSUE_KEY || '';
const runUrl = process.env.RUN_URL || '';
const webhook = process.env.N8N_WEBHOOK_URL || '';
const clean = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

function flattenSteps(steps = [], out = []) {
  for (const s of steps) {
    // playwright-bdd reports every Gherkin step as a test step (Given/When/Then/And ...)
    if (/^(Given|When|Then|And|But)\b/.test(s.title)) out.push({ title: s.title, failed: Boolean(s.error) });
    else flattenSteps(s.steps, out);
  }
  return out;
}

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
        steps: flattenSteps(last.steps),
        error: last.error ? clean(last.error.message).slice(0, 1500) : null,
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

// ---- Console output -------------------------------------------------------
const icon = (s) => (s === 'passed' ? '✅' : s === 'flaky' ? '⚠️ ' : s === 'skipped' ? '⏭️ ' : '❌');
const line = '─'.repeat(70);
console.log(`\n${line}\n TEST RESULTS  ${summary.status.toUpperCase()}  (${summary.passed ?? 0}/${summary.total ?? 0} passed)\n${line}`);
for (const t of summary.tests) {
  const key = t.tags.find((x) => /^@[A-Z][A-Z0-9]+-\d+$/.test(x)) || '';
  console.log(` ${icon(t.status)} ${key.padEnd(8)} ${t.scenario}  (${(t.durationMs / 1000).toFixed(1)}s)`);
  if (t.status === 'failed') {
    const failedStep = t.steps.find((s) => s.failed);
    if (failedStep) console.log(`      failed at: ${failedStep.title}`);
    if (t.error) console.log(`      ${t.error.split('\n')[0]}`);
  }
}
if (summary.message) console.log(` ${summary.message}`);
console.log(`${line}\n`);

// ---- GitHub Actions job summary (shown on the run page) -------------------
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = summary.tests.map((t) => `| ${icon(t.status)} | ${t.tags.join(' ')} | ${t.scenario} | ${(t.durationMs / 1000).toFixed(1)}s |`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [`## Test results: ${summary.status.toUpperCase()} (${summary.passed ?? 0}/${summary.total ?? 0} passed)`, '', '| | Tags | Scenario | Duration |', '|---|---|---|---|', ...rows, ''].join('\n'),
  );
}

// ---- n8n -------------------------------------------------------------------
if (webhook) {
  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary) });
  console.log(`n8n webhook responded with HTTP ${res.status}`);
} else {
  console.log('N8N_WEBHOOK_URL is not set, summary was not sent to n8n.');
}
