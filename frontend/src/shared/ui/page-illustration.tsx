import { MoaAiIcon } from "./moa-ai-icon";

export type IllustrationScene =
  | "home"
  | "documents"
  | "community"
  | "calendar"
  | "members"
  | "profile"
  | "settings"
  | "assistant"
  | "welcome";

const orange = "var(--scene-orange)";
const cream = "var(--scene-cream)";
const ink = "var(--scene-ink)";
const mint = "var(--scene-mint)";
const lilac = "var(--scene-lilac)";

function Paper({
  x,
  y,
  angle = 0,
  color = "white",
}: {
  x: number;
  y: number;
  angle?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle} 30 37)`}>
      <rect
        width="60"
        height="76"
        rx="10"
        fill={color}
        stroke={ink}
        strokeWidth="1.5"
      />
      <rect
        x="12"
        y="14"
        width="22"
        height="8"
        rx="4"
        fill={orange}
        opacity=".7"
      />
      <path
        d="M12 34h36M12 44h29M12 54h33"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".35"
      />
    </g>
  );
}

function Person({
  x,
  y,
  color = orange,
  angle = 0,
}: {
  x: number;
  y: number;
  color?: string;
  angle?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle} 26 33)`}>
      <rect width="52" height="66" rx="23" fill={color} />
      <circle cx="26" cy="24" r="14" fill={cream} />
      <path d="M13 20c1-13 24-14 26 0-8-2-10-6-13-8-3 5-7 7-13 8" fill={ink} />
      <path d="M9 64v-8c0-22 34-22 34 0v8" fill="white" fillOpacity=".8" />
      <path
        d="M21 26h.01M31 26h.01"
        stroke={ink}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M23 31q3 3 6 0"
        fill="none"
        stroke={ink}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  );
}

