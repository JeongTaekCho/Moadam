# 모아담 디자인 시스템

Tailwind CSS 4 / PostCSS / Pretendard Variable. 토큰의 원본은 `src/shared/styles/tokens.css`이며 `app/globals.css`의 base·components 레이어에서 전체 화면에 적용합니다. Tailwind utilities 레이어는 개별 컴포넌트에서 필요한 스타일을 조정할 수 있습니다.

| 역할 | 토큰 / Tailwind 클래스 | 기준 |
| --- | --- | --- |
| 주요 동작 | brand-600 / bg-brand-600 | #c2410c, 흰 글자와 충분한 대비 |
| hover | brand-700 | #9a3412 |
| 브랜드 강조 | brand-500 | #f97316, 장식·아이콘 강조 |
| 부드러운 배경 | brand-50 / brand-100 | 주황 계열의 옅은 배경 |
| 본문 | ink / text-ink | #29211d |
| 보조 정보 | muted / text-muted | #74665d |
| 바탕 / 카드 | canvas / surface | #fcfaf8 / #ffffff |
| 구분선 | line / border-line | #e9e2dc |
| 성공 / 경고 / 오류 | positive / caution / negative | 의미별 색상 유지 |
| 카드 / 컨트롤 | rounded-panel / rounded-control | 16px / 10px |

간격은 4px 단위, 주요 버튼과 메뉴는 최소 44px 높이입니다. 본문은 15px, 폼과 주요 설명은 14px 이상, 모바일 입력은 16px를 사용합니다. 키보드 focus는 주황색 outline·ring으로 표시합니다. disabled·hover·active·error 상태를 공통으로 처리하고 dialog는 중앙 배치와 native focus trap을 유지합니다.

로고는 원본 PNG를 Next Image로 표시합니다. 기존 심벌과 중복된 워드마크는 제거했습니다. 원본의 투명 여백은 표시 영역에서만 조정합니다.

## 이동과 로딩

공통 route group layout에서 워크스페이스를 유지합니다. 주요 메뉴는 Next Link로 제공하며 일반 클릭은 History API로 URL과 화면 상태를 바꿉니다. 수정 키 클릭과 새 탭 열기는 기본 링크 동작을 따릅니다. 뒤로/앞으로 이동, 직접 URL 진입, 로고 홈 이동을 지원합니다.

첫 화면의 데이터는 본문 스켈레톤으로 표시하고 갱신 중에는 기존 내용을 유지합니다. 늦게 완료된 이전 화면 요청은 반영하지 않습니다. 화면 진입 애니메이션은 180ms이며 reduced motion에서는 애니메이션과 전환을 제거합니다.

## 날짜·시간 입력

`DatePicker`, `TimePicker`, `DateTimePicker`는 `shared/ui/date-time-picker.tsx`의 공통 컴포넌트입니다. 날짜·시간 피커는 controlled value/onChange를 지원하고 통합 피커는 defaultValue와 name으로 폼에 `YYYY-MM-DDTHH:mm`을 전달합니다. 필수값·실제 날짜·24시간 형식 검사를 유지합니다. 날짜 달력은 방향키 이동, 월 전환, 오늘 선택을 지원하고 시간은 1분 단위 선택이 가능합니다. 팝오버는 Escape/바깥 클릭으로 닫히고 선택 후 트리거에 포커스를 돌려줍니다. 모든 textarea는 `resize: none`입니다.
