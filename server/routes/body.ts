import mongoose, { type Types } from 'mongoose';
import { bodyLogInputSchema, type BodyLog } from '../../shared/schemas.js';
import { requireUserId } from '../auth.js';
import { ApiError, parse, type Route } from '../http.js';
import { BodyLogModel, type BodyLogFields } from '../models/BodyLog.js';

type Lean = BodyLogFields & { _id: Types.ObjectId };

export function toBodyLog(b: Lean): BodyLog {
  const m = b.measurements ?? {};
  return {
    id: String(b._id),
    date: b.date,
    weight: b.weight ?? null,
    measurements: {
      chest: m.chest ?? null,
      waist: m.waist ?? null,
      arm: m.arm ?? null,
      thigh: m.thigh ?? null,
    },
    notes: b.notes ?? '',
  };
}

function logId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Entry not found');
  return id;
}

export const bodyRoutes: Route[] = [
  {
    method: 'GET',
    path: '/body',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      // Oldest first, for charts. A few years of daily entries is still small.
      const logs = await BodyLogModel.find({ userId }).sort({ date: 1 }).limit(3000).lean<Lean[]>();
      res.json({ logs: logs.map(toBodyLog) });
    },
  },
  {
    // Saves the entry for that date (creates it, or replaces that day's entry).
    method: 'POST',
    path: '/body',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const input = parse(bodyLogInputSchema, req.body);
      const log = await BodyLogModel.findOneAndUpdate(
        { userId, date: input.date },
        { $set: input, $setOnInsert: { userId } },
        { upsert: true, returnDocument: 'after', runValidators: true },
      ).lean<Lean>();
      res.status(201).json({ log: toBodyLog(log!) });
    },
  },
  {
    method: 'PUT',
    path: '/body/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const input = parse(bodyLogInputSchema, req.body);
      const clash = await BodyLogModel.exists({
        userId,
        date: input.date,
        _id: { $ne: logId(id) },
      });
      if (clash) {
        throw new ApiError(409, 'date_taken', 'There is already an entry for this date', {
          date: 'Already has an entry',
        });
      }
      const log = await BodyLogModel.findOneAndUpdate({ _id: id, userId }, input, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>();
      if (!log) throw new ApiError(404, 'not_found', 'Entry not found');
      res.json({ log: toBodyLog(log) });
    },
  },
  {
    method: 'DELETE',
    path: '/body/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const r = await BodyLogModel.deleteOne({ _id: logId(id), userId });
      if (r.deletedCount === 0) throw new ApiError(404, 'not_found', 'Entry not found');
      res.json({ ok: true });
    },
  },
];
