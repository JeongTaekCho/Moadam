"""Generate the documentation's matching SVG/PNG diagrams, without API calls.

Python 3.12 + Pillow==11.3.0. Run from any directory.
Default font: macOS Apple SD Gothic Neo. For other OSes, set DIAGRAM_FONT to
a Korean-capable TTF/OTF (e.g. Noto Sans KR); regular and bold then use that font.
"""
from pathlib import Path
from html import escape
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONT = os.environ.get("DIAGRAM_FONT", "/System/Library/Fonts/AppleSDGothicNeo.ttc")
SCALE = 2
INK = "#302923"
MUTED = "#73685F"
ORANGE = "#E76825"
BLUE = "#357A9A"


class Canvas:
    def __init__(self, title, subtitle, height=970):
        self.width, self.height = 1600, height
        self.image = Image.new("RGB", (1600 * SCALE, height * SCALE), "#FCFAF7")
        self.draw = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{height}" viewBox="0 0 1600 {height}" role="img"><title>{escape(title)}</title><desc>{escape(subtitle)}</desc><rect width="1600" height="{height}" fill="#FCFAF7"/>']
        self.text(40, 36, "MOADAM / AI ENGINEERING", 17, ORANGE, True)
        self.text(40, 78, title, 38, INK, True)
        self.text(40, 131, subtitle, 20, MUTED)

    def font(self, size, bold=False):
        index = 6 if bold and FONT.endswith("AppleSDGothicNeo.ttc") else 0
        return ImageFont.truetype(FONT, round(size * SCALE), index=index)

    def text(self, x, y, value, size=20, color=INK, bold=False):
        font = self.font(size, bold)
        self.draw.text((x * SCALE, y * SCALE), value, fill=color, font=font, anchor="lt")
        width = self.draw.textlength(value, font=font) / SCALE
        assert x + width <= self.width - 15, f"Text overflow: {value}"
        self.svg.append(f'<text x="{x}" y="{y + size * .82}" font-family="Apple SD Gothic Neo,Noto Sans KR,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')

    def rect(self, x, y, w, h, fill="#FFFFFF", stroke="#E8DFD5", radius=18):
        self.draw.rounded_rectangle((x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE),radius=radius*SCALE,fill=fill,outline=stroke,width=2)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}"/>')

    def card(self, x, y, title, lines, step=None, color=ORANGE, w=330, h=220):
        self.rect(x,y,w,h)
        self.rect(x+20,y+20,38,32,fill="#FFF1E6",stroke="#FFF1E6",radius=9)
        self.text(x+30,y+26,str(step) if step is not None else "●",17,color,True)
        self.text(x+20,y+69,title,25,INK,True)
        for i,line in enumerate(lines):
            assert self.draw.textlength(line,font=self.font(19))/SCALE <= w-40, f"Card overflow: {line}"
            self.text(x+20,y+111+i*29,line,19,MUTED)

    def line(self, points, color=ORANGE, arrow=True, dashed=False):
        scaled=[(x*SCALE,y*SCALE) for x,y in points]
        if dashed:
            for a,b in zip(scaled,scaled[1:]):
                distance=math.dist(a,b)
                for offset in range(0,round(distance),16*SCALE):
                    end=min(offset+7*SCALE,distance)
                    self.draw.line([(a[0]+(b[0]-a[0])*offset/distance,a[1]+(b[1]-a[1])*offset/distance),(a[0]+(b[0]-a[0])*end/distance,a[1]+(b[1]-a[1])*end/distance)],fill=color,width=3)
        else: self.draw.line(scaled,fill=color,width=5,joint="curve")
        coords=" ".join(f"{x},{y}" for x,y in points)
        self.svg.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="2.5" stroke-linejoin="round"'+(' stroke-dasharray="7 9"' if dashed else '')+'/>')
        if arrow:
            (x0,y0),(x,y)=points[-2:]; angle=math.atan2(y-y0,x-x0)
            tri=[(x,y),(x-12*math.cos(angle-.48),y-12*math.sin(angle-.48)),(x-12*math.cos(angle+.48),y-12*math.sin(angle+.48))]
            self.draw.polygon([(a*SCALE,b*SCALE) for a,b in tri],fill=color)
            self.svg.append('<polygon points="'+' '.join(f'{a:.2f},{b:.2f}' for a,b in tri)+f'" fill="{color}"/>')

    def note(self, y, title, lines):
        self.rect(40,y,1490,65+len(lines)*30,fill="#FFF1E6",stroke="#F4D7C0")
        self.text(62,y+18,title,22,INK,True)
        for i,line in enumerate(lines): self.text(62,y+55+i*30,line,19,MUTED)

    def save(self, name):
        self.text(40,self.height-30,"코드 기준: 2026-10-08 · 흐름도는 구현을 설명하며 운영 배포 구성을 보증하지 않습니다.",15,MUTED)
        (ROOT/f"{name}.svg").write_text("\n".join(self.svg+["</svg>"]),encoding="utf8")
        self.image.save(ROOT/f"{name}.png",optimize=True)


