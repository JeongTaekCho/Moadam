"use client";
import { Calendar, EventCard, formatTime } from "@/entities/event";
import { api } from "@/shared/api";
import { Button, Card, EmptyState } from "@/shared/ui";
import { koreaDateParts, shiftKoreaMonth } from "@/shared/lib/form";
import type { WorkspaceModel } from "../model/use-workspace";
export function EventsView({ model }: { model: WorkspaceModel }) {
  const {
    me,
    view,
    events,
    event,
    setEvent,
    goBackFromDetail,
    attendance,
    busy,
    setModal,
    setConfirm,
    month,
    setMonth,
    base,
    notify,
    run,
    canEdit,
    openEvent,
  } = model;
  return (
    <>
      {view === "일정" &&
        (event ? (
          <Card>
            <Button variant="ghost" onClick={goBackFromDetail}>
              ← 이전 페이지
            </Button>
            <h1>{event.title}</h1>
            <p>
              {formatTime(event.starts_at)} ~ {formatTime(event.ends_at)}
            </p>
            <small>한국 표준시(KST, UTC+9)</small>
            <p>{event.location}</p>
            <p className="body">{event.description}</p>
            <h3>나의 참석 응답</h3>
            <div className="row">
              {(["going", "not_going", "maybe"] as const).map((s) => (
                <Button
                  key={s}
                  variant={
                    attendance.find((a) => a.user_id === me)?.status === s
                      ? "primary"
                      : "secondary"
                  }
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `${base}/events/${event.id}/attendance`,
                        "PUT",
                        {
                          status: s,
                        },
                      );
                      await openEvent(event);
                      notify("참석 응답을 저장했습니다");
                    })
                  }
                >
                  {{ going: "참석", not_going: "불참", maybe: "미정" }[s]}
                </Button>
              ))}
            </div>
            <p className="muted">
              참석 {attendance.filter((a) => a.status === "going").length} ·
              불참 {attendance.filter((a) => a.status === "not_going").length} ·
              미정 {attendance.filter((a) => a.status === "maybe").length}
            </p>
            {canEdit(event.author_id) && (
              <div className="row">
                <Button
                  variant="secondary"
                  onClick={() => setModal({ kind: "event", item: event })}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfirm({
                      title: "일정을",
                      path: `${base}/events/${event.id}`,
                      after: () => setEvent(null),
                    })
                  }
                >
                  삭제
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <>
            <div className="row between">
              <div className="row">
                <Button
                  variant="ghost"
                  onClick={() => setMonth(shiftKoreaMonth(month, -1))}
                >
                  ← 이전 달
                </Button>
                <h2>
                  {koreaDateParts(month).year}년 {koreaDateParts(month).month}월
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => setMonth(shiftKoreaMonth(month, 1))}
                >
                  다음 달 →
                </Button>
              </div>
              <Button onClick={() => setModal({ kind: "event" })}>
                + 일정 만들기
              </Button>
            </div>
            <small>모든 일정은 한국 표준시(KST, UTC+9) 기준입니다.</small>
            <Calendar
              events={events}
              month={month}
              onOpen={(e) => void openEvent(e)}
            />
            <h2>일정 목록</h2>
            {events.length ? (
              events.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onOpen={() => void openEvent(e)}
                />
              ))
            ) : (
              <Card>
                <EmptyState
                  title="일정이 없어요"
                  description="모임의 다음 만남을 기록해 보세요."
                />
              </Card>
            )}
          </>
        ))}
    </>
  );
}
