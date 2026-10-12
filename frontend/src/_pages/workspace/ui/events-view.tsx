"use client";
import { EventCard, formatEventRange, eventDateRange } from "@/entities/event";
import { isPastEventStart } from "@/entities/event/schedule";
import { Calendar } from "@/entities/event/calendar";
import { api } from "@/shared/api";
import { UserIdentity, Button, Card, EmptyState, Icon } from "@/shared/ui";
import {
  koreaDateKey,
  koreaDateParts,
  koreaMonthStart,
  shiftKoreaMonth,
} from "@/shared/lib/form";
import { useState } from "react";
import type { WorkspaceModel } from "../model/use-workspace";

export function EventsView({ model: m }: { model: WorkspaceModel }) {
  const [selectedDay, setSelectedDay] = useState(() =>
    koreaDateKey(new Date()),
  );
  const monthKey = koreaDateKey(m.month).slice(0, 7);
  const activeDay =
    selectedDay.slice(0, 7) === monthKey ? selectedDay : `${monthKey}-01`;
  const dayEvents = m.events.filter((event) => {
    const range = eventDateRange(event);
    return range.start <= activeDay && range.end >= activeDay;
  });
  const monthEvents = m.events.filter((event) => {
    const range = eventDateRange(event);
    return (
      range.start.slice(0, 7) <= monthKey && range.end.slice(0, 7) >= monthKey
    );
  });
  const navigateMonth = (offset: number) => {
    const next = shiftKoreaMonth(m.month, offset);
    m.setMonth(next);
    setSelectedDay(koreaDateKey(next));
  };
  const selectDay = (day: string) => {
    setSelectedDay(day);
    if (day.slice(0, 7) !== monthKey)
      m.setMonth(koreaMonthStart(new Date(`${day}T12:00:00+09:00`)));
  };
  const event = m.event;
  if (m.view !== "일정") return null;
  if (event) {
    const votingClosed = isPastEventStart(event);
    const start = koreaDateParts(new Date(event.starts_at));
    const attendance = m.attendance.find(
      (person) => person.user_id === m.me,
    )?.status;
    return (
      <section className="event-detail">
        <div className="event-detail-toolbar">
          <Button variant="ghost" onClick={m.goBackFromDetail}>
            <Icon name="arrow" className="icon-back" size={17} />
            일정으로 돌아가기
          </Button>
          {m.canEdit(event.author_id) && (
            <div className="row">
              <Button
                variant="secondary"
                size="small"
                onClick={() => m.setModal({ kind: "event", item: event })}
              >
                수정
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  m.setConfirm({
                    title: "일정을",
                    path: `${m.base}/events/${event.id}`,
                    after: () => m.setEvent(null),
                  })
                }
              >
                삭제
              </Button>
            </div>
          )}
        </div>
        <Card className="event-detail-summary">
          <div className="event-summary-heading">
            <div className="date-tile date-tile-large" aria-hidden="true">
              <small>{start.month}월</small>
              <strong>{start.day}</strong>
            </div>
            <div>
              <p className="event-overline">{m.group?.name}의 일정</p>
              <h1>{event.title}</h1>
              <UserIdentity
                profile={event.author}
                id={event.author_id}
                label="등록자"
              />
            </div>
          </div>
          <dl className="event-information">
            <div>
              <dt>
                <Icon name="calendar" size={20} />
                <span className="sr-only">일정 기간</span>
              </dt>
              <dd>
                <span>{formatEventRange(event)}</span>
                <small>한국 시간</small>
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="home" size={20} />
                <span className="sr-only">장소</span>
              </dt>
              <dd>{event.location || "장소 미정"}</dd>
            </div>
          </dl>
          <div className="event-description">
            <h2>
              <Icon name="posts" size={19} />
              일정 안내
            </h2>
            <p className="body">
              {event.description || "추가 안내가 없는 일정이에요."}
            </p>
          </div>
        </Card>
        <Card className="event-attendance-card">
          <div className="event-attendance-heading">
            <span className="event-section-icon">
              <Icon name="people" size={21} />
            </span>
            <div>
              <h2>함께할 수 있나요?</h2>
              <p>내 참석 여부를 모임에 알려 주세요.</p>
            </div>
          </div>
          <div className="event-attendance-options">
            {(
              [
                { value: "going", label: "참석할게요", icon: "check" },
                { value: "maybe", label: "아직 고민 중", icon: "clock" },
                { value: "not_going", label: "참석이 어려워요", icon: "close" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                variant={attendance === option.value ? "primary" : "secondary"}
                aria-pressed={attendance === option.value}
                disabled={votingClosed}
                loading={m.busy}
                onClick={() =>
                  void m.run(async () => {
                    if (isPastEventStart(event))
                      throw new Error(
                        "시작일이 지난 일정은 참석 응답을 변경할 수 없습니다",
                      );
                    await api(
                      `${m.base}/events/${event.id}/attendance`,
                      "PUT",
                      { status: option.value },
                    );
                    await m.openEvent(event);
                    m.notify("참석 응답을 저장했습니다");
                  })
                }
              >
                <Icon name={option.icon} size={19} />
                {option.label}
              </Button>
            ))}
          </div>
          {votingClosed && (
            <p className="form-hint" role="status">
              시작일이 지난 일정은 참석 응답을 변경할 수 없어요.
            </p>
          )}
          <div className="event-attendance-totals" aria-label="참석 응답 현황">
            <span>
              참석{" "}
              <strong>
                {m.attendance.filter((a) => a.status === "going").length}
              </strong>
            </span>
            <span>
              미정{" "}
              <strong>
                {m.attendance.filter((a) => a.status === "maybe").length}
              </strong>
            </span>
            <span>
              불참{" "}
              <strong>
                {m.attendance.filter((a) => a.status === "not_going").length}
              </strong>
            </span>
          </div>
        </Card>
      </section>
    );
  }
  return (
    <section className="events-page">
      <div className="events-toolbar">
        <div className="month-navigation" aria-label="월 이동">
          <Button
            variant="ghost"
            onClick={() => navigateMonth(-1)}
            aria-label="이전 달"
          >
            <Icon name="arrow" size={19} className="icon-back" />
            <span>이전 달</span>
          </Button>
          <h2>
            {koreaDateParts(m.month).year}년 {koreaDateParts(m.month).month}월
          </h2>
          <Button
            variant="ghost"
            onClick={() => navigateMonth(1)}
            aria-label="다음 달"
          >
            <span>다음 달</span>
            <Icon name="arrow" size={19} />
          </Button>
        </div>
        <div className="events-toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => {
              m.setMonth(koreaMonthStart());
              setSelectedDay(koreaDateKey(new Date()));
            }}
          >
            오늘
          </Button>
          <Button onClick={() => m.setModal({ kind: "event" })}>
            <Icon name="plus" size={18} />
            일정 만들기
          </Button>
        </div>
      </div>
      <Card className="schedule-calendar-card">
        <Calendar
          events={m.events}
          month={m.month}
          selectedDay={activeDay}
          onSelectDay={selectDay}
          onOpen={(event) => void m.openEvent(event)}
          onCreate={(day) => {
            selectDay(day);
            m.setModal({ kind: "event", initialDate: day });
          }}
        />
      </Card>
      <Card className="selected-day-agenda">
        <div className="section-heading">
          <h2>
            <Icon name="calendar" size={18} />
            {Number(activeDay.slice(5, 7))}월 {Number(activeDay.slice(8))}일{" "}
            <span>{dayEvents.length}개의 일정</span>
          </h2>
          <Button
            variant="ghost"
            size="small"
            disabled={activeDay < koreaDateKey(new Date())}
            onClick={() =>
              m.setModal({ kind: "event", initialDate: activeDay })
            }
          >
            <Icon name="plus" size={17} />이 날짜에 추가
          </Button>
        </div>
        {dayEvents.length ? (
          dayEvents.map((event) => (
            <button
              className="agenda-event"
              key={event.id}
              onClick={() => void m.openEvent(event)}
            >
              <span className="agenda-dot" />
              <span>
                <strong>{event.title}</strong>
                <small>{formatEventRange(event)}</small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))
        ) : (
          <p className="muted agenda-empty">
            선택한 날짜에 등록된 일정이 없어요.
          </p>
        )}
      </Card>
      <div className="events-list-heading">
        <h2>이번 달 일정</h2>
        <span>{monthEvents.length}개</span>
      </div>
      <div className="events-month-list">
        {monthEvents.length ? (
          monthEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onOpen={() => void m.openEvent(event)}
            />
          ))
        ) : (
          <Card>
            <EmptyState
              illustration="calendar"
              title="일정이 없어요"
              description="모임의 다음 만남을 기록해 보세요."
            />
          </Card>
        )}
      </div>
    </section>
  );
}
