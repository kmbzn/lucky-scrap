import data from "./items.json";
export type Item = {
  id: number;
  name: string;
  kind: string;
  weight: number;
  recipe: Record<string, number>;
};
export const items: Item[] = data as unknown as Item[];
export const icon = (id: number) =>
  `/item-icons/${String(id).padStart(3, "0")}.png`;
export function maxCraft(id: number, inventory: Record<string, number>) {
  return Math.min(
    ...Object.entries(items[id].recipe).map(([key, n]) =>
      Math.floor((inventory[key] || 0) / n),
    ),
  );
}
export function baseMaterials(id: number, count = 1): Record<string, number> {
  if (id < 24) return { [id]: count };
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(items[id].recipe))
    for (const [k, v] of Object.entries(baseMaterials(Number(key), n * count)))
      out[k] = (out[k] || 0) + v;
  return out;
}
