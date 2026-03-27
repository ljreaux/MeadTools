import type { MDXComponents } from "mdx/types";
import DocImage from "@/components/docs/DocImage";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    DocImage,
    ...components,
  };
}
