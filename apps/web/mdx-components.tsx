import type { MDXComponents } from "mdx/types";
import DocImage from "@/components/docs/DocImage";
import RecipeBuildingNav from "@/components/docs/RecipeBuildingNav";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    DocImage,
    RecipeBuildingNav,
    ...components,
  };
}
