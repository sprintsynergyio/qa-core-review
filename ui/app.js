// The review page (SPEC.md Section 13.3). Plain JavaScript, no library. The first half is the
// logic, with no page in it, so it can be tested under node. The second half draws the page and
// runs only in a browser. Everything that comes from the reviewed code is put on the page as
// text, never as HTML.
import { highlightLines } from './highlight.js';

export const CHIPS = ['All', 'Fail', 'Review', 'Pass', 'Undecided'];
export const LANGUAGE_NAMES = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', csharp: 'C#', go: 'Go', ruby: 'Ruby', kotlin: 'Kotlin', php: 'PHP',
  robot: 'Robot Framework', gherkin: 'Gherkin', jmeter: 'JMeter', postman: 'Postman', generic: 'Other',
};
const DOCS_PREFIX = 'https://github.com/sprintsynergyio/qa-core-review/';
const DECISION_MARKS = { pending: ['○', 'not decided'], approved: ['✓', 'approved'], rejected: ['✗', 'rejected'] };

export const languageName = (id) => LANGUAGE_NAMES[id] ?? id;
/** The verdict of an item with no verdict of its own (a whole file): fail on an error, review on a warning. */
export const verdictOf = (findings) => (findings.some((entry) => entry.severity === 'error') ? 'fail' : findings.some((entry) => entry.severity === 'warn') ? 'review' : 'pass');

/** The things to decide on, in the order of the report: each test, then the item for its file when the session has one. */
export function buildItems(report, session) {
  const open = report.findings.filter((entry) => !entry.suppressed);
  const items = [];
  const files = [...new Set([...report.files.map((file) => file.file), ...open.map((entry) => entry.location.file)])];
  for (const name of files) {
    const file = report.files.find((entry) => entry.file === name);
    const language = file?.language === 'generic' && file.languageHint ? file.languageHint : (file?.language ?? 'generic');
    const framework = file?.runner ?? '';
    for (const test of file?.tests ?? []) {
      if (!Object.hasOwn(session.tests, test.id)) continue;
      items.push({ id: test.id, kind: 'test', file: name, language, framework, title: test.fullTitle, line: test.location.startLine, endLine: test.location.endLine, verdict: test.verdict, findings: open.filter((entry) => entry.testId === test.id) });
    }
    const id = `file:${name}`;
    if (!Object.hasOwn(session.tests, id)) continue;
    const findings = open.filter((entry) => entry.testId === null && entry.location.file === name);
    items.push({ id, kind: 'file', file: name, language, framework, title: 'Whole file', line: 1, endLine: null, verdict: verdictOf(findings), findings });
  }
  return items;
}

export const decisionOf = (session, id) => session.tests[id]?.decision ?? 'pending';

/** The numbers of the header. */
export function countsOf(items, session) {
  const counts = { fail: 0, review: 0, pass: 0, total: items.length, decided: 0 };
  for (const item of items) {
    counts[item.verdict] += 1;
    if (decisionOf(session, item.id) !== 'pending') counts.decided += 1;
  }
  return counts;
}

/** The items a filter chip and a language leave in the list. */
export function visibleItems(items, session, { chip = 'All', language = 'all' } = {}) {
  return items.filter((item) => (language === 'all' || item.language === language)
    && (chip === 'All' || (chip === 'Undecided' ? decisionOf(session, item.id) === 'pending' : item.verdict === chip.toLowerCase())));
}

/** Items by language, then by file, in the order they come. */
export function groupItems(items) {
  const groups = [];
  for (const item of items) {
    let group = groups.find((entry) => entry.language === item.language);
    if (!group) groups.push((group = { language: item.language, files: [] }));
    let file = group.files.find((entry) => entry.file === item.file);
    if (!file) group.files.push((file = { file: item.file, items: [] }));
    file.items.push(item);
  }
  return groups;
}

/** The id `step` places after the current one in the list, staying at the ends. With nothing current: the first. */
export function neighbourId(list, currentId, step) {
  if (list.length === 0) return null;
  const index = list.findIndex((item) => item.id === currentId);
  return index === -1 ? list[0].id : list[Math.min(list.length - 1, Math.max(0, index + step))].id;
}

/** The next item after the current one that is not decided yet, going round once. Null when all are decided. */
export function nextUndecidedId(list, session, currentId) {
  const index = Math.max(0, list.findIndex((item) => item.id === currentId));
  const order = [...list.slice(index + 1), ...list.slice(0, index + 1)];
  return order.find((item) => item.id !== currentId && decisionOf(session, item.id) === 'pending')?.id ?? null;
}

/**
 * The line ranges of the source to show for an item, as `[first, last]` pairs: the lines of a
 * test, a whole short file, or for a long file a few lines around each finding.
 */