def overview():
    c=Canvas("모아AI 전체 구성", "브라우저는 인증된 BFF를 호출하고, 검색과 모델 호출은 내부 RAG 서비스가 담당합니다.",1060)
    c.card(40,200,"브라우저",["Next.js · React 채팅 UI","질문 / 출처 / 대화 목록","빠른 글자 표시와 취소"],1)
    c.card(425,200,"Next BFF",["HttpOnly 쿠키 → Bearer","Origin 검증 / 세션 갱신","응답 body를 직접 전달"],2)
    c.card(810,200,"Spring API",["JWT · 모임 · 개인 대화 검증","허용 문서 목록 / 원자적 저장","내부 RAG 호출과 flush"],3)
    c.card(1195,200,"FastAPI RAG",["문서 처리 / 벡터 검색","프롬프트 / 인용 재검증","SSE → NDJSON 변환"],4)
    for x in (370,755,1140): c.line([(x,310),(x+55,310)])
    c.card(40,580,"비공개 Storage",["group-documents","PDF 원본 저장","권한 확인 후 서명 URL"],color=BLUE)
    c.card(425,580,"Supabase Auth",["로그인 / OAuth / 토큰","Spring이 서명 검증","모임 권한은 별도 DB 검사"],color=BLUE)
    c.card(810,580,"Postgres + pgvector",["문서 / vector(1536) 청크","모임 멤버십 / 개인 세션","질문 · 답변 · 출처 저장"],color=BLUE)
    c.card(1195,580,"OpenAI",["text-embedding-3-small","gpt-4.1-mini","질문과 발췌 → JSON 답변"],color=BLUE)
    c.line([(590,420),(590,580)],BLUE);c.text(608,495,"토큰",18,BLUE)
    c.line([(975,420),(975,580)],BLUE);c.text(993,495,"SQL",18,BLUE)
    c.line([(1360,420),(1360,580)],BLUE);c.text(1378,495,"모델 호출",18,BLUE)
    c.line([(1260,420),(1260,452),(205,452),(205,580)],BLUE);c.text(62,468,"PDF 읽기",18,BLUE)
    c.line([(1195,382),(1173,382),(1173,545),(1050,545),(1050,580)],BLUE)
    c.text(1005,517,"모임 범위 검색",18,BLUE)
    c.note(840,"데이터 범위",["AI의 검색 대상은 현재 모임의 ready 상태 · 현재 버전 PDF/메모 청크입니다.","커뮤니티 글·댓글·일정은 현재 AI 색인 대상이 아니며, 저장된 이전 대화도 모델 입력에 포함하지 않습니다."])
    c.save("ai_architecture")


def ingestion():
    c=Canvas("자료 등록 → 검색 가능한 지식", "PDF와 메모는 같은 색인 단계로 합쳐지며, 현재 문서 버전의 청크만 검색에 사용합니다.",1080)
    top=[("등록과 업로드",["관리자 / 소유자만 등록","PDF: 서명 URL에 PUT","메모: DB에 본문 저장"]),("원본 읽기",["PDF: 비공개 Storage 검증","pypdf로 페이지별 텍스트","메모: text_content 사용"]),("청크 분할",["페이지별 1,000자","겹침 150자 / 간격 850자","빈 청크 제거 · 최대 1,000개"]),("임베딩 생성",["32개씩 Embeddings 호출","text-embedding-3-small","각 청크 → 1,536차원 벡터"])]
    for i,(title,lines) in enumerate(top): c.card(40+i*385,200,title,lines,i+1)
    for x in (370,755,1140): c.line([(x,310),(x+55,310)])
    bottom=[("검색 허용",["ready 문서만 후보가 됨","문서 version = 청크 version","질문 시 모임 범위 재확인"]),("ready 전환",["청크 저장과 상태 변경 함께","실패: 같은 버전 청크 유지","새 버전 실패: failed 상태"]),("버전 잠금과 교체",["권한을 다시 검사","문서 행 SELECT FOR UPDATE","같은 트랜잭션에서 청크 교체"]),("저장할 청크 준비",["document_chunks에 저장할 행","문서 / 모임 / 버전 / 페이지","원문 조각과 vector(1536)"])]
    for i,(title,lines) in enumerate(bottom): c.card(40+i*385,565,title,lines,8-i)
    c.line([(1360,420),(1360,565)]); c.text(1380,485,"색인 완료 검증",18,ORANGE)
    for x in (1195,810,425): c.line([(x,675),(x-55,675)])
    c.note(835,"상태와 버전",["pending → processing → ready / failed · 메모 본문 수정 시 version + 1, pending으로 전환됩니다.","등록 시 색인을 동기 호출합니다. 메모 수정 후에는 다시 처리가 필요하며 별도 작업 큐는 없습니다."])
    c.save("ai_ingestion_pipeline")


