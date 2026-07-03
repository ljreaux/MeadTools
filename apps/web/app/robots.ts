import type { MetadataRoute } from "next";
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/login/", "/register/", "/recipes/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
