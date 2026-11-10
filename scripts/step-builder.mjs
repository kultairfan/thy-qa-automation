// Step Builder: writes missing step definitions + page objects for a Jira story.
//
// 1. Opens the pages of the site under test with Playwright and records what is on them
//    (accessibility tree + form fields, buttons and links with their ids / names / labels).
// 2. Asks Gemini to write the missing page object + step definition code, following the
//    project conventions and using only locators that exist in the recorded snapshot.
// 3. Validates the result in this runner: bddgen (all steps defined) -> tsc -> runs the
//    scenario against the real site. On failure the error is sent back to Gemini (max 3 tries).
// 4. When green, pushes the files to a new branch and opens a pull request for human review.
// 5. Posts the outcome to n8n, which comments on the Jira story.
//
// Env: ISSUE_KEY, MISSING_STEPS (one per line), STORY, DRAFT_FEATURE, GEMINI_API_KEY,
//      GEMINI_MODEL, BASE_URL, SITE_PAGES, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID,
//      GITHUB_SERVER_URL, N8N_WEBHOOK_URL, DRY_RUN=1 (no PR), LLM_STUB_FILE (local tests),
//      PW_CONFIG (alternative playwright config), PW_CHROMIUM_PATH (local tests)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const env = process.env;
const KEY = (env.ISSUE_KEY || '').trim();
const BASE_URL = (env.BASE_URL || 'https://blazedemo.com').replace(/\/$/, '');
const PAGES = (env.SITE_PAGES || '/,/login,/register,/vacation.html,/password/reset').split(',').map((p) => p.trim()).filter(Boolean);
// First model that answers wins. 404 (retired / not available for this key) moves to the next model
// at once; 429/500/503 (busy) is retried with a pause, then the next model is tried.
const MODELS = [...new Set([env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview'].filter(Boolean))];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let MODEL = MODELS[0];
const MAX_ATTEMPTS = 3;
const RUN_URL = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : '';
const missingSteps = (env.MISSING_STEPS || '').split('\n').map((s) => s.trim()).filter(Boolean);
const log = (...a) => console.log('[step-builder]', ...a);

if (!/^[A-Z][A-Z0-9]+-\d+$/.test(KEY)) throw new Error(`ISSUE_KEY is missing or invalid: "${KEY}"`);

// ---------------------------------------------------------------- 1. snapshot the site
async function snapshotSite() {
  const browser = await chromium.launch(env.PW_CHROMIUM_PATH ? { executablePath: env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const out = [];
  for (const path of PAGES) {
    try {
      await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const aria = await page.locator('body').ariaSnapshot().catch(() => '');
      const elements = await page.evaluate(() => {
        const label = (el) => {
          if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return l.textContent.trim(); }
          const wrap = el.closest('label'); return wrap ? wrap.textContent.trim() : '';
        };
        return [...document.querySelectorAll('input, select, textarea, button, a[href], h1, h2, h3, .alert, .help-block')]
          .filter((el) => !(el.tagName === 'INPUT' && el.type === 'hidden'))
          .slice(0, 80)
          .map((el) => {
            const o = { tag: el.tagName.toLowerCase() };
            for (const a of ['id', 'name', 'type', 'placeholder', 'href', 'role', 'value']) { const v = el.getAttribute(a); if (v) o[a] = v.slice(0, 80); }
            const l = label(el); if (l) o.label = l.slice(0, 60);
            const t = (el.innerText || '').trim().replace(/\s+/g, ' '); if (t) o.text = t.slice(0, 80);
            return o;
          });
      });
      out.push({ url: page.url(), title: await page.title(), aria: aria.slice(0, 4000), elements });
      log(`snapshot ${path}: ${elements.length} elements`);
    } catch (e) {
      out.push({ url: BASE_URL + path, error: String(e).slice(0, 200) });
    }
  }
  await browser.close();
  return out;
}

// ---------------------------------------------------------------- 2. project context
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
function projectContext() {
  const files = {};
  for (const dir of ['pages', 'steps']) for (const f of readdirSync(dir)) if (f.endsWith('.ts')) files[`${dir}/${f}`] = read(join(dir, f));
  return { files, library: read('STEP_LIBRARY.md') };
}

function buildPrompt(snapshots, ctx, previous) {
  const code = Object.entries(ctx.files).map(([p, c]) => `--- ${p} ---\n${c}`).join('\n\n');
  return `You are a senior Playwright + TypeScript test automation engineer working in a playwright-bdd 9 project.
A Gherkin scenario for Jira story ${KEY} needs step definitions that do not exist yet. Write the missing code.

PROJECT CONVENTIONS
- Steps import { Given, When, Then } from './fixtures' and expect from '@playwright/test'.
- Page objects live in pages/*.ts as classes whose constructor takes a Playwright Page.
- A new page object must be registered as a fixture in steps/fixtures.ts. Return the FULL updated fixtures.ts.
- Put new steps in a NEW file steps/<area>.steps.ts and new page objects in a NEW file pages/<Name>Page.ts.
- Do not change or duplicate existing step definitions or existing page objects.
- Step texts are Cucumber expressions: use {string} and {int} for parameters. Keep them short and reusable.
- Locators: use ONLY elements that appear in the PAGE SNAPSHOTS below. Prefer getByRole(role, { name }), then getByLabel,
  then #id or [name="..."]. Never use XPath, nth-child or generated CSS classes.
- Use web-first assertions (await expect(locator).toBeVisible(), toHaveText, toContainText, toHaveURL, toHaveTitle).
- Test data must be obviously fake (e.g. "test.user@example.com", "WrongPassword123").
- Base URL is configured: navigate with relative paths such as page.goto('/login').
- The draft feature is a starting point. Keep its intent, but replace any line (also an existing step) that does not
  fit what the site really shows. 'I should see the heading {string}' only matches real headings (h1-h6 / role heading).
- The Then steps must check the outcome the story asks for (for a negative test: the message the site shows).

OUTPUT: only JSON with this shape:
{"files":[{"path":"pages/LoginPage.ts","content":"..."},{"path":"steps/login.steps.ts","content":"..."},{"path":"steps/fixtures.ts","content":"..."}],
 "feature":"the full feature file for ${KEY} (first line '@${KEY} @smoke'), using existing and new steps",
 "newSteps":["Given ...","When ...","Then ..."],
 "notes":"one or two sentences"}

STORY
${env.STORY || '(not provided)'}

DRAFT FEATURE (written from the step library; some steps do not exist yet)
${env.DRAFT_FEATURE || '(not provided)'}

MISSING STEPS
${missingSteps.map((s) => '- ' + s).join('\n') || '(not provided)'}

EXISTING STEP LIBRARY
${ctx.library}

EXISTING CODE
${code}

PAGE SNAPSHOTS (site: ${BASE_URL})
${JSON.stringify(snapshots, null, 1).slice(0, 30000)}
${previous ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix it and return the full JSON again.\nERROR OUTPUT:\n${previous.slice(-7000)}` : ''}`;
}

// ---------------------------------------------------------------- 3. Gemini
async function askGemini(prompt, attempt) {
  if (env.LLM_STUB_FILE) {
    const stub = JSON.parse(readFileSync(env.LLM_STUB_FILE, 'utf8'));
    return Array.isArray(stub) ? stub[Math.min(attempt - 1, stub.length - 1)] : stub;
  }
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY secret is not set in the repository.');
  let res, j;
  models: for (const model of MODELS.slice(MODELS.indexOf(MODEL))) {
    for (let tryNo = 1; tryNo <= 3; tryNo++) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      });
      j = await res.json().catch(() => ({}));
      MODEL = model;
      if (res.ok) break models;
      if (res.status === 404) { log(`model ${model} is not available (404), trying the next one`); continue models; }
      if (![429, 500, 503].includes(res.status)) break models;
      log(`model ${model} is busy (${res.status}), try ${tryNo}/3`);
      if (tryNo < 3) await sleep(tryNo * 15_000);
    }
  }
  if (!res.ok) throw new Error(`Gemini API error ${res.status} (model ${MODEL}): ${JSON.stringify(j).slice(0, 300)}`);
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return JSON.parse(text.replace(/^```json\s*|```\s*$/g, ''));
}

// ---------------------------------------------------------------- 4. apply + validate
const ALLOWED = [/^pages\/[A-Za-z0-9]+\.ts$/, /^steps\/[A-Za-z0-9.-]+\.ts$/];
function applyAnswer(answer, originals) {
  const written = [];
  for (const f of answer.files || []) {
    const p = String(f.path || '').replace(/^\.?\//, '');
    if (!ALLOWED.some((r) => r.test(p))) { log(`skipped file outside allowed paths: ${p}`); continue; }
    if (existsSync(p) && p !== 'steps/fixtures.ts' && !(p in originals)) { log(`skipped existing file: ${p}`); continue; }
    if (!(p in originals)) originals[p] = existsSync(p) ? readFileSync(p, 'utf8') : null;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
    written.push(p);
  }
  const featurePath = `features/${KEY}.feature`;
  if (answer.feature) {
    if (!(featurePath in originals)) originals[featurePath] = existsSync(featurePath) ? readFileSync(featurePath, 'utf8') : null;
    writeFileSync(featurePath, answer.feature.trim() + '\n');
    written.push(featurePath);
  }
  return [...new Set(written)];
}

function run(cmd) {
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: 'pipe', env: { ...env, FORCE_COLOR: '0' } }) }; }
  catch (e) { return { ok: false, out: `${e.stdout || ''}\n${e.stderr || ''}`.replace(/\u001b\[[0-9;]*m/g, '') }; }
}

// Playwright writes an accessibility snapshot of the page at the moment of failure (error-context.md).
// Sending it back lets the model see what the site really showed (texts, roles, error messages).
function pageAtFailure() {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'error-context.md') found.push(full);
    }
  };
  walk('test-results');
  if (!found.length) return '';
  const text = readFileSync(found[0], 'utf8');
  const start = text.indexOf('```yaml');
  return `\n\nPAGE AT THE MOMENT OF FAILURE (accessibility snapshot):\n${text.slice(start >= 0 ? start : 0).slice(0, 3500)}`;
}

function validate() {
  const cfg = env.PW_CONFIG ? ` -c ${env.PW_CONFIG}` : '';
  for (const [name, cmd] of [['bddgen', `npx bddgen${cfg}`], ['typecheck', 'npx tsc --noEmit'], ['scenario run', `npx playwright test${cfg} --grep @${KEY} --reporter=line --retries=0`]]) {
    const r = run(cmd);
    log(`${name}: ${r.ok ? 'OK' : 'FAILED'}`);
    if (!r.ok) return { ok: false, stage: name, out: name === 'scenario run' ? r.out.slice(-3000) + pageAtFailure() : r.out };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 5. pull request
async function gh(method, path, body) {
  const res = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { status: res.status, data: j };
}

async function openPullRequest(files, answer, attempts) {
  const branch = `step-builder/${KEY}-${env.GITHUB_RUN_ID || Date.now()}`;
  const main = await gh('GET', '/git/ref/heads/main');
  await gh('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: main.data.object.sha });
  for (const p of files) {
    const existing = await gh('GET', `/contents/${p}?ref=${encodeURIComponent(branch)}`);
    await gh('PUT', `/contents/${p}`, {
      message: `${KEY}: Step Builder - ${p}`,
      content: Buffer.from(readFileSync(p, 'utf8')).toString('base64'),
      branch,
      ...(existing.status === 200 ? { sha: existing.data.sha } : {}),
    });
  }
  const body = [
    `Generated by **Step Builder** for Jira story **${KEY}** (${attempts} attempt${attempts > 1 ? 's' : ''}).`,
    '',
    '### New steps',
    ...(answer.newSteps || []).map((s) => `- \`${s}\``),
    '',
    '### Validation in CI',
    '- `bddgen`: every step of the feature has a definition',
    '- `tsc`: type check passed',
    `- the scenario \`@${KEY}\` passed against ${BASE_URL}`,
    '',
    answer.notes ? `**Notes from the model:** ${answer.notes}` : '',
    RUN_URL ? `\nRun log and artifacts: ${RUN_URL}` : '',
    '',
    '> Please review the locators and assertions before merging. After merge, move the story back to **Ready for QA**.',
  ].join('\n');
  const pr = await gh('POST', '/pulls', { title: `${KEY}: new steps by Step Builder`, head: branch, base: 'main', body });
  return pr.data.html_url;
}

// ---------------------------------------------------------------- 6. notify
async function notify(result) {
  const summary = `## Step Builder ${KEY}: ${result.status}\n\n${result.prUrl ? `Pull request: ${result.prUrl}\n\n` : ''}${(result.newSteps || []).map((s) => `- \`${s}\``).join('\n')}\n${result.error ? `\n\`\`\`\n${result.error.slice(0, 2000)}\n\`\`\`\n` : ''}`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  const hook = (env.N8N_WEBHOOK_URL || '').replace(/qa-test-results\/?$/, 'qa-step-builder');
  if (hook && !env.DRY_RUN) {
    const res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issueKey: KEY, runUrl: RUN_URL, ...result }) });
    log(`n8n responded ${res.status}`);
  }
}

// ---------------------------------------------------------------- main
const originals = {};
let answer = null;
let failure = null;
let attempts = 0;
try {
  const snapshots = await snapshotSite();
  const ctx = projectContext();
  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    log(`attempt ${attempts}: asking ${env.LLM_STUB_FILE ? 'stub' : MODEL}`);
    answer = await askGemini(buildPrompt(snapshots, ctx, failure && `[${failure.stage}]\n${failure.out}`), attempts);
    const files = applyAnswer(answer, originals);
    log(`wrote: ${files.join(', ')}`);
    const v = validate();
    if (v.ok) { failure = null; break; }
    failure = v;
  }
  if (failure) {
    attempts = MAX_ATTEMPTS;
    await notify({ status: 'failed', attempts, error: `[${failure.stage}] ${failure.out.slice(-3000)}`, newSteps: answer?.newSteps || [] });
    process.exitCode = 1;
  } else {
    // document the new steps in the library used by the Gherkin writer
    const additions = (answer.newSteps || []).map((s) => `- \`${s}\``).join('\n');
    if (additions) appendFileSync('STEP_LIBRARY.md', `\n## Added by Step Builder (${KEY})\n\n${additions}\n`);
    const changed = [...new Set([...Object.keys(originals), 'STEP_LIBRARY.md'])];
    const prUrl = env.DRY_RUN ? '(dry run - no pull request)' : await openPullRequest(changed, answer, attempts);
    await notify({ status: 'pr-opened', attempts, prUrl, newSteps: answer.newSteps || [], files: changed });
  }
} catch (e) {
  await notify({ status: 'failed', attempts, error: String(e && e.stack || e).slice(0, 3000), newSteps: [] });
  process.exitCode = 1;
}
