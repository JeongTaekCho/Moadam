import { WorkspacePage } from "@/_pages/workspace";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WorkspacePage />
      {children}
    </>
  );
}
