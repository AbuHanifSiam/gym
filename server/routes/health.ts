import mongoose from 'mongoose';
import type { Route } from '../http.js';

export const healthRoutes: Route[] = [
  {
    method: 'GET',
    path: '/health',
    handler: async (_req, res) => {
      const connected = mongoose.connection.readyState === 1;
      res.json({ ok: true, db: connected ? 'connected' : 'disconnected' });
    },
  },
];
