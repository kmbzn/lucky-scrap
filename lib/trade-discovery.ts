export function assertDiscoveredTrade(
  lines: readonly { itemId: number }[],
  discoveries: ReadonlySet<number>,
): void {
  if (lines.some((line) => !discoveries.has(line.itemId)))
    throw new Error("도감에 등록된 아이템만 거래에 사용할 수 있습니다");
}
