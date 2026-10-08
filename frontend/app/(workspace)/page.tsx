import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  siteOpenGraph,
  siteUrl,
  siteName,
  siteDescription,
  searchIndexable,
} from "@/shared/config/site";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  const session = await cookies();
  const index =
    searchIndexable &&
    !session.get("access")?.value &&
    !session.get("refresh")?.value &&
    !Object.keys(query).length;
  return {
    alternates: { canonical: "/" },
    openGraph: { ...siteOpenGraph, url: "/" },
    robots: { index, follow: searchIndexable },
  };
}
export default function Page() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        alternateName: "Moadam",
        url: siteUrl,
        description: siteDescription,
        inLanguage: "ko-KR",
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: siteName,
        url: siteUrl,
        logo: `${siteUrl}/images/logo.png`,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\u003c"),
      }}
    />
  );
}
