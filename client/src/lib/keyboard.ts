export type ChoiceNavigationKey = "ArrowDown" | "ArrowRight" | "ArrowUp" | "ArrowLeft" | "Home" | "End";

/**
 * Return the next choice index for standard keyboard navigation.
 * Arrow keys wrap so users can continue moving without leaving the choice group.
 */
export function getAdjacentChoiceIndex(
  currentIndex: number,
  totalChoices: number,
  key: string,
): number | null {
  if (totalChoices <= 0) return null;

  if (key === "Home") return 0;
  if (key === "End") return totalChoices - 1;

  const isNext = key === "ArrowDown" || key === "ArrowRight";
  const isPrevious = key === "ArrowUp" || key === "ArrowLeft";
  if (!isNext && !isPrevious) return null;

  const delta = isNext ? 1 : -1;
  return (currentIndex + delta + totalChoices) % totalChoices;
}
