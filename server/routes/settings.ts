import { settingsUpdateSchema } from '../../shared/schemas.js';
import { requireUser, toPublicUser } from '../auth.js';
import { parse, type Route } from '../http.js';

export const settingsRoutes: Route[] = [
  {
    method: 'PUT',
    path: '/settings',
    handler: async (req, res) => {
      const user = await requireUser(req);
      const update = parse(settingsUpdateSchema, req.body);
      Object.assign(user.settings, update);
      await user.save();
      res.json({ user: toPublicUser(user) });
    },
  },
];