def retrieval():
    c=Canvas("질문 → 근거 검색 → 답변 확정", "검색 전에 권한과 문서 범위를 적용하고, 답변이 끝난 뒤 실제 인용 청크를 다시 검사합니다.",1080)
    top=[("질문과 개인 세션",["현재 질문: 최대 4,000자","새 대화는 세션 먼저 생성","과거 대화는 모델에 미전달"]),("권한 · 범위 확인",["Spring: 모임 + 세션 소유자","RAG: DB에서 다시 확인","현재 ready 문서 ID만 전달"]),("질문 벡터와 검색",["질문을 1,536차원으로 변환","SQL에서 모임 / 버전 필터","코사인 거리 순 상위 5개"]),("근거 프롬프트",["질문 + untrusted_excerpts","제목 / 페이지 / 청크 ID 포함","제공된 발췌로만 답변 지시"])]
    for i,(title,lines) in enumerate(top): c.card(40+i*385,200,title,lines,i+1)
    for x in (370,755,1140): c.line([(x,310),(x+55,310)])
    bottom=[("화면 확정",["저장된 메시지 ID로 교체","완료 후 Markdown과 출처","미완성 초안은 실패 시 제거"]),("질문 · 답변 저장",["Spring이 세션 권한 재검사","한 DB 트랜잭션으로 저장","완료 메시지 2개를 반환"]),("인용 재검증",["검색된 실제 청크 ID만 선택","모임 / 현재 버전 / ready 확인","변경·근거 없음이면 유보"]),("모델 스트리밍",["gpt-4.1-mini, stream=true","JSON answer를 먼저 출력","본문 조각은 즉시 전달"])]
    for i,(title,lines) in enumerate(bottom): c.card(40+i*385,565,title,lines,8-i)
    c.line([(1360,420),(1360,565)]);c.text(1380,485,"생성 요청",18,ORANGE)
    for x in (1195,810,425): c.line([(x,675),(x-55,675)])
    c.note(835,"검색과 정답성은 구분합니다",["OpenAI 모드: 고정 0.3 임계값 없이 가까운 후보를 전달합니다. 0.3은 mock 검색에만 적용됩니다.","grounded와 인용 ID 검사는 출처 연결을 검증합니다. 답변의 모든 문장이 사실임을 보증하는 검사는 아닙니다."])
    c.save("ai_answer_pipeline")


def streaming():
    c=Canvas("실제 생성 스트리밍과 화면의 글자 표시", "OpenAI SSE는 내부 NDJSON으로 변환됩니다. 화면의 글자 애니메이션은 전송과 별개입니다.",1350)
    centers=[160,465,770,1075,1380]
    for x,title,detail in zip(centers,["브라우저","Next BFF","Spring API","FastAPI RAG","OpenAI"],["React / RAF","ReadableStream","flush / DB 저장","AnswerDecoder","SSE delta"]):
        c.rect(x-120,190,240,88)
        c.text(x-100,208,title,23,INK,True);c.text(x-100,245,detail,17,MUTED)
        c.line([(x,295),(x,1150)],"#D3C8BD",False,True)
    rows=[(335,0,1,"질문 POST + 쿠키"),(397,1,2,"Bearer JWT + 질문"),(459,2,3,"내부 토큰 + 허용 문서 ID"),(535,3,4,"질문 + 발췌 / stream=true"),(616,4,3,"SSE: JSON 문자열 조각"),(695,3,2,"NDJSON: delta(text)"),(774,2,1,"이벤트마다 flush"),(853,1,0,"body를 버퍼링 없이 전달"),(965,4,3,"[DONE] → JSON · 인용 검증"),(1044,3,2,"검증된 최종 결과"),(1130,2,0,"DB 저장 후 done(user, assistant)")]
    for y,start,end,label in rows:
        a,b=centers[start],centers[end]
        color=BLUE if start>end else ORANGE
        c.line([(a,y),(b,y)],color)
        c.text(min(a,b)+12,y-27,label,17,color,True)
    c.rect(40,885,260,48,fill="#FFF1E6",stroke="#F4D7C0",radius=10);c.text(55,900,"UTF-8 복원 → 프레임별 표시",16,ORANGE,True)
    c.rect(658,1065,225,44,fill="#EAF3F6",stroke="#DAE7ED",radius=10);c.text(674,1078,"권한 확인 + 원자적 저장",16,BLUE,True)
    c.note(1180,"초안과 확정 답변",["delta는 생성 중 초안입니다. 최종 인용·권한을 검증하고 저장한 뒤 done으로 확정합니다.","중지·오류 시 초안을 제거합니다. DB 커밋 직후 연결이 끊기면 저장됐을 수 있으므로 기록을 확인해야 합니다."])
    c.save("ai_streaming_sequence")


if __name__ == "__main__":
    for build in [overview,ingestion,retrieval,streaming]: build()
    print("Generated four SVG/PNG diagram pairs in",ROOT)