export function rangesFor(item, lineCount, { wholeFileUpTo = 200, around = 5 } = {}) {
  if (lineCount === 0) return [];
  const clamp = (line) => Math.min(lineCount, Math.max(1, line));
  if (item.kind === 'test') return [[clamp(item.line), clamp(item.endLine ?? item.line)]];
  if (lineCount <= wholeFileUpTo) return [[1, lineCount]];
  const lines = item.findings.map((entry) => entry.location.startLine).sort((a, b) => a - b);
  const ranges = [];
  for (const line of lines.length > 0 ? lines : [1]) {
    const next = [clamp(line - around), clamp(line + around)];
    const last = ranges[ranges.length - 1];
    if (last && next[0] <= last[1] + 1) last[1] = Math.max(last[1], next[1]);
    else ranges.push(next);
  }
  return ranges;
}

/** The findings of an item by the shown line they sit under. A finding outside the shown lines goes under `null`. */
export function findingsByLine(item, ranges) {
  const byLine = new Map();
  for (const finding of item.findings) {
    const line = finding.location.startLine;
    const key = ranges.some(([first, last]) => line >= first && line <= last) ? line : null;
    byLine.set(key, [...(byLine.get(key) ?? []), finding]);
  }
  return byLine;
}

/** A client for the API of the server. `send` is `fetch` in the browser. */
export function createApi(token, send) {
  return async (method, path, body) => {
    const response = await send(path, { method, headers: { 'X-QCR-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    if (!response.ok) {
      let reason = text;
      try {
        reason = JSON.parse(text).error ?? text;
      } catch {
        // Not JSON: the text itself is the reason.
      }
      throw new Error(`${method} ${path}: ${response.status} ${reason}`);
    }
    return (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text;
  };
}

// ---- The page. Nothing below runs under node. ----

/** Makes an element. `props` are set as properties, except `class`, `text` and names with a dash, which are attributes. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'text') node.textContent = value;
    else if (name === 'class') node.className = value;
    else if (name.includes('-')) node.setAttribute(name, value === true ? '' : value);
    else node[name] = value;
  }
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

function startPage() {
  const byId = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.search).get('t') ?? '';
  const api = createApi(token, (path, init) => fetch(path, init));
  const state = { report: null, session: null, items: [], currentId: null, chip: 'All', language: 'all', finished: false, lines: new Map() };
  const timers = new Map();

  const notice = (text) => {
    byId('banner').textContent = text;
    byId('banner').hidden = false;
  };
  const fail = (error) => notice(`Could not reach the review server, so the last change may not be saved. Is "qa-core-review ui" still running? (${error.message})`);
  /** Sends a change and takes the session the server answers with. */
  const change = async (path, body) => {
    if (state.finished) return;
    try {
      state.session = await api('PUT', path, body);
      byId('banner').hidden = true;
      drawChrome();
    } catch (error) {
      fail(error);
    }
  };
  const changeTest = (id, body) => change(`/api/session/tests/${encodeURIComponent(id)}`, body);
  /** Saves a comment box a little after the last key, and at once when the box is left. */
  const commentBox = (label, value, save, id) => {
    const box = el('textarea', { rows: 2, value, id, disabled: state.finished, 'aria-label': label, placeholder: label });
    const now = () => {
      clearTimeout(timers.get(box));
      timers.delete(box);
      return save(box.value);
    };
    box.addEventListener('input', () => {
      clearTimeout(timers.get(box));
      timers.set(box, setTimeout(now, 600));
    });
    box.addEventListener('change', now);
    return box;
  };
  const visible = () => visibleItems(state.items, state.session, state);
  const current = () => state.items.find((item) => item.id === state.currentId) ?? null;
  const select = (id, focus = false) => {
    if (id === null) return;
    state.currentId = id;
    drawChrome();
    drawMain();
    if (focus) byId('main').focus();
  };
  const decide = async (decision) => {
    const item = current();
    if (!item || state.finished) return;
    const comment = byId('test-comment')?.value;
    await changeTest(item.id, { decision, ...(comment === undefined ? {} : { comment }) });
    const next = decision === 'pending' ? null : nextUndecidedId(visible().length > 0 ? visible() : state.items, state.session, item.id);
    if (next !== null) select(next, true);
    else drawMain();
    if (decision === 'pending' && !comment) byId('test-comment')?.focus();
  };

  function drawChrome() {
    const counts = countsOf(state.items, state.session);
    byId('counts').replaceChildren(
      el('span', { class: 'badge fail', text: `Fail ${counts.fail}` }), ' ', el('span', { class: 'badge review', text: `Review ${counts.review}` }), ' ', el('span', { class: 'badge pass', text: `Pass ${counts.pass}` }),
    );
    byId('progress').textContent = `${counts.decided} of ${counts.total} tests decided`;
    byId('approve-passing').disabled = state.finished;
    byId('finish').disabled = state.finished;
    byId('chips').replaceChildren(...CHIPS.map((chip) => el('button', { type: 'button', class: 'chip', text: chip, 'aria-pressed': String(state.chip === chip), onclick: () => {
      state.chip = chip;
      drawChrome();
    } })));
    const languages = [...new Set(state.items.map((item) => item.language))];
    byId('language-filter').hidden = languages.length < 2;
    byId('language').replaceChildren(el('option', { value: 'all', text: 'All languages' }), ...languages.map((id) => el('option', { value: id, text: languageName(id), selected: state.language === id })));
    const shown = visible();
    byId('list').replaceChildren(...groupItems(shown).map((group) => el('section', {},
      el('h2', { text: languageName(group.language) }),
      group.files.map((file) => [
        el('h3', { text: file.file, title: file.file }),
        el('ul', {}, file.items.map((item) => {
          const [mark, word] = DECISION_MARKS[decisionOf(state.session, item.id)];
          return el('li', {}, el('button', { type: 'button', class: 'item', 'aria-current': item.id === state.currentId ? 'true' : undefined, onclick: () => select(item.id, true) },
            el('span', { class: `badge ${item.verdict}`, text: item.verdict }), el('span', { class: 'item-title', text: item.title, title: item.title }),
            el('span', { class: `decision ${word.replace(' ', '-')}`, text: mark, title: word, 'aria-label': word })));
        })),
      ]),
    )));
    if (shown.length === 0) byId('list').append(el('p', { class: 'muted', text: state.items.length === 0 ? 'The report has no test.' : 'No test matches this filter.' }));
  }

  function findingBox(item, finding) {
    const saved = state.session.tests[item.id]?.findings[finding.id] ?? { dismissed: false, comment: '' };
    const path = `/api/session/findings/${encodeURIComponent(finding.id)}`;
    const rule = finding.docsUrl?.startsWith(DOCS_PREFIX) ? el('a', { href: finding.docsUrl, target: '_blank', rel: 'noopener noreferrer', text: finding.ruleId }) : el('span', { text: finding.ruleId });
    return el('div', { class: `finding ${finding.severity}${saved.dismissed ? ' dismissed' : ''}` },
      el('p', { class: 'finding-head' }, el('span', { class: `badge ${finding.severity}`, text: finding.severity }), ' ', rule, ' ', el('span', { class: 'muted', text: `line ${finding.location.startLine}` }), saved.dismissed ? el('span', { class: 'muted', text: ' (dismissed)' }) : null),
      el('p', { text: finding.message }),
      finding.evidence ? el('p', {}, el('span', { class: 'label', text: 'Evidence: ' }), el('code', { text: finding.evidence })) : null,
      finding.fix ? el('p', {}, el('span', { class: 'label', text: 'Fix: ' }), finding.fix) : null,
      finding.goodExample ? el('details', {}, el('summary', { text: 'Good example' }), el('pre', { text: finding.goodExample })) : null,
      el('div', { class: 'finding-actions' },
        el('button', { type: 'button', disabled: state.finished, 'aria-pressed': String(saved.dismissed), text: saved.dismissed ? 'Dismissed: not a problem here' : 'Dismiss: not a problem here', onclick: async () => {
          await change(path, { testId: item.id, dismissed: !saved.dismissed });
          drawMain();
        } }),
        commentBox(`Comment on ${finding.ruleId}`, saved.comment, (comment) => change(path, { testId: item.id, comment }))));
  }

  function drawMain() {
    const item = current();
    const main = byId('main');
    if (!item) return void main.replaceChildren(el('p', { class: 'muted', text: 'Nothing to review.' }));
    const source = state.report.sources[item.file];
    if (source !== undefined && !state.lines.has(item.file)) state.lines.set(item.file, highlightLines(source, item.language));
    const lines = state.lines.get(item.file) ?? [];
    const ranges = rangesFor(item, lines.length);
    const byLine = findingsByLine(item, ranges);
    const rows = [];
    ranges.forEach(([first, last], index) => {
      if (index > 0) rows.push(el('div', { class: 'gap', text: '...' }));
      for (let line = first; line <= last; line += 1) {
        rows.push(el('div', { class: `row${byLine.has(line) ? ' flagged' : ''}` }, el('span', { class: 'line-number', text: String(line) }),
          el('code', { class: 'line' }, lines[line - 1].map((part) => (part.type === 'plain' ? part.text : el('span', { class: `tok-${part.type}`, text: part.text }))))));
        for (const finding of byLine.get(line) ?? []) rows.push(findingBox(item, finding));
      }
    });
    const entry = state.session.tests[item.id];
    const [, word] = DECISION_MARKS[entry.decision];
    main.replaceChildren(
      el('h2', { class: 'title', text: item.title }),
      el('p', { class: 'muted' }, el('code', { text: `${item.file}:${item.line}` }), ` · ${languageName(item.language)}${item.framework ? `, ${item.framework}` : ''} · `, el('span', { class: `badge ${item.verdict}`, text: item.verdict }), ` · ${word}`),
      source === undefined ? el('p', { class: 'muted', text: 'The source of this file is not available.' }) : el('div', { class: 'code' }, rows),
      (byLine.get(null) ?? []).map((finding) => findingBox(item, finding)),
      el('label', { for: 'test-comment', text: item.kind === 'file' ? 'Comment on this file' : 'Comment on this test' }),
      commentBox('Comment for the coding agent', entry.comment, (comment) => changeTest(item.id, { comment }), 'test-comment'),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'approve', disabled: state.finished, 'aria-pressed': String(entry.decision === 'approved'), text: 'Approve (A)', onclick: () => decide('approved') }),
        el('button', { type: 'button', class: 'reject', disabled: state.finished, 'aria-pressed': String(entry.decision === 'rejected'), text: 'Reject (R)', onclick: () => decide('rejected') }),
        el('button', { type: 'button', disabled: state.finished, text: 'Comment only (C)', onclick: () => decide('pending') })),
    );
  }

  byId('language').addEventListener('change', (event) => {
    state.language = event.target.value;
    drawChrome();
  });
  byId('approve-passing').addEventListener('click', async () => {
    for (const item of state.items.filter((entry) => entry.verdict === 'pass' && decisionOf(state.session, entry.id) === 'pending')) await changeTest(item.id, { decision: 'approved' });
    drawMain();
  });
  byId('finish').addEventListener('click', async () => {
    try {
      const result = await api('POST', '/api/finish', {});
      state.finished = true;
      byId('finish-outcome').textContent = `Outcome: ${result.outcome === 'approved' ? 'approved' : 'changes requested'}`;
      byId('finish-outcome').className = `outcome ${result.outcome}`;
      byId('finish-prompt').value = result.prompt;
      byId('finish-path').textContent = result.path ? `Saved to ${result.path}` : 'No feedback file was written.';
      byId('finish-dialog').showModal();
      drawChrome();
      drawMain();
    } catch (error) {
      fail(error);
    }
  });
  byId('copy-prompt').addEventListener('click', async () => {
    const box = byId('finish-prompt');
    try {
      await navigator.clipboard.writeText(box.value);
      byId('copy-prompt').textContent = 'Copied';
    } catch {
      // No clipboard access: the text is selected, so Ctrl+C or Cmd+C copies it.
      box.focus();
      box.select();
    }
  });
  byId('close-dialog').addEventListener('click', () => byId('finish-dialog').close());
  // Also when the dialog is closed with the Escape key.
  byId('finish-dialog').addEventListener('close', () => notice('The review is finished and the server has stopped. Your decisions are saved. Run "qa-core-review ui" again to change one. You can close this tab.'));
  document.addEventListener('keydown', (event) => {
    const typing = ['TEXTAREA', 'INPUT', 'SELECT'].includes(event.target.tagName);
    if (event.key === 'Escape' && typing) return void event.target.blur();
    if (typing || event.ctrlKey || event.metaKey || event.altKey || byId('finish-dialog').open || !state.session) return;
    const key = event.key.toLowerCase();
    const actions = {
      a: () => decide('approved'), r: () => decide('rejected'), c: () => decide('pending'),
      j: () => select(neighbourId(visible(), state.currentId, 1), true), k: () => select(neighbourId(visible(), state.currentId, -1), true),
      '/': () => byId('test-comment')?.focus(),
    };
    if (!Object.hasOwn(actions, key)) return;
    event.preventDefault();
    void actions[key]();
  });

  Promise.all([api('GET', '/api/report'), api('GET', '/api/session')]).then(([report, session]) => {
    Object.assign(state, { report, session, items: buildItems(report, session) });
    document.title = `qa-core-review ${report.tool.version}`;
    state.currentId = (state.items.find((item) => item.verdict === 'fail') ?? state.items[0])?.id ?? null;
    drawChrome();
    drawMain();
  }).catch((error) => {
    byId('main').replaceChildren(el('p', { class: 'muted', text: token === '' ? 'This address has no token. Open the full address that "qa-core-review ui" printed.' : 'The report could not be loaded.' }));
    fail(error);
  });
}

if (typeof document !== 'undefined') startPage();
