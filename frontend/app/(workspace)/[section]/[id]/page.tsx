import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { detailFromPath } from "@/shared/config/navigation";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}): Promise<Metadata> {
  const { section, id } = await params;
  const detail = detailFromPath(`/${section}/${id}`);
  return {
    title: detail ? `${detail.view} 상세` : "페이지를 찾을 수 없습니다",
    robots: { index: false, follow: false },
    alternates: { canonical: `/${section}/${id}` },
  };
}
export default async function DetailPage({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (!detailFromPath(`/${section}/${id}`)) notFound();
  return null;
}
