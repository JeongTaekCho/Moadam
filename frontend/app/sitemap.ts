import type { MetadataRoute } from "next";
import { siteUrl, searchIndexable } from "@/shared/config/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return searchIndexable
    ? [{ url: `${siteUrl}/` }, { url: `${siteUrl}/about` }]
    : [];
}
