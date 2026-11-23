import assert from "node:assert/strict";
import test from "node:test";
import { visibleViewportBox } from "./visible-viewport";

test("without a visual viewport the layout viewport is used", () => {
  assert.deepEqual(visibleViewportBox(undefined, 844), { top: 0, height: 844 });
  assert.deepEqual(visibleViewportBox(null, 844.4), { top: 0, height: 844 });
});

test("an open keyboard shrinks the box and Safari's scroll moves it down", () => {
  assert.deepEqual(
    visibleViewportBox({ height: 480.6, offsetTop: 0 }, 844),
    { top: 0, height: 481 },
  );
  // iOS scrolls the layout viewport to the focused field.
  assert.deepEqual(
    visibleViewportBox({ height: 480, offsetTop: 312.2, scale: 1 }, 844),
    { top: 312, height: 480 },
  );
});

test("pinch zoom and invalid readings fall back to the layout viewport", () => {
  assert.deepEqual(
    visibleViewportBox({ height: 300, offsetTop: 120, scale: 2 }, 844),
    { top: 0, height: 844 },
  );
  assert.deepEqual(
    visibleViewportBox({ height: 0, offsetTop: 0 }, 844),
    { top: 0, height: 844 },
  );
  assert.deepEqual(
    visibleViewportBox({ height: Number.NaN, offsetTop: 0 }, 844),
    { top: 0, height: 844 },
  );
  assert.deepEqual(
    visibleViewportBox({ height: 500, offsetTop: -8 }, 844),
    { top: 0, height: 500 },
  );
});
