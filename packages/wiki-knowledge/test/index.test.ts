import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchWikiPage,
  getWikiIndexMetadata,
  loadWikiIndex,
  normalizeWikiUrl,
  searchWikiIndex,
} from "../src/index";

test("loads the reviewed Modern Meadmaking Wiki catalog", () => {
  const index = loadWikiIndex();

  assert.equal(index.site, "Modern Meadmaking Wiki");
  assert.equal(index.source, "https://wiki.meadtools.com/");
  assert.equal(index.pages.length, 75);
  assert.equal(index.pages[0]?.url, "https://wiki.meadtools.com/en/home");
});

test("exposes source metadata while preserving an absent source revision honestly", () => {
  assert.deepEqual(getWikiIndexMetadata(), {
    site: "Modern Meadmaking Wiki",
    source: "https://wiki.meadtools.com/",
    crawlScope:
      "Main page + all first-level linked pages + second-level pages discovered within them",
    generated: "2026-07-21",
    sourceRevision: null,
  });
});

test("ranks a specific process page above broad matches", () => {
  const results = searchWikiIndex("How should I choose a nutrient schedule?", {
    limit: 3,
  });

  assert.equal(results[0]?.title, "Nutrient Schedules");
  assert.ok(
    results.some(
      (result) =>
        result.url ===
        "https://wiki.meadtools.com/en/process/nutrient_schedules",
    ),
  );
});

test("returns no candidates for a query without meaningful tokens", () => {
  assert.deepEqual(searchWikiIndex("! ?"), []);
});

test("caps result sets at ten entries", () => {
  assert.ok(searchWikiIndex("mead", { limit: 100 }).length <= 10);
});

test("normalizes a wiki path and rejects off-host URLs", () => {
  assert.equal(
    normalizeWikiUrl("/en/process/nutrient_schedules"),
    "https://wiki.meadtools.com/en/process/nutrient_schedules",
  );
  assert.throws(
    () => normalizeWikiUrl("https://example.com/"),
    /only permits wiki\.meadtools\.com/,
  );
});

test("retrieves readable text and same-host links from an approved page", async () => {
  const result = await fetchWikiPage("/en/process/nutrient_schedules", {
    fetcher: async () =>
      response({
        body: `
        <html><head><title>Nutrient Schedules</title></head><body>
          <nav>Ignore navigation</nav><p>Use nutrients deliberately.</p>
          <a href="/en/ingredients/nutrients">Nutrients</a>
          <a href="https://example.com/">Off-host</a>
          <script>ignore();</script>
        </body></html>`,
      }),
  });

  assert.equal(result.title, "Nutrient Schedules");
  assert.match(result.text, /Use nutrients deliberately\./);
  assert.doesNotMatch(result.text, /Ignore navigation|ignore\(\)/);
  assert.deepEqual(result.links, [
    {
      url: "https://wiki.meadtools.com/en/ingredients/nutrients",
      text: "Nutrients",
    },
  ]);
});

test("validates every redirect target before requesting it", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchWikiPage("/en/home", {
        fetcher: async () => {
          calls += 1;
          return response({
            status: 302,
            ok: false,
            headers: headers({ location: "https://example.com/" }),
          });
        },
      }),
    /only permits wiki\.meadtools\.com/,
  );
  assert.equal(calls, 1);
});

test("rejects non-HTML and oversized responses", async () => {
  await assert.rejects(
    () =>
      fetchWikiPage("/en/home", {
        fetcher: async () =>
          response({ headers: headers({ "content-type": "application/pdf" }) }),
      }),
    /only accepts HTML/,
  );
  await assert.rejects(
    () =>
      fetchWikiPage("/en/home", {
        fetcher: async () =>
          response({
            headers: headers({
              "content-type": "text/html",
              "content-length": String(2 * 1024 * 1024 + 1),
            }),
          }),
      }),
    /size limit/,
  );
});

function headers(values: Record<string, string> = {}) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

function response(
  overrides: {
    status?: number;
    ok?: boolean;
    url?: string;
    headers?: { get(name: string): string | null };
    body?: string;
  } = {},
) {
  const status = overrides.status ?? 200;
  return {
    status,
    ok: overrides.ok ?? (status >= 200 && status < 300),
    url: overrides.url ?? "https://wiki.meadtools.com/en/home",
    headers:
      overrides.headers ??
      headers({ "content-type": "text/html; charset=utf-8" }),
    text: async () => overrides.body ?? "<html><body>Content</body></html>",
  };
}
