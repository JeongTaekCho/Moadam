"use client";
import { api } from "@/shared/api";
import {
  UserIdentity,
  Badge,
  Button,
  Card,
  Dropdown,
  TextField,
} from "@/shared/ui";
import type { WorkspaceModel } from "../model/use-workspace";
export function MembersView({ model }: { model: WorkspaceModel }) {
  const {
    me,
    view,
    members,
    invites,
    busy,
    setConfirm,
    inviteToken,
    setInviteToken,
    admin,
    owner,
    base,
    notify,
    load,
    run,
  } = model;
  return (
    <>
      {view === "멤버" && (
        <>
          <Card>
            <h2>모임 멤버</h2>
            {members.map((m) => (
              <div className="row between member-row" key={m.user_id}>
                <span className="row">
                  <UserIdentity profile={m.profile} id={m.user_id} />
                  {m.user_id === me && <Badge>나</Badge>}
                  <Badge>
                    {
                      {
                        owner: "소유자",
                        admin: "관리자",
                        member: "멤버",
                      }[m.role]
                    }
                  </Badge>
                </span>
                {m.role !== "owner" && admin && (
                  <Dropdown label="멤버 관리">
                    {owner && (
                      <Button
                        size="small"
                        variant="secondary"
                        loading={busy}
                        onClick={() =>
                          void run(async () => {
                            await api(`${base}/members/${m.user_id}`, "PATCH", {
                              role: m.role === "admin" ? "member" : "admin",
                            });
                            await load();
                            notify("권한을 변경했습니다");
                          })
                        }
                      >
                        {m.role === "admin" ? "멤버로 변경" : "관리자로 변경"}
                      </Button>
                    )}
                    {(owner || m.role === "member") && (
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() =>
                          setConfirm({
                            title: "멤버를",
                            path: `${base}/members/${m.user_id}`,
                          })
                        }
                      >
                        제거
                      </Button>
                    )}
                  </Dropdown>
                )}
              </div>
            ))}
          </Card>
          {admin && (
            <Card>
              <h2>초대 관리</h2>
              <p className="muted">
                초대 코드를 복사해 함께할 사람에게 전달하세요. 한 번만 사용할 수
                있고 7일 후 만료됩니다.
              </p>
              <Button
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await api<{ token: string }>(
                      `${base}/invites`,
                      "POST",
                      {},
                    );
                    setInviteToken(r.token);
                    await load();
                  })
                }
              >
                초대 코드 생성
              </Button>
              {inviteToken && (
                <div className="invite-copy">
                  <TextField
                    label="공유할 초대 코드"
                    readOnly
                    value={inviteToken}
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(inviteToken);
                        notify("초대 코드를 복사했습니다");
                      })
                    }
                  >
                    코드 복사
                  </Button>
                </div>
              )}{" "}
              {invites.map((i) => (
                <div className="row between card" key={i.id}>
                  <small>
                    {new Date(i.expires_at).toLocaleDateString("ko-KR")} 만료 ·{" "}
                    {i.used_at
                      ? "사용됨"
                      : i.revoked_at
                        ? "폐기됨"
                        : "사용 가능"}
                  </small>
                  {!i.used_at && !i.revoked_at && (
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() =>
                        setConfirm({
                          title: "초대를",
                          path: `${base}/invites/${i.id}`,
                        })
                      }
                    >
                      폐기
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}
