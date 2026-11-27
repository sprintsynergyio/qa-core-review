// The server of the local review page (SPEC.md Sections 13.1 and 13.2). It listens on
// 127.0.0.1 only, asks for a random token on every API call, turns away requests that name
// another host, and serves the page from the package with no outside resource allowed.
import crypto from 'node:crypto';
import http from 'node:http';
import { readAsset } from '../assets.js';
import type { Report } from '../rules/types.js';
import { loadSession, outcomeOf, saveSession, updateFinding, updateGeneral, updateTest, type Outcome, type ReviewSession } from './session.js';

/** The files of the page, by the path they are served at. Nothing else is served. */
const PAGE_FILES: Readonly<Record<string, { asset: string; type: string }>> = {
  '/': { asset: 'ui/index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { asset: 'ui/index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { asset: 'ui/app.js', type: 'text/javascript; charset=utf-8' },
  '/highlight.js': { asset: 'ui/highlight.js', type: 'text/javascript; charset=utf-8' },
  '/styles.css': { asset: 'ui/styles.css', type: 'text/css; charset=utf-8' },
};
export const TOKEN_HEADER = 'x-qcr-token';
export const MAX_BODY_BYTES = 1024 * 1024;
export const IDLE_MS = 2 * 60 * 60 * 1000;
/** Sent with every answer: the page may load only what this server serves, and no site may frame it. */
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

export interface FinishResult { outcome: Outcome; prompt: string; path: string | null }

export interface UiServerOptions {
  report: Report;
  /** The text of each file of the report, by its path. */
  sources: Record<string, string>;
  /** Where the session is kept: `.qa-core/review/session.json`. */
  sessionFile: string;
  /** 0 or nothing: a free port chosen by the system. */
  port?: number;
  /** The server stops after this long with no request. */
  idleMs?: number;
  /**
   * The feedback prompt for the coding agent (SPEC.md Section 13.4), and where it was saved. It
   * arrives in Milestone 18. Until then the prompt is empty and no file is written.
   */
  feedback?: (report: Report, session: ReviewSession, outcome: Outcome) => { prompt: string; path: string | null };
}

export interface UiServer {
  /** The address the server listens on, as the system reports it: always 127.0.0.1. */
  address: string;
  port: number;
  token: string;
  /** `http://127.0.0.1:<port>/?t=<token>` */
  url: string;
  /** Resolves when the reviewer clicks Finish, or with null when the server stops for another reason. The server stops itself in both cases. */
  finished: Promise<FinishResult | null>;
  close(): Promise<void>;
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function readBody(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Past the limit the rest is read and thrown away, so the answer can still be sent.
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      if (size > MAX_BODY_BYTES) return reject(new RequestError(413, 'the request body is larger than 1 MB'));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new RequestError(400, 'the request body is not valid JSON'));
      }
    });
  });
}

