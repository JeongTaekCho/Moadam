import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "모아담 — 모임의 이야기와 자료, 일정을 한곳에";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "app/fonts/NanumGothic-Bold.ttf"),
  );
  const mascot = await readFile(
    join(process.cwd(), "public/images/moa-ai-icon.png"),
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "#fff8ef",
        padding: 76,
        fontFamily: "Nanum",
        color: "#33251e",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 730 }}>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#ea6a20",
            marginBottom: 42,
          }}
        >
          모아담
        </div>
        <div style={{ display: "flex", fontSize: 62, lineHeight: 1.35 }}>
          모임의 이야기를,
        </div>
        <div style={{ display: "flex", fontSize: 62, lineHeight: 1.35 }}>
          한곳에 모아.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 25,
            color: "#766052",
            marginTop: 34,
          }}
        >
          커뮤니티 · 자료 보관함 · 일정 · 모아AI
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 21,
            color: "#a77556",
            marginTop: 32,
          }}
        >
          moadam.vercel.app
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${mascot.toString("base64")}`}
        width={280}
        height={280}
        alt=""
        style={{ objectFit: "contain" }}
      />
    </div>,
    {
      ...size,
      fonts: [{ name: "Nanum", data: font, weight: 700, style: "normal" }],
    },
  );
}
