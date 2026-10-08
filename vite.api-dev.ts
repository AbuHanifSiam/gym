import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

/**
 * Dev only: serves /api/* from server/app.ts inside `npm run dev`, so the full app runs
 * without the Vercel CLI. Adds the small slice of Vercel's req/res helpers the API uses
 * (req.query, req.body, res.status, res.json, res.send). Reads secrets from .env.
 */
export function apiDev(): Plugin {
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));

      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const query: Record<string, string | string[]> = {};
        for (const [k, v] of url.searchParams) {
          const prev = query[k];
          query[k] = prev === undefined ? v : [...(Array.isArray(prev) ? prev : [prev]), v];
        }
        query.__path = url.pathname.replace(/^\/+/, '');

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: unknown = raw || undefined;
        if (raw && req.headers['content-type']?.includes('application/json')) {
          try {
            body = JSON.parse(raw);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { code: 'bad_json', message: 'Invalid JSON' } }));
            return;
          }
        }

        const vreq = Object.assign(req, { query, body, cookies: {} });
        const vres = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return vres;
          },
          json(data: unknown) {
            if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return vres;
          },
          send(data: unknown) {
            if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
              return vres.json(data);
            }
            res.end(data as string | Buffer);
            return vres;
          },
        });

        try {
          const { handle } = await server.ssrLoadModule('/server/app.ts');
          await handle(vreq, vres);
        } catch (err) {
          server.config.logger.error(String((err as Error)?.stack ?? err));
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('API dev error');
          }
        }
      });
    },
  };
}
