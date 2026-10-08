import type { MetadataRoute } from "next";
import { siteUrl, searchIndexable } from "@/shared/config/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: searchIndexable ? "/" : undefined,
      disallow: searchIndexable ? ["/api/", "/login/"] : "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
