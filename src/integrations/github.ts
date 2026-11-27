// The sticky pull request comment (SPEC.md Section 14.3): one comment per pull request that
// holds the Markdown report. It is found again by the marker on its first line and by the
// account that wrote it, and it is updated in place on every run.
//
// This file and the `comment` command are the only static code that uses the network. The
// token goes into the Authorization header of requests to the given API address and nowhere
// else: it is never printed, logged or written to a file.
import { MARKDOWN_MARKER } from '../report/markdown.js';
import { VERSION } from '../version.js';

/** The account the built-in token of a workflow run comments as. */
export const DEFAULT_COMMENT_AUTHOR = 'github-actions[bot]';
export const DEFAULT_API_URL = 'https://api.github.com';

const API_VERSION = '2022-11-28';
const PAGE_SIZE = 100;
/** 5,000 comments. A pull request with more gets a new comment. */
const MAX_PAGES = 50;
const TIMEOUT_MS = 30_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** GitHub could not be reached (status null), or it answered with an error status. */
export class GitHubError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

/** A setting the request cannot be made with: an API address or a repository name that is not one. */
export class GitHubSetupError extends Error {}

export interface PullRequestRef {
  number: number;
  /** The branch of the pull request lives in another repository. The token of such a run cannot write. */
  fork: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The pull request of a workflow run, read from its event file (GITHUB_EVENT_PATH).
 * null when the event has no pull request (a push, a schedule).
 */
export function pullRequestOf(event: unknown, repository: string): PullRequestRef | null {
  const pull = isRecord(event) ? event.pull_request : undefined;
  if (!isRecord(pull) || typeof pull.number !== 'number' || !Number.isInteger(pull.number) || pull.number <= 0) return null;
  // The head repository is missing when the fork was deleted. That is still a fork.
  const head = isRecord(pull.head) && isRecord(pull.head.repo) ? pull.head.repo.full_name : undefined;
  return { number: pull.number, fork: typeof head !== 'string' || head.toLowerCase() !== repository.toLowerCase() };
}

/** A repository is owner/name and nothing else, so it can be put into a request path as it is. */
export function checkRepository(repository: string): void {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.split('/').some((part) => /^\.+$/.test(part))) throw new GitHubSetupError(`GITHUB_REPOSITORY must be owner/name, not "${repository}"`);
}

/** The API address with no slash at the end. Plain http is allowed only for this machine, so a token never travels unencrypted. */
export function apiBase(apiUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new GitHubSetupError(`GITHUB_API_URL is not a URL: ${apiUrl}`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) throw new GitHubSetupError(`GITHUB_API_URL must start with https://, not ${url.protocol}//`);
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') throw new GitHubSetupError('GITHUB_API_URL must be a plain address with no user, query or fragment');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export interface CommentTarget {
  /** GITHUB_API_URL. */
  apiUrl: string;
  /** owner/name. */
  repository: string;
  /** The pull request number. */
  number: number;
  token: string;
  /** Only a comment by this account is updated. */
  author: string;
  /** For tests. Default: the fetch of Node. */
  fetch?: typeof fetch;
}

export interface CommentResult {
  action: 'created' | 'updated' | 'unchanged';
  id: number | null;
  /** The address of the comment on the site, or '' when the answer had none. */
  url: string;
}

async function request(target: CommentTarget, base: string, method: 'GET' | 'POST' | 'PATCH', route: string, body?: unknown): Promise<unknown> {
  const send = target.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(`${base}${route}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${target.token}`,
        'user-agent': `qa-core-review/${VERSION}`,
        'x-github-api-version': API_VERSION,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const reason = cause instanceof Error ? ((cause as NodeJS.ErrnoException).code ?? cause.name) : 'unknown error';
    throw new GitHubError(`could not reach ${new URL(base).host} (${reason})`, null);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text === '' ? null : JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    // The API explains itself in "message". Keep it short, on one line, and never let it carry the token.
    const said = isRecord(data) && typeof data.message === 'string' ? data.message.replace(/\s+/g, ' ').split(target.token).join('***').slice(0, 200) : '';
    throw new GitHubError(`GitHub answered ${response.status}${said === '' ? '' : `: ${said}`}`, response.status);
  }
  return data;
}

const resultOf = (action: CommentResult['action'], comment: unknown): CommentResult => ({
  action,
  id: isRecord(comment) && typeof comment.id === 'number' ? comment.id : null,
  url: isRecord(comment) && typeof comment.html_url === 'string' ? comment.html_url : '',
});

/**
 * Posts `body` as the review comment of a pull request. When the author already has a comment
 * that starts with the marker, that comment is updated (or left alone when it says the same).
 * A comment with the marker by anybody else is never touched.
 */
export async function upsertComment(target: CommentTarget, body: string): Promise<CommentResult> {
  checkRepository(target.repository);
  const base = apiBase(target.apiUrl);
  const issue = `/repos/${target.repository}/issues`;
  const isOurs = (comment: unknown): boolean => isRecord(comment) && typeof comment.id === 'number' && typeof comment.body === 'string'
    && comment.body.trimStart().startsWith(MARKDOWN_MARKER) && isRecord(comment.user) && comment.user.login === target.author;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const comments = await request(target, base, 'GET', `${issue}/${target.number}/comments?per_page=${PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(comments)) throw new GitHubError('GitHub answered with something that is not a list of comments', null);
    const ours: unknown = comments.find(isOurs);
    if (isRecord(ours)) {
      if (ours.body === body) return resultOf('unchanged', ours);
      return resultOf('updated', await request(target, base, 'PATCH', `${issue}/comments/${ours.id as number}`, { body }));
    }
    if (comments.length < PAGE_SIZE) break;
  }
  return resultOf('created', await request(target, base, 'POST', `${issue}/${target.number}/comments`, { body }));
}