function Scene({ variant }: { variant: IllustrationScene }) {
  switch (variant) {
    case "documents":
      return (
        <>
          <g className="scene-drift">
            <Paper x={100} y={38} angle={12} color={mint} />
          </g>
          <g className="scene-drift-alt">
            <Paper x={58} y={49} angle={-12} />
          </g>
          <g className="scene-main">
            <path
              d="M44 91a10 10 0 0 1 10-10h51l13 12h83a10 10 0 0 1 10 10v47H44z"
              fill={orange}
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M46 113a10 10 0 0 1 10-10h149a9 9 0 0 1 9 11l-8 35a12 12 0 0 1-12 10H61a12 12 0 0 1-12-10z"
              fill={cream}
              stroke={ink}
              strokeWidth="1.5"
            />
            <rect x="105" y="122" width="43" height="12" rx="6" fill="white" />
          </g>
          <g className="scene-accent">
            <circle cx="215" cy="65" r="17" fill={lilac} />
            <path
              d="m208 65 5 5 9-10"
              fill="none"
              stroke={ink}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    case "community":
      return (
        <>
          <g className="scene-drift">
            <path
              d="M53 45h111a13 13 0 0 1 13 13v48a13 13 0 0 1-13 13H90l-21 18v-18H53a13 13 0 0 1-13-13V58a13 13 0 0 1 13-13"
              fill="white"
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M64 68h82M64 80h57M64 92h68"
              stroke={ink}
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".3"
            />
          </g>
          <g className="scene-drift-alt">
            <path
              d="M127 93h77a13 13 0 0 1 13 13v31a13 13 0 0 1-13 13h-12v15l-19-15h-46a13 13 0 0 1-13-13v-31a13 13 0 0 1 13-13"
              fill={orange}
              stroke={ink}
              strokeWidth="1.5"
            />
            <circle cx="142" cy="121" r="3" fill="white" />
            <circle cx="166" cy="121" r="3" fill="white" />
            <circle cx="190" cy="121" r="3" fill="white" />
          </g>
          <g className="scene-accent">
            <path
              d="M184 39c-13-15-29 3-14 16l14 12 14-12c15-13-1-31-14-16"
              fill={lilac}
            />
          </g>
        </>
      );
    case "calendar":
      return (
        <>
          <g className="scene-main">
            <rect
              x="61"
              y="42"
              width="138"
              height="114"
              rx="15"
              fill="white"
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M61 61a19 19 0 0 1 19-19h100a19 19 0 0 1 19 19v14H61z"
              fill={orange}
            />
            <path
              d="M94 32v23M166 32v23"
              stroke={ink}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {[0, 1, 2].map((row) =>
              [0, 1, 2, 3].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={80 + col * 28}
                  y={88 + row * 20}
                  width="12"
                  height="9"
                  rx="3"
                  fill={row === 1 && col === 2 ? orange : cream}
                />
              )),
            )}
          </g>
          <g className="scene-drift">
            <circle
              cx="199"
              cy="136"
              r="30"
              fill={mint}
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M199 120v18l12 6"
              fill="none"
              stroke={ink}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <g className="scene-accent">
            <path
              d="m43 79 7 7 12-14"
              fill="none"
              stroke={orange}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    case "members":
      return (
        <>
          <path
            d="M73 124q57-96 115 0"
            fill="none"
            stroke={ink}
            strokeWidth="1.5"
            strokeDasharray="4 7"
            opacity=".5"
          />
          <g className="scene-drift">
            <Person x={49} y={84} color={mint} angle={-8} />
          </g>
          <g className="scene-main">
            <Person x={104} y={47} />
          </g>
          <g className="scene-drift-alt">
            <Person x={161} y={84} color={lilac} angle={8} />
          </g>
          <g className="scene-accent">
            <circle cx="214" cy="58" r="15" fill={cream} />
            <path
              d="M214 51v14M207 58h14"
              stroke={ink}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    case "profile":
      return (
        <>
          <g className="scene-main">
            <rect
              x="65"
              y="37"
              width="130"
              height="125"
              rx="18"
              fill="white"
              stroke={ink}
              strokeWidth="1.5"
            />
            <circle cx="130" cy="88" r="32" fill={cream} />
            <Person x={104} y={55} color={orange} />
            <path
              d="M99 138h62M111 149h38"
              stroke={ink}
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".3"
            />
          </g>
          <g className="scene-drift">
            <circle cx="62" cy="117" r="19" fill={mint} />
            <path
              d="m54 117 5 5 11-12"
              fill="none"
              stroke={ink}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <g className="scene-accent">
            <path
              d="m202 50 4 10 11 2-9 7 1 11-10-6-10 4 3-11-7-8 11-1z"
              fill={lilac}
            />
          </g>
        </>
      );
    case "settings":
      return (
        <>
          <g className="scene-main">
            <rect
              x="58"
              y="44"
              width="139"
              height="111"
              rx="18"
              fill="white"
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M82 73h91M82 100h91M82 127h91"
              stroke={cream}
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle
              cx="113"
              cy="73"
              r="11"
              fill={orange}
              stroke={ink}
              strokeWidth="1.5"
            />
            <circle
              cx="149"
              cy="100"
              r="11"
              fill={lilac}
              stroke={ink}
              strokeWidth="1.5"
            />
            <circle
              cx="102"
              cy="127"
              r="11"
              fill={mint}
              stroke={ink}
              strokeWidth="1.5"
            />
          </g>
          <g className="scene-drift">
            <path
              d="m199 110 25 10v23c0 16-25 29-25 29s-25-13-25-29v-23z"
              fill={mint}
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="m189 139 7 7 14-17"
              fill="none"
              stroke={ink}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    case "assistant":
      return (
        <>
          <ellipse
            cx="130"
            cy="100"
            rx="87"
            ry="55"
            fill="none"
            stroke={orange}
            strokeWidth="1.3"
            strokeDasharray="4 8"
            opacity=".6"
          />
          <g className="scene-drift">
            <path
              d="M46 51h38a9 9 0 0 1 9 9v19a9 9 0 0 1-9 9H68l-12 9V88H46a9 9 0 0 1-9-9V60a9 9 0 0 1 9-9"
              fill="white"
              stroke={ink}
              strokeWidth="1.5"
            />
            <path
              d="M49 67h30M49 76h18"
              stroke={ink}
              strokeWidth="2"
              opacity=".35"
            />
          </g>
          <g className="scene-drift-alt">
            <Paper x={185} y={92} angle={12} color={cream} />
          </g>
        </>
      );
    case "welcome":
    case "home":
      return (
        <>
          <g className="scene-drift">
            <Paper x={51} y={54} angle={-16} color={cream} />
          </g>
          <g className="scene-drift-alt">
            <Paper x={152} y={34} angle={15} color="white" />
          </g>
          <path
            d="M49 158q81 28 163-4"
            fill="none"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".3"
          />
          <g className="scene-accent">
            <circle cx="211" cy="48" r="16" fill={mint} />
            <path
              d="m204 48 5 5 10-11"
              fill="none"
              stroke={ink}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </>
      );
  }
}

/** Original, decorative SVG scenes: no external assets, fonts, animation packages or network requests. */
export function PageIllustration({
  variant,
  className = "",
}: {
  variant: IllustrationScene;
  className?: string;
}) {
  const character =
    variant === "home" || variant === "assistant" || variant === "welcome";
  return (
    <div
      className={`page-illustration scene-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 260 190"
        fill="none"
        focusable="false"
        aria-hidden="true"
      >
        <path
          d="M39 90c-9-44 27-73 81-60 54-29 110 14 109 64 15 51-41 85-101 69-55 24-111-24-89-73"
          fill="var(--scene-wash)"
        />
        <ellipse cx="131" cy="168" rx="80" ry="7" fill={ink} opacity=".07" />
        <Scene variant={variant} />
        <g
          className="scene-accent"
          stroke={orange}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M32 49v9M27.5 53.5h9M227 95v8M223 99h8" />
          <circle cx="37" cy="135" r="3" fill={mint} stroke="none" />
          <circle cx="227" cy="148" r="3" fill={lilac} stroke="none" />
        </g>
      </svg>
      {character && <MoaAiIcon size={112} className="scene-character" />}
    </div>
  );
}
