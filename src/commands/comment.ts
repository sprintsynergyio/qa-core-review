// The `comment` command (SPEC.md Sections 11.1 and 14.3): post the Markdown view of a report
// as the one review comment of a pull request, or update the comment posted before. It runs
// inside a GitHub Actions job and reads the pull request from the event file of the run.
//
// This is the only command that uses the network when LLM mode is off.
import fs from 'node:fs';
import { apiBase, checkRepository, DEFAULT_API_URL, DEFAULT_COMMENT_AUTHOR, GitHubError, GitHubSetupError, pullRequestOf, upsertComment } from '../integrations/github.js';
import { formatMarkdown } from '../report/markdown.js';
import type { Report } from '../rules/types.js';
import { parse, UsageError } from './args.js';

export const COMMENT_USAGE = `Usage: qa-core-review comment --report <file> [--author <login>]

Posts the Markdown view of a report as one comment on the pull request of the current GitHub
Actions run. On the next run it updates that comment in place of adding a new one. It finds
its comment by the first line (<!-- qa-core-review -->) and by the account that wrote it.

Flags:
  --report <file>    The report.json a review wrote. Required.
  --author <login>   Only a comment by this account is updated. Default: ${DEFAULT_COMMENT_AUTHOR}
  --help, -h         Print this help.

Environment:
  GITHUB_TOKEN        A token that may write pull request comments. It is sent only to GITHUB_API_URL.
  GITHUB_REPOSITORY   The repository as owner/name. GitHub Actions sets it.
  GITHUB_EVENT_PATH   The event file of the run, where the pull request number is. GitHub Actions sets it.
  GITHUB_API_URL      The API address. Default: ${DEFAULT_API_URL}

Nothing is posted, with a note and exit code 0, when the run has no pull request, when the pull
request comes from a fork (its token cannot write), and when GitHub refuses with a 403.
This is the only command that uses the network when LLM mode is off.

Exit codes: 0 posted, updated or skipped, 1 GitHub could not be reached or answered with an error,
2 usage error, 3 internal error.
`;

/** A note for the person reading the job log. In a workflow run it becomes an annotation on the run. */
function say(level: 'notice' | 'warning', message: string): void {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const data = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    process.stdout.write(`::${level} title=qa-core-review::${data}\n`);
  } else process.stderr.write(`qa-core-review: ${level === 'warning' ? 'warning: ' : ''}${message}\n`);
}

function readJson(file: string, what: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new UsageError(`cannot read ${what}: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError(`${what} is not JSON: ${file}`);
  }
}

/** The comment text of a report file. A file that is not a version 2 report is a usage error. */
function bodyOf(file: string): string {
  const report = readJson(file, '--report') as Partial<Report> | null;
  const shown = file.split('\\').join('/');
  const usable = typeof report === 'object' && report !== null && report.schemaVersion === 2 && Array.isArray(report.files) && Array.isArray(report.findings)
    && typeof report.summary === 'object' && report.summary !== null && typeof report.mode === 'object' && report.mode !== null;
  if (usable) {
    try {
      return formatMarkdown(report as Report, { reportPath: shown });
    } catch {
      // Falls through: the file has the outline of a report and not its content.
    }
  }
  throw new UsageError(`--report is not a report this version can read (schemaVersion 2): ${shown}`);
}

export async function comment(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, ['help', 'report', 'author']);
  if (values.help) {
    process.stdout.write(COMMENT_USAGE);
    return 0;
  }
  if (positionals.length > 0) throw new UsageError(`comment takes no paths (got "${positionals[0]}"). Use --report <file>`);
  if (typeof values.report !== 'string' || values.report === '') throw new UsageError('comment needs --report <file>, the report.json of a review');
  const author = typeof values.author === 'string' && values.author !== '' ? values.author : DEFAULT_COMMENT_AUTHOR;
  const body = bodyOf(values.report);

  const env = process.env;
  const needed = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === '') throw new UsageError(`${name} is not set. The comment command runs inside a GitHub Actions job for a pull request`);
    return value;
  };
  const repository = needed('GITHUB_REPOSITORY');
  const apiUrl = env.GITHUB_API_URL === undefined || env.GITHUB_API_URL === '' ? DEFAULT_API_URL : env.GITHUB_API_URL;
  // A setting that is wrong is said before anything else, also for a run that would be skipped.
  try {
    checkRepository(repository);
    apiBase(apiUrl);
  } catch (error) {
    if (error instanceof GitHubSetupError) throw new UsageError(error.message);
    throw error;
  }
  const pull = pullRequestOf(readJson(needed('GITHUB_EVENT_PATH'), 'the event file (GITHUB_EVENT_PATH)'), repository);
  if (pull === null) {
    say('notice', 'This run has no pull request, so there is no comment to post.');
    return 0;
  }
  if (pull.fork) {
    say('notice', `Pull request #${pull.number} comes from a fork. The token of such a run cannot write comments, so the comment is skipped. The report is in the job summary.`);
    return 0;
  }
  const token = needed('GITHUB_TOKEN');

  try {
    const result = await upsertComment({ apiUrl, repository, number: pull.number, token, author }, body);
    const done = { created: 'Posted the review comment', updated: 'Updated the review comment', unchanged: 'The review comment already says the same' }[result.action];
    process.stdout.write(`qa-core-review: ${done} on pull request #${pull.number}${result.url === '' ? '' : `: ${result.url}`}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    if (error.status === 403) {
      say('warning', `The review comment was not posted: ${error.message}. The job needs "permissions: pull-requests: write" for the token it passes.`);
      return 0;
    }
    process.stderr.write(`qa-core-review: the review comment was not posted: ${error.message}\n`);
    return 1;
  }
}
