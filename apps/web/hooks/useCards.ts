import { ReactElement, useState } from "react";

export default function useCards(cards: ReactElement[]) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  function goTo(index: number) {
    setCurrentStepIndex(index);
  }
  function next() {
    setCurrentStepIndex((prev) =>
      prev <= cards.length - 1 ? (prev += 1) : prev
    );
  }
  function back() {
    setCurrentStepIndex((prev) => (prev >= 0 ? (prev -= 1) : prev));
  }
  return {
    currentStepIndex,
    card: cards[currentStepIndex],
    goTo,
    next,
    back,
    cards,
  };
}
