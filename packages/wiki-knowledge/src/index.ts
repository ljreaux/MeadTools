import { z } from "zod";
import bundledWikiIndex from "../data/meadtools_wiki_index.json";

const wikiPageSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  level: z.number().int().nonnegative(),
  category: z.array(z.string().min(1)),
  summary: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  related_pages: z.array(z.string().url()),
});

const wikiIndexSchema = z.object({
  site: z.string().min(1),
  source: z.string().url(),
  crawl_scope: z.string().min(1),
  generated: z.string().min(1),
  source_revision: z.string().min(1).optional(),
  pages: z.array(wikiPageSchema).min(1),
});

export type WikiPage = z.infer<typeof wikiPageSchema>;
export type WikiIndex = z.infer<typeof wikiIndexSchema>;

export type WikiIndexMetadata = {
  site: string;
  source: string;
  crawlScope: string;
  generated: string;
  sourceRevision: string | null;
};

export type WikiSearchResult = Pick<
  WikiPage,
  "title" | "url" | "category" | "summary" | "keywords" | "related_pages"
>;

export type WikiPageLink = { url: string; text: string };

export type WikiPageContent = {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  links: WikiPageLink[];
};

export type WikiFetchResponse = {
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type WikiFetcher = (
  url: string,
  init: {
    headers: Record<string, string>;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<WikiFetchResponse>;

export const MEADTOOLS_WIKI_HOST = "wiki.meadtools.com";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 6000;
const MAX_LINKS = 40;

let bundledIndex: WikiIndex | undefined;

/** Load the reviewed, versioned wiki catalog bundled with MeadTools. */
export function loadWikiIndex(): WikiIndex {
  if (!bundledIndex) {
    bundledIndex = wikiIndexSchema.parse(bundledWikiIndex);
  }
  return bundledIndex;
}

export function getWikiIndexMetadata(): WikiIndexMetadata {
  const index = loadWikiIndex();
  return {
    site: index.site,
    source: index.source,
    crawlScope: index.crawl_scope,
    generated: index.generated,
    sourceRevision: index.source_revision ?? null,
  };
}

/**
 * Find a small, deterministic set of candidate pages for a question. The
 * retrieved page remains the source for a process claim; this index only
 * routes the model to likely authoritative pages.
 */
export function searchWikiIndex(
  query: string,
  options: { limit?: number } = {},
): WikiSearchResult[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
  return loadWikiIndex()
    .pages.map((page) => ({
      page,
      score: scorePage(page, tokens, normalize(query)),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.page.title.localeCompare(right.page.title),
    )
    .slice(0, limit)
    .map(({ page }) => ({
      title: page.title,
      url: page.url,
      category: page.category,
      summary: page.summary,
      keywords: page.keywords,
      related_pages: page.related_pages,
    }));
}

/**
 * Fetch readable content from one canonical MeadTools wiki page. Every redirect
 * target is checked before it is requested, keeping model-directed retrieval
 * restricted to the intended wiki host.
 */
export async function fetchWikiPage(
  input: string,
  options: { fetcher?: WikiFetcher } = {},
): Promise<WikiPageContent> {
  let url = normalizeWikiUrl(input);
  const fetcher = options.fetcher ?? defaultWikiFetcher;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetcher(url, {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.url && !isAllowedWikiUrl(response.url)) {
      throw new Error("Wiki retrieval redirected outside the approved host.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          "Wiki retrieval received a redirect without a location.",
        );
      }
      if (redirects === MAX_REDIRECTS) {
        throw new Error("Wiki retrieval exceeded the redirect limit.");
      }
      url = normalizeWikiUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Wiki retrieval failed with HTTP ${response.status}.`);
    }
    if (!response.headers.get("content-type")?.toLowerCase().includes("html")) {
      throw new Error("Wiki retrieval only accepts HTML pages.");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new Error("Wiki retrieval response exceeds the size limit.");
    }

    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("Wiki retrieval response exceeds the size limit.");
    }
    return extractWikiPage(url, html);
  }

  throw new Error("Wiki retrieval could not resolve a page.");
}

export function normalizeWikiUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Wiki retrieval requires a URL.");

  const url = new URL(
    trimmed.startsWith("/")
      ? `https://${MEADTOOLS_WIKI_HOST}${trimmed}`
      : trimmed.includes("://")
        ? trimmed
        : `https://${trimmed}`,
  );
  if (!isAllowedWikiUrl(url.toString())) {
    throw new Error(`Wiki retrieval only permits ${MEADTOOLS_WIKI_HOST}.`);
  }
  return url.toString();
}

function isAllowedWikiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === MEADTOOLS_WIKI_HOST;
  } catch {
    return false;
  }
}

async function defaultWikiFetcher(
  url: string,
  init: Parameters<typeof fetch>[1],
): Promise<WikiFetchResponse> {
  return fetch(url, init);
}

function extractWikiPage(url: string, html: string): WikiPageContent {
  const title = decodeHtml(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  ).trim();
  const links = extractLinks(url, html);
  const withoutNonContent = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|nav|footer|header|aside|svg)[^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    );
  const text = decodeHtml(withoutNonContent.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const truncated = text.length > MAX_TEXT_CHARS;

  return {
    url,
    title,
    text: truncated ? `${text.slice(0, MAX_TEXT_CHARS)}... [truncated]` : text,
    truncated,
    links,
  };
}

function extractLinks(baseUrl: string, html: string): WikiPageLink[] {
  const links: WikiPageLink[] = [];
  const anchorPattern =
    /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    if (links.length === MAX_LINKS) break;
    const href = decodeHtml(match[2] ?? "").trim();
    const text = decodeHtml((match[3] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (
      !href ||
      !text ||
      href.startsWith("#") ||
      /^(mailto|javascript):/i.test(href)
    ) {
      continue;
    }
    try {
      const url = new URL(href, baseUrl).toString();
      if (isAllowedWikiUrl(url)) links.push({ url, text });
    } catch {
      // Ignore malformed links; they are not a reliable retrieval target.
    }
  }

  return links;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function scorePage(page: WikiPage, tokens: string[], phrase: string): number {
  const title = normalize(page.title);
  const summary = normalize(page.summary);
  const categories = page.category.map(normalize);
  const keywords = page.keywords.map(normalize);
  let score = title.includes(phrase) ? 40 : 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 16;
    if (summary.includes(token)) score += 6;
    if (categories.some((category) => category.includes(token))) score += 8;
    if (keywords.some((keyword) => keyword.includes(token))) score += 12;
  }

  return score;
}

function queryTokens(query: string): string[] {
  return [
    ...new Set(
      normalize(query)
        .split(" ")
        .filter((token) => token.length >= 2),
    ),
  ];
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
