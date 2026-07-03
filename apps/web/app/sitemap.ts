import { extraCalculatorLinks } from "@/lib/navigation";
import { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

export default function sitemap(): MetadataRoute.Sitemap {
  const extraCalcMap = extraCalculatorLinks.map((link) => ({
    url: `${baseUrl}${link.path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  const sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/nute-calc`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/public-recipes`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/stabilizers`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/tutorial`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/yeasts`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date().toISOString(),
      changeFrequency: "yearly",
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
    },
    {
      url: `${baseUrl}/juice`,
      lastModified: new Date().toISOString(),
      changeFrequency: "yearly",
    },
    ...extraCalcMap,
  ].map((item) => {
    const urlEnd = item.url.substring(baseUrl.length + 1);
    const de = `${baseUrl}/de/${urlEnd}`;

    return {
      ...item,
      alternates: {
        languages: {
          de,
        },
      },
    };
  }) as MetadataRoute.Sitemap;

  return sitemap;
}
