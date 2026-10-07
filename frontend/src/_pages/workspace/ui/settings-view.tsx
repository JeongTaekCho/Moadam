"use client";
import { api } from "@/shared/api";
import { values } from "@/shared/lib/form";
import { Button, Card, TextField } from "@/shared/ui";
import type { WorkspaceModel } from "../model/use-workspace";
export function SettingsView({ model }: { model: WorkspaceModel }) {
  const {
    groupId,
    view,
    busy,
    setConfirm,
    group,
    owner,
    base,
    notify,
    loadGroups,
    run,
  } = model;
  return (
    <>
      {view === "설정" && (
        <Card>
          <h2>모임 설정</h2>
          {owner ? (
            <form
              key={groupId}
              onSubmit={async (e) => {
                const b = values(e);
                await run(async () => {
                  await api(base, "PATCH", {
                    name: b.name,
                    timezone: "Asia/Seoul",
                  });
                  await loadGroups();
                  notify("설정을 저장했습니다");
                });
              }}
            >
              <TextField
                label="모임 이름"
                name="name"
                defaultValue={group?.name}
                maxLength={100}
                required
              />
              <p className="form-hint">
                모임 일정은 한국 표준시(KST, UTC+9) 기준으로 표시됩니다.
              </p>
              <Button loading={busy}>저장</Button>
              <div className="danger-zone">
                <h3>모임 삭제</h3>
                <p>
                  게시글, 일정, 자료와 대화가 함께 삭제됩니다. 삭제 후에는
                  복구할 수 없어요.
                </p>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    setConfirm({
                      title: "모임과 모든 자료를",
                      path: base,
                      after: () => void loadGroups(),
                    })
                  }
                >
                  모임 삭제
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p>
                모임 설정은 소유자가 관리합니다. 일정은 한국 표준시(KST, UTC+9)
                기준입니다.
              </p>
              <Button
                variant="danger"
                onClick={() =>
                  setConfirm({
                    title: "모임 멤버십을 (내 대화와 참석 응답도 삭제됩니다)",
                    path: `${base}/membership`,
                    after: () => void loadGroups(),
                  })
                }
              >
                모임 탈퇴
              </Button>
            </>
          )}
        </Card>
      )}
    </>
  );
}
