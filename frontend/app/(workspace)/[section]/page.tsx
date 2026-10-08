import { viewFromPath } from "@/shared/config/navigation";
import { notFound } from "next/navigation";
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
