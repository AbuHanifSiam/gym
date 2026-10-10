import type { FoodSeed } from '../shared/nutrition.js';
import { seedFoods } from './seed/foods.js';

const byId = new Map(seedFoods.map((f) => [f.id, f]));

export function seedFood(id: string): FoodSeed | undefined {
  return byId.get(id);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

// Pre-split once: English name + Bangla transliteration ("bhat", "dal", "ilish").
const indexed = new WeakMap<FoodSeed, { name: string[]; all: string[] }>();
function index(f: FoodSeed) {
  let i = indexed.get(f);
  if (!i) {
    const name = words(f.name);
    i = { name, all: [...name, ...words(f.local)] };
    indexed.set(f, i);
  }
  return i;
}

/**
 * Every query word must start some word of the food's name or Bangla name.
 * Ranked: your own foods, then matches on the first word, cooked/ready-to-eat before raw,
 * then shorter names.
 */
export function searchFoods(foods: FoodSeed[], query: string, limit = 30): FoodSeed[] {
  const q = words(query);
  if (!q.length) return [];
  const scored: [number, FoodSeed][] = [];
  for (const f of foods) {
    const { name, all } = index(f);
    if (!q.every((t) => all.some((w) => w.startsWith(t)))) continue;
    let score = 0;
    if (f.source === 'custom') score -= 100;
    if (name[0]?.startsWith(q[0]) || words(f.local)[0]?.startsWith(q[0])) score -= 20;
    if (q.every((t) => all.includes(t))) score -= 10;
    if (name.includes('raw') || name.includes('dried')) score += 15;
    score += name.length;
    scored.push([score, f]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, f]) => f);
}
