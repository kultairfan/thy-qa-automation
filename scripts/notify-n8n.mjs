// Test result reporting for CI and local runs.
//
//   node scripts/notify-n8n.mjs prepare  -> builds test-results/summary.json and copies the
//                                          last-step screenshot of every scenario into
//                                          playwright-report/last-step/ (published with the report)
//   node scripts/notify-n8n.mjs send     -> prints the summary, writes the GitHub job summary
//                                          and posts it to the n8n webhook
//   node scripts/notify-n8n.mjs          -> both (local use: npm run notify)
//
// Env:
//   N8N_WEBHOOK_URL  n8n Webhook node URL (if empty, nothing is sent)
//   ISSUE_KEY        Jira story key that was tested, e.g. THY-23 (optional)
//   RUN_URL          link to the CI run (optional)
//   REPORT_URL       public URL of the published Playwright report (optional, GitHub Pages)
//   RESULTS_FILE     Playwright JSON report (default: test-results/results.json)
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] || 'all';
const file = process.env.RESULTS_FILE || 'test-results/results.json';
const summaryFile = 'test-results/summary.json';
const reportDir = 'playwright-report';
const reportUrl = (process.env.REPORT_URL || '').replace(/\/?$/, process.env.REPORT_URL ? '/' : '');
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
      const tags = [...new Set([...(spec.tags || []), ...(test.tags || [])].map((t) => (t.startsWith('@') ? t : `@${t}`)))];
      const shots = (last.attachments || []).filter((a) => a.name === 'screenshot' && a.path);
      out.push({
        feature: here.filter((t) => !t.endsWith('.spec.js')).join(' > '),
        scenario: spec.title,
        tags,
        status: test.status === 'expected' ? 'passed' : test.status === 'skipped' ? 'skipped' : test.status === 'flaky' ? 'flaky' : 'failed',
        durationMs: last.duration || 0,
        steps: flattenSteps(last.steps),
        error: last.error ? clean(last.error.message).slice(0, 1500) : null,
        _screenshotPath: shots.length ? shots[shots.length - 1].path : null,
      });
    }
  }
  for (const child of suite.suites || []) collect(child, here, out);
}

function prepare() {
  const issueKey = process.env.ISSUE_KEY || '';
  const runUrl = process.env.RUN_URL || '';
  let summary;
  if (!existsSync(file)) {
    summary = { issueKey, runUrl, reportUrl, status: 'error', message: `Report not found: ${file}. The test run probably crashed before producing results.`, tests: [] };
  } else {
    const report = JSON.parse(readFileSync(file, 'utf8'));
    const tests = [];
    for (const suite of report.suites || []) collect(suite, [], tests);
    // Copy the last-step screenshot of every scenario to a stable path inside the report
    tests.forEach((t, i) => {
      const key = (t.tags.find((x) => /^@[A-Z][A-Z0-9]+-\d+$/.test(x)) || '@test').slice(1);
      if (t._screenshotPath && existsSync(t._screenshotPath) && existsSync(reportDir)) {
        mkdirSync(join(reportDir, 'last-step'), { recursive: true });
        const name = `${key}-${i + 1}.png`;
        copyFileSync(t._screenshotPath, join(reportDir, 'last-step', name));
        t.screenshotUrl = reportUrl ? `${reportUrl}last-step/${name}` : join(reportDir, 'last-step', name);
      }
      delete t._screenshotPath;
    });
    const count = (s) => tests.filter((t) => t.status === s).length;
    summary = {
      issueKey,
      runUrl,
      reportUrl,
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
  mkdirSync('test-results', { recursive: true });
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  return summary;
}

async function send(summary) {
  // ---- Console ----------------------------------------------------------
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
    if (t.screenshotUrl) console.log(`      last step screenshot: ${t.screenshotUrl}`);
  }
  if (summary.message) console.log(` ${summary.message}`);
  if (summary.reportUrl) console.log(` Report (video, screenshots): ${summary.reportUrl}`);
  console.log(`${line}\n`);

  // ---- GitHub Actions job summary ----------------------------------------
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = summary.tests.map((t) => `| ${icon(t.status)} | ${t.tags.join(' ')} | ${t.scenario} | ${(t.durationMs / 1000).toFixed(1)}s | ${t.screenshotUrl ? `[last step](${t.screenshotUrl})` : ''} |`);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `## Test results: ${summary.status.toUpperCase()} (${summary.passed ?? 0}/${summary.total ?? 0} passed)`,
        summary.reportUrl ? `\n[Open the Playwright report (video, screenshots)](${summary.reportUrl})\n` : '',
        '| | Tags | Scenario | Duration | Screenshot |',
        '|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n'),
    );
  }

  // ---- n8n -----------------------------------------------------------------
  const webhook = process.env.N8N_WEBHOOK_URL || '';
  if (webhook) {
    const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary) });
    console.log(`n8n webhook responded with HTTP ${res.status}`);
  } else {
    console.log('N8N_WEBHOOK_URL is not set, summary was not sent to n8n.');
  }
}

if (mode === 'prepare') {
  prepare();
} else if (mode === 'send') {
  const summary = existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')) : prepare();
  await send(summary);
} else {
  await send(prepare());
}