/** Starts the server. Rejects when the port cannot be used. */
export function startUiServer(options: UiServerOptions): Promise<UiServer> {
  const { report, sources, sessionFile } = options;
  const token = crypto.randomBytes(32).toString('hex');
  const session = loadSession(sessionFile, report);
  saveSession(sessionFile, session);
  let port = 0;
  let idle: NodeJS.Timeout | undefined;
  let done: (result: FinishResult | null) => void = () => {};
  const finished = new Promise<FinishResult | null>((resolve) => {
    done = resolve;
  });

  const send = (response: http.ServerResponse, status: number, body: string | Uint8Array, type: string, after?: () => void): void => {
    response.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type });
    response.end(body, after);
  };
  const json = (response: http.ServerResponse, status: number, data: unknown, after?: () => void): void => send(response, status, JSON.stringify(data), 'application/json; charset=utf-8', after);
  const hasToken = (request: http.IncomingMessage): boolean => {
    const given = Buffer.from(String(request.headers[TOKEN_HEADER] ?? ''));
    const wanted = Buffer.from(token);
    return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  };
  /** Changes the session with what the body says, saves it and answers with the whole session. */
  const change = async (request: http.IncomingMessage, response: http.ServerResponse, apply: (body: unknown) => string | null): Promise<void> => {
    const problem = apply(await readBody(request));
    if (problem !== null) throw new RequestError(/^unknown /.test(problem) ? 404 : 400, problem);
    saveSession(sessionFile, session);
    json(response, 200, session);
  };

  const handle = async (request: http.IncomingMessage, response: http.ServerResponse): Promise<void> => {
    // A page of another site can make the browser call this port under its own name (DNS rebinding). Only our two names are let in.
    if (request.headers.host !== `127.0.0.1:${port}` && request.headers.host !== `localhost:${port}`) throw new RequestError(403, 'this server answers only as 127.0.0.1 or localhost');
    const { pathname } = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    const method = request.method ?? 'GET';
    if (!pathname.startsWith('/api/')) {
      // Browsers ask for an icon on their own. There is none, and that is not an error on the page.
      if (pathname === '/favicon.ico') return send(response, 204, '', 'text/plain; charset=utf-8');
      const page = Object.hasOwn(PAGE_FILES, pathname) ? PAGE_FILES[pathname]! : null;
      if (!page) throw new RequestError(404, 'not found');
      if (method !== 'GET' && method !== 'HEAD') throw new RequestError(405, 'use GET');
      return send(response, 200, method === 'HEAD' ? '' : readAsset(page.asset), page.type);
    }
    if (!hasToken(request)) throw new RequestError(403, 'the X-QCR-Token header is missing or wrong');
    const feedback = (): FinishResult => {
      const outcome = outcomeOf(report, session);
      return { outcome, ...(options.feedback?.(report, session, outcome) ?? { prompt: '', path: null }) };
    };
    const route = `${method} ${pathname}`;
    if (route === 'GET /api/report') return json(response, 200, { ...report, sources });
    if (route === 'GET /api/session') return json(response, 200, session);
    if (route === 'GET /api/prompt') return send(response, 200, feedback().prompt, 'text/plain; charset=utf-8');
    if (route === 'PUT /api/session/general') return change(request, response, (body) => updateGeneral(session, body));
    const target = /^PUT \/api\/session\/(tests|findings)\/([^/]+)$/.exec(route);
    if (target) {
      const id = decodeURIComponent(target[2]!);
      return change(request, response, (body) => (target[1] === 'tests' ? updateTest(session, id, body) : updateFinding(session, id, body)));
    }
    if (route === 'POST /api/finish') {
      await readBody(request);
      const result = feedback();
      Object.assign(session, { finishedAt: new Date().toISOString(), outcome: result.outcome });
      saveSession(sessionFile, session);
      // The answer goes out first. Then the server stops and whoever waits for the review goes on.
      return json(response, 200, result, () => done(result));
    }
    throw new RequestError(/^\/api\/(report|session|prompt|finish)/.test(pathname) ? 405 : 404, 'no such API call');
  };

  const server = http.createServer((request, response) => {
    idle?.refresh();
    handle(request, response).catch((error: unknown) => {
      if (response.headersSent) return void response.end();
      const known = error instanceof RequestError || error instanceof URIError;
      json(response, error instanceof RequestError ? error.status : known ? 400 : 500, { error: known ? (error as Error).message : 'internal error' });
    });
  });
  const close = (): Promise<void> => new Promise((resolve) => {
    clearTimeout(idle);
    done(null);
    server.close(() => resolve());
    server.closeAllConnections();
  });
  // After Finish there is nothing left to serve.
  void finished.then(() => close());

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // 127.0.0.1 only: never every interface of the machine.
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const bound = server.address() as { address: string; port: number };
      port = bound.port;
      idle = setTimeout(() => void close(), options.idleMs ?? IDLE_MS);
      resolve({ address: bound.address, port, token, url: `http://127.0.0.1:${port}/?t=${token}`, finished, close });
    });
  });
}
