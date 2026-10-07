import type { PlanDay, PlanItem } from '../../../shared/schemas';

/** Plan items in the editor get a local id so drag-and-drop and React keys stay stable. */
export type DraftItem = PlanItem & { uid: string };
export type DraftDay = Omit<PlanDay, 'items'> & { items: DraftItem[] };

let counter = 0;
export const newUid = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export const toDraftDay = (d: PlanDay): DraftDay => ({
  ...d,
  items: d.items.map((i) => ({ ...i, uid: newUid() })),
});

export const fromDraftDay = (d: DraftDay): PlanDay => ({
  ...d,
  items: d.items.map(({ uid: _uid, ...i }) => i),
});
