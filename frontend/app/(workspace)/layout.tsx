import { cookies } from "next/headers";
import { WorkspacePage } from "@/_pages/workspace";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hasSession = !!(
    cookieStore.get("access")?.value || cookieStore.get("refresh")?.value
  );
  return (
    <>
      <WorkspacePage hasSession={hasSession} />
      {children}
    </>
  );
}
