import remarkGfm from "remark-gfm";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import rehypeSlug from "rehype-slugs";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["md", "mdx", "ts", "tsx"]
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      remarkGfm,
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "meta" }] // creates `export const meta = {...}`
    ],
    rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings, rehypeHighlight]
  }
});

export default withMDX(nextConfig);
