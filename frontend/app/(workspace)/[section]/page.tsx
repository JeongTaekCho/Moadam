import type { Metadata } from "next";
import { viewFromPath } from "@/shared/config/navigation";
import { notFound } from "next/navigation";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const view = viewFromPath("/" + section);
  return {
    title: view || "페이지를 찾을 수 없습니다",
    robots: { index: false, follow: false },
    alternates: { canonical: `/${section}` },
  };
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const view = viewFromPath("/" + section);
  if (!view) notFound();
  return null;
}
