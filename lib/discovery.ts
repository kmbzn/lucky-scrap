import { items } from "./items";
export function itemName(id: number, discovered: ReadonlySet<number>) {
  return discovered.has(id) ? items[id].name : "???";
}
export function matchesItem(
  id: number,
  query: string,
  discovered: ReadonlySet<number>,
) {
  return itemName(id, discovered).includes(query.trim());
}
