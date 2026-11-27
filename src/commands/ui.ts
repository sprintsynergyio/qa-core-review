// The `ui` command (SPEC.md Sections 11 and 13.1): run the review, then serve the local review
// page until the reviewer clicks Finish, presses Ctrl+C, or two hours pass with no request.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { toLf } from '../parse/positions.js';
import { formatSummary } from '../report/pretty.js';
import type { Report } from '../rules/types.js';
import { startUiServer, type UiServer } from '../ui/server.js';
import { parse, UsageError } from './args.js';
import { REVIEW_FLAGS, runFromFlags } from './review.js';

export const UI_USAGE = `Usage: qa-core-review ui [paths...] [flags]

Reviews the test files like "review", then opens a page in your browser where you approve or
reject each test, dismiss findings and leave comments. The page is served from this machine
only (127.0.0.1) and loads nothing from the internet. Decisions are saved in session.json
next to the report, so a refresh or a new run keeps them.

Flags:
  --port <n>            Port for the page. Default: a free port chosen by the system.
  --no-open             Do not open a browser. The address is printed in both cases.
  Every flag of "review" that chooses what is reviewed and where the report goes also works here:
  --diff, --staged, --rules, --disable, --language, --framework, --format, --output, --dump-model,
  --root, --config. See: qa-core-review review --help
  --help, -h            Print this help.

The page closes when you click Finish, when you press Ctrl+C here, or after 2 hours with no request.
`;

const FLAGS = [...REVIEW_FLAGS, 'port', 'no-open', 'gate'] as const;
/** A file larger than this is not sent to the page. */
const MAX_SOURCE_BYTES = 1024 * 1024;

/** The command that opens a URL in the default browser, as a program and its arguments. Null when the system is not known. */
export function browserCommand(platform: NodeJS.Platform, url: string): { command: string; args: string[] } | null {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  // `start` takes its first quoted argument as a window title, so an empty one comes first.
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '""', url] };
  return platform === 'linux' || platform.endsWith('bsd') ? { command: 'xdg-open', args: [url] } : null;
}

/** Opens the browser and does not wait for it. A system with no browser to open is no error: the address is printed too. */
function openBrowser(url: string): void {
  const opener = browserCommand(process.platform, url);
  if (!opener) return;
  const child = spawn(opener.command, opener.args, { shell: false, stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: process.platform === 'win32' });
  child.on('error', () => {});
  child.unref();
}

/** The text of each file of the report, with the line ends the report counted with. */
export function readSources(root: string, report: Report): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const file of new Set([...report.files.map((entry) => entry.file), ...report.findings.map((finding) => finding.location.file)])) {
    const absolute = path.resolve(root, file);
    // A path of the report is inside the root. Anything else is not read.
    if (path.relative(root, absolute).startsWith('..') || path.isAbsolute(path.relative(root, absolute))) continue;
    try {
      if (fs.statSync(absolute).size <= MAX_SOURCE_BYTES) sources[file] = toLf(fs.readFileSync(absolute, 'utf8'));
    } catch {
      // A file that is gone since the review is shown with no source.
    }
  }
  return sources;
}

export async function ui(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, FLAGS);
  if (values.help) {
    process.stdout.write(UI_USAGE);
    return 0;
  }
  if (values.gate) throw new UsageError('--gate is not available yet in this development build');
  if (values.stdout !== undefined) throw new UsageError('--stdout does not go with ui: the review page shows the report');
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535 || values.port === '')) throw new UsageError(`--port must be a whole number from 0 to 65535, not "${String(values.port)}"`);

  const { root, config, report, outputDir, written, shown } = await runFromFlags(values, positionals);
  process.stdout.write(`${formatSummary(report)}\nReports: ${written.join(', ')}\n`);
  if (report.files.length === 0 && report.findings.length === 0) {
    process.stdout.write('Nothing to review, so the review page was not opened.\n');
    return 0;
  }

  const sessionFile = path.join(outputDir, 'session.json');
  let server: UiServer;
  try {
    server = await startUiServer({ report, sources: readSources(root, report), sessionFile, port: port ?? config.ui.port });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE' || code === 'EACCES') throw new UsageError(`cannot use port ${port ?? config.ui.port} for the review page (${code}). Leave --port out to get a free one`);
    throw error;
  }
  // Ctrl+C is listened for before the address is printed, so whoever reads the address can stop the page at once.
  const stop = (): void => void server.close();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdout.write(`Review page: ${server.url}\nDecide on each test there, then click Finish. Press Ctrl+C to stop.\n`);
  if (values['no-open'] !== true && config.ui.open) openBrowser(server.url);

  const result = await server.finished;
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  await server.close();
  const saved = `Decisions are saved in ${shown(sessionFile)}`;
  process.stdout.write(result ? `Review finished: ${result.outcome === 'approved' ? 'approved' : 'changes requested'}. ${saved}\n` : `The review page was closed before Finish. ${saved}\n`);
  return 0;
}
