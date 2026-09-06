import assert from "node:assert/strict";
import test from "node:test";
import type { Step } from "react-joyride";

import { prepareTutorialSteps } from "./prepareTutorialSteps";

const translate = (key: string) => `translated:${key}`;

test("applies v3 defaults and advances through the card sentinel", async () => {
  let advanceCount = 0;
  const steps: Step[] = [
    { target: ".first", content: "first" },
    { target: ".second", content: "second", placement: "right" },
    { target: "toNextCard", content: "" }
  ];

  const prepared = prepareTutorialSteps({
    hasNextCard: true,
    isMobile: true,
    onNextCard: () => {
      advanceCount += 1;
    },
    steps,
    translate
  });

  assert.equal(prepared.length, 3);
  assert.equal(prepared[0]?.placement, "bottom");
  assert.equal(prepared[0]?.content, "translated:first");
  assert.equal(prepared[1]?.placement, "top");
  assert.equal(prepared[2]?.target, "body");

  await prepared[2]?.before?.({} as never);
  assert.equal(advanceCount, 1);
});

test("removes the sentinel on the final card and preserves custom content", () => {
  const prepared = prepareTutorialSteps({
    hasNextCard: false,
    isMobile: false,
    onNextCard: () => {},
    steps: [
      { target: "body", content: 42, placement: "center" },
      { target: "toNextCard", content: "" }
    ],
    translate
  });

  assert.equal(prepared.length, 1);
  assert.deepEqual(prepared[0]?.buttons, []);
  assert.equal(prepared[0]?.content, 42);
});
