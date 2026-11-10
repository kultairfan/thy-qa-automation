// Step Builder: writes missing step definitions + page objects for a Jira story.
//
// 1. Opens the pages of the site under test with Playwright and records what is on them
//    (accessibility tree + form fields, buttons and links with their ids / names / labels).
// 2. Asks an LLM (Gemini, then Groq / NVIDIA as fallbacks) to write the missing page object + step code, following the
//    project conventions and using only locators that exist in the recorded snapshot.
// 3. Validates the result in this runner: bddgen (all steps defined) -> tsc -> runs the
//    scenario against the real site. On failure the error is sent back to the LLM (max 3 tries).
// 4. When green, pushes the files to a new branch and opens a pull request for human review.
// 5. Posts the outcome to n8n, which comments on the Jira story.
//
// Env: ISSUE_KEY, MISSING_STEPS (one per line), STORY, DRAFT_FEATURE, GEMINI_API_KEY,
//      GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, NVIDIA_API_KEY, NVIDIA_MODEL, LLM_ORDER, BASE_URL, SITE_PAGES, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID,
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
// LLM candidates in LLM_ORDER (default gemini, groq, nvidia); a provider is used only when its key is set.
// The first one that answers wins and later attempts start from it. Busy / rate limited (429, 5xx) is
// retried after a pause; any other error moves on to the next candidate.
// groq and nvidia speak the OpenAI chat/completions API. Groq's free tier allows ~8K tokens per minute,
// so it gets the compact prompt.
const OPENAI_COMPATIBLE = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: env.GROQ_API_KEY, compact: true,
    extra: (model) => ({ max_completion_tokens: 3500, response_format: { type: 'json_object' }, ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}) }) },
  nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: env.NVIDIA_API_KEY, compact: false,
    extra: () => ({ max_tokens: 8000 }) },
};
const CANDIDATES = (env.LLM_ORDER || 'gemini,groq,nvidia').split(',').map((x) => x.trim()).flatMap((provider) => {
  if (provider === 'gemini') return env.GEMINI_API_KEY ? [...new Set([env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'].filter(Boolean))].map((model) => ({ provider, model })) : [];
  if (provider === 'groq') return env.GROQ_API_KEY ? [{ provider, model: env.GROQ_MODEL || 'openai/gpt-oss-120b' }] : [];
  if (provider === 'nvidia') return env.NVIDIA_API_KEY ? [{ provider, model: env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash' }] : [];
  return [];
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let current = 0;
const MODEL_NAME = () => (CANDIDATES[current] ? `${CANDIDATES[current].provider}/${CANDIDATES[current].model}` : 'none');
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

// compact = smaller prompt for providers with a low tokens-per-minute limit (Groq free tier: 8K TPM):
// only the pages the story talks about, step signatures instead of full step code, a short page object example.
function buildPrompt(snapshots, ctx, previous, compact = false) {
  let code = Object.entries(ctx.files).map(([p, c]) => `--- ${p} ---\n${c}`).join('\n\n');
  let library = ctx.library;
  let pages = snapshots;
  if (compact) {
    const signatures = Object.entries(ctx.files)
      .filter(([p]) => p.startsWith('steps/') && p !== 'steps/fixtures.ts')
      .flatMap(([, c]) => [...c.matchAll(/^(Given|When|Then)\('([^']+)'/gm)].map((m) => `${m[1]}('${m[2]}')`));
    const example = Object.entries(ctx.files).find(([p]) => p.startsWith('pages/'));
    code = `--- steps/fixtures.ts ---\n${ctx.files['steps/fixtures.ts'] || ''}\n\n--- existing step definitions (signatures) ---\n${signatures.join('\n')}`
      + (example ? `\n\n--- ${example[0]} (style example, first part) ---\n${example[1].slice(0, 1500)}` : '');
    library = '(see existing step definitions above)';
    const text = `${env.STORY || ''} ${env.DRAFT_FEATURE || ''} ${missingSteps.join(' ')}`.toLowerCase();
    const relevant = snapshots.filter((s) => { const w = (s.url || '').replace(/^https?:\/\/[^/]+/, '').split(/[/.]/).filter((x) => x.length > 3 && x !== 'html'); return w.some((x) => text.includes(x)); });
    pages = (relevant.length ? relevant : snapshots.slice(0, 2)).map((s) => ({ ...s, aria: (s.aria || '').slice(0, 1500) }));
  }
  return `You are a senior Playwright + TypeScript test automation engineer working in a playwright-bdd 9 project.
A Gherkin scenario for Jira story ${KEY} needs step definitions that do not exist yet. Write the missing code.

PROJECT CONVENTIONS
- Steps import { Given, When, Then } from './fixtures' and expect from '@playwright/test'.
- Page objects live in pages/*.ts as classes whose constructor takes a Playwright Page.
- A new page object must be registered as a fixture in steps/fixtures.ts. Return the FULL updated fixtures.ts.
- Put new steps in a NEW file steps/<area>.steps.ts and new page objects in a NEW file pages/<Name>Page.ts.
- Do not change or duplicate existing step definitions or existing page objects. Never define a step text that already
  exists (same text in steps/*.ts) - reuse it in the feature. 'I fill the {string} field with {string}' works on any form
  field (found by label, name or id), so use it for login / register forms too.
- Step texts are Cucumber expressions: use {string} and {int} for parameters. Keep them short and reusable.
- Locators: use ONLY elements that appear in the PAGE SNAPSHOTS below. Prefer getByRole(role, { name }), then getByLabel,
  then #id or [name="..."]. Never use XPath, nth-child or generated CSS classes.
- Use web-first assertions (await expect(locator).toBeVisible(), toHaveText, toContainText, toHaveURL, toHaveTitle).
- Test data must be obviously fake (e.g. "test.user@example.com", "WrongPassword123").
- Base URL is configured: navigate with relative paths such as page.goto('/login').
- The draft feature is a starting point. Keep its intent, but replace any line (also an existing step) that does not
  fit what the site really shows. 'I should see the heading {string}' only matches real headings (h1-h6 / role heading).
- The Then steps must check the outcome the story asks for, as the user should see it: a user-friendly message
  (for example "These credentials do not match our records."), never a technical error.
- A technical error page or code (419, 500, "Page Expired", "Server Error", a stack trace) is NEVER an expected result.
  If the site shows such an error instead of the expected behaviour, keep the user-friendly expectation in the Then step
  and set "possibleDefect" to one sentence describing what the site showed instead. Do not change the test to pass.

OUTPUT: only JSON with this shape:
{"files":[{"path":"pages/LoginPage.ts","content":"..."},{"path":"steps/login.steps.ts","content":"..."},{"path":"steps/fixtures.ts","content":"..."}],
 "feature":"the full feature file for ${KEY} (first line '@${KEY} @smoke'), using existing and new steps",
 "newSteps":["Given ...","When ...","Then ..."],
 "notes":"one or two sentences",
 "possibleDefect":"empty, or one sentence: what the site showed instead of the expected behaviour"}

STORY
${env.STORY || '(not provided)'}

DRAFT FEATURE (written from the step library; some steps do not exist yet)
${env.DRAFT_FEATURE || '(not provided)'}

MISSING STEPS
${missingSteps.map((s) => '- ' + s).join('\n') || '(not provided)'}

EXISTING STEP LIBRARY
${library}

EXISTING CODE
${code}

PAGE SNAPSHOTS (site: ${BASE_URL})
${JSON.stringify(pages, compact ? null : undefined, compact ? 0 : 1).slice(0, compact ? 9000 : 30000)}
${previous ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix it and return the full JSON again.\nERROR OUTPUT:\n${previous.slice(0, compact ? 3500 : 7000)}` : ''}`;
}

// ---------------------------------------------------------------- 3. LLM (Gemini, Groq fallback)
function parseJson(text) {
  const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^```(?:json)?\s*|```\s*$/g, '');
  try { return JSON.parse(t); } catch { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); }
}

async function callModel({ provider, model }, prompt) {
  const signal = AbortSignal.timeout({ gemini: 120_000, groq: 90_000 }[provider] || 240_000);
  if (provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
    });
    const j = await res.json().catch(() => ({}));
    return { res, j, text: j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '' };
  }
  // Groq / NVIDIA: OpenAI-compatible chat completions
  const p = OPENAI_COMPATIBLE[provider];
  const res = await fetch(p.url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, ...p.extra(model) }),
  });
  const j = await res.json().catch(() => ({}));
  return { res, j, text: j.choices?.[0]?.message?.content || '' };
}

async function askLLM(snapshots, ctx, previous, attempt) {
  if (env.LLM_STUB_FILE) {
    const stub = JSON.parse(readFileSync(env.LLM_STUB_FILE, 'utf8'));
    return Array.isArray(stub) ? stub[Math.min(attempt - 1, stub.length - 1)] : stub;
  }
  if (!CANDIDATES.length) throw new Error('No LLM key: set GEMINI_API_KEY, GROQ_API_KEY or NVIDIA_API_KEY as a repository secret.');
  let last = '';
  for (; current < CANDIDATES.length; current++) {
    const c = CANDIDATES[current];
    const prompt = buildPrompt(snapshots, ctx, previous, Boolean(OPENAI_COMPATIBLE[c.provider]?.compact));
    const tries = c.provider === 'gemini' ? 2 : 3;
    for (let tryNo = 1; tryNo <= tries; tryNo++) {
      let res, j, text;
      try { ({ res, j, text } = await callModel(c, prompt)); }
      catch (e) { last = `${MODEL_NAME()}: ${String(e).slice(0, 200)}`; log(`${last}, trying the next model`); break; }
      if (res.ok) {
        try { return parseJson(text); } catch { last = `${MODEL_NAME()}: answer was not valid JSON`; log(last); continue; }
      }
      last = `${MODEL_NAME()} -> ${res.status}: ${JSON.stringify(j).slice(0, 300)}`;
      const jsonFail = res.status === 400 && /json_validate_failed/.test(JSON.stringify(j));
      if (![429, 500, 502, 503, 504].includes(res.status) && !jsonFail) { log(`${MODEL_NAME()} failed (${res.status}), trying the next model`); break; }
      log(`${MODEL_NAME()} is busy or rate limited (${res.status}), try ${tryNo}/${tries}`);
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      if (tryNo < tries) await sleep(Math.min(Math.max(retryAfter * 1000, 10_000 * tryNo), 30_000));
    }
  }
  current = CANDIDATES.length - 1; // keep the last candidate for the next attempt
  throw new Error(`No LLM could answer. Last error: ${last}`);
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

// Models sometimes use Playwright names without importing them (e.g. "Cannot find name 'Locator'").
// Add the missing names to the '@playwright/test' import of each written file before the type check.
const PW_NAMES = [['Locator', true], ['Page', true], ['BrowserContext', true], ['expect', false]];
function fixImports(files) {
  for (const f of files) {
    if (!/\.ts$/.test(f) || !existsSync(f)) continue;
    let src = readFileSync(f, 'utf8');
    const code = src.replace(/\/\/.*$/gm, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
    const imports = [...src.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"];?/gm)];
    const imported = new Set(imports.flatMap((m) => m[1].split(',').map((x) => x.replace(/\btype\b/, '').split(/\s+as\s+/).pop().trim()).filter(Boolean)));
    const declared = (n) => new RegExp(`\\b(class|interface|type|const|let|function)\\s+${n}\\b`).test(code);
    const missing = PW_NAMES.filter(([n, isType]) => !imported.has(n) && !declared(n) && new RegExp(isType ? `\\b${n}\\b` : `\\b${n}\\s*\\(`).test(code.replace(/^import.*$/gm, '')));
    if (!missing.length) continue;
    const names = missing.map(([n, isType]) => (isType ? `type ${n}` : n));
    const pw = src.match(/^import\s+\{([^}]*)\}\s+from\s+['"]@playwright\/test['"];?/m);
    if (pw) src = src.replace(pw[0], pw[0].replace(/\{([^}]*)\}/, (_, inner) => `{ ${[...inner.split(',').map((x) => x.trim()).filter(Boolean), ...names].join(', ')} }`));
    else src = `import { ${names.join(', ')} } from '@playwright/test';\n` + src;
    writeFileSync(f, src);
    log(`added missing import(s) in ${f}: ${missing.map(([n]) => n).join(', ')}`);
  }
}

// A model sometimes re-defines a step that already exists (bddgen: "Multiple definitions matched scenario step").
// Remove such duplicates from the files written in this attempt, so the existing definition is used.
function removeDuplicateSteps(files, originals) {
  const re = /^(Given|When|Then)\(\s*(['"`])((?:\\.|(?!\2).)*)\2/gm;
  const existing = new Map();
  for (const f of readdirSync('steps')) {
    const p = `steps/${f}`;
    if (!f.endsWith('.ts') || files.includes(p)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(re)) existing.set(m[3], p);
  }
  for (const p of files) {
    if (!/^steps\/.+\.ts$/.test(p) || originals[p] !== null || !existsSync(p)) continue; // only new step files
    let src = readFileSync(p, 'utf8');
    for (const m of [...src.matchAll(re)].reverse()) {
      if (!existing.has(m[3])) continue;
      // cut the whole call: from the match to its closing ");" (balanced parentheses)
      let depth = 0, end = -1;
      for (let i = m.index; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) { end = i + 1; break; }
      }
      if (end < 0) continue;
      if (src[end] === ';') end++;
      src = src.slice(0, m.index) + src.slice(end).replace(/^\s*\n/, '');
      log(`removed duplicate step "${m[3]}" from ${p} (already defined in ${existing.get(m[3])})`);
    }
    writeFileSync(p, src);
  }
}

// The useful part of a failed Playwright run: which step failed and the error message (not the tail of the log)
function failureSummary(out) {
  const start = out.search(/^\s*1\) \[/m);
  if (start < 0) return out.slice(-2500);
  let block = out.slice(start);
  const end = block.search(/^\s*(attachment #1|Test source)/m);
  if (end > 0) block = block.slice(0, end);
  return block.trim().slice(0, 2500);
}

function validate() {
  const cfg = env.PW_CONFIG ? ` -c ${env.PW_CONFIG}` : '';
  for (const [name, cmd] of [['bddgen', `npx bddgen${cfg}`], ['typecheck', 'npx tsc --noEmit'], ['scenario run', `npx playwright test${cfg} --grep @${KEY} --reporter=line --retries=0`]]) {
    const r = run(cmd);
    log(`${name}: ${r.ok ? 'OK' : 'FAILED'}`);
    if (!r.ok) return { ok: false, stage: name, out: name === 'scenario run' ? failureSummary(r.out) + pageAtFailure() : r.out };
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
    ...(possibleDefect ? ['### Possible defect', `The steps work, but the last check fails because the site does not behave as the story expects: ${possibleDefect}`, 'After merge the test run will fail and a bug will be opened on the story.', ''] : []),
    '### New steps',
    ...(answer.newSteps || []).map((s) => `- \`${s}\``),
    '',
    '### Validation in CI',
    '- `bddgen`: every step of the feature has a definition',
    '- `tsc`: type check passed',
    possibleDefect ? `- the scenario \`@${KEY}\` ran against ${BASE_URL} up to the final check (see Possible defect)` : `- the scenario \`@${KEY}\` passed against ${BASE_URL}`,
    '',
    answer.notes ? `**Notes from the model:** ${answer.notes}` : '',
    RUN_URL ? `\nRun log and artifacts: ${RUN_URL}` : '',
    '',
    '> Please review the locators and assertions before merging. Merging is enough: it starts the test run automatically, a passing story is moved to Done and a failing scenario opens (or updates) a bug.',
  ].join('\n');
  const pr = await gh('POST', '/pulls', { title: `${KEY}: new steps by Step Builder${possibleDefect ? ' (possible defect)' : ''}`, head: branch, base: 'main', body });
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
let possibleDefect = '';
// The model reported a possible defect and the scenario failed only at a check (Then/And/But step),
// not while opening pages or filling forms: the steps work, the site does not behave as expected.
const failedAtCheck = (out) => /›\s+(Then|And|But)\s[^\n]*\n/.test(out) && /Error: expect\(/.test(out);
try {
  const snapshots = await snapshotSite();
  const ctx = projectContext();
  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    log(`attempt ${attempts}: asking ${env.LLM_STUB_FILE ? 'stub' : MODEL_NAME()}`);
    answer = await askLLM(snapshots, ctx, failure && `[${failure.stage}]\n${failure.out}`, attempts);
    const files = applyAnswer(answer, originals);
    fixImports(files);
    removeDuplicateSteps(files, originals);
    log(`wrote (${env.LLM_STUB_FILE ? 'stub' : MODEL_NAME()}): ${files.join(', ')}`);
    const v = validate();
    if (v.ok) { failure = null; break; }
    if (v.stage === 'scenario run' && String(answer?.possibleDefect || '').trim() && failedAtCheck(v.out)) {
      possibleDefect = String(answer.possibleDefect).trim().slice(0, 300);
      log(`possible defect: ${possibleDefect}`);
      failure = null;
      break;
    }
    failure = v;
  }
  if (failure) {
    attempts = MAX_ATTEMPTS;
    await notify({ status: 'failed', attempts, error: `[${failure.stage}] ${failure.out.slice(0, 3000)}`, newSteps: answer?.newSteps || [] });
    process.exitCode = 1;
  } else {
    // document the new steps in the library used by the Gherkin writer
    const additions = (answer.newSteps || []).map((s) => `- \`${s}\``).join('\n');
    if (additions) appendFileSync('STEP_LIBRARY.md', `\n## Added by Step Builder (${KEY})\n\n${additions}\n`);
    const changed = [...new Set([...Object.keys(originals), 'STEP_LIBRARY.md'])];
    const prUrl = env.DRY_RUN ? '(dry run - no pull request)' : await openPullRequest(changed, answer, attempts);
    await notify({ status: 'pr-opened', attempts, prUrl, newSteps: answer.newSteps || [], files: changed, possibleDefect });
  }
} catch (e) {
  await notify({ status: 'failed', attempts, error: String(e && e.stack || e).slice(0, 3000), newSteps: [] });
  process.exitCode = 1;
}
