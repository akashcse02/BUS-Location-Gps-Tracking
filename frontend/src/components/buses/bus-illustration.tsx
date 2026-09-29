import { useId } from "react";
import { cn } from "@/lib/utils";

export type BusStatus = "On Route" | "Not Started" | "Delayed";

export const ROUTE_ACCENTS: Record<string, string> = {
  Gobindaganj: "#1F72C8",
  Sherpur: "#E0A03A",
  Gabtoli: "#2E8FDD",
  "Sathmatha/Bogura": "#5B6FD6",
  Dupchachia: "#3E8E5C",
};

export const PREMIUM_TRIM = "#D9A93C";

const DEFAULT_ACCENT = "#1F72C8";

const STATUS_STYLE: Record<BusStatus, { dot: string; text: string; pulse: boolean }> = {
  "On Route": { dot: "bg-emerald-500", text: "text-emerald-700", pulse: true },
  Delayed: { dot: "bg-amber-500", text: "text-amber-700", pulse: false },
  "Not Started": { dot: "bg-slate-400", text: "text-slate-600", pulse: false },
};

export function routeAccent(route: string) {
  return ROUTE_ACCENTS[route] ?? DEFAULT_ACCENT;
}

/* ---------- geometry ---------- */
const BODY_PATH =
  "M28 20 H204 Q226 20 229 44 L230 94 Q230 102 220 102 H22 Q12 102 12 92 V36 Q12 20 28 20 Z";
const WHEELS = [63, 186] as const;
const WINDOWS = [22, 57, 92] as const; // passenger windows, 31 wide
const WHEEL_ANGLES = [0, 72, 144, 216, 288] as const;

/** Realistic side-view coach: glossy livery, tinted glass, detailed wheels, live status. */
export function BusIllustration({
  number,
  route,
  status,
  premium = false,
  className,
}: {
  number: string;
  route: string;
  status: BusStatus;
  premium?: boolean;
  className?: string;
}) {
  const accent = premium ? PREMIUM_TRIM : routeAccent(route);
  const plate = number.replace(/^Bus\s*/i, "").trim();
  const plateSize = plate.length > 8 ? 7.5 : plate.length > 6 ? 9 : 10.5;
  const boardText = route.length > 14 ? `${route.slice(0, 13)}…` : route;
  const uid = useId().replace(/:/g, "");
  const s = STATUS_STYLE[status];
  const moving = status === "On Route";

  return (
    <div
      className={cn(
        "bus-illo relative w-full transition-transform duration-300 motion-safe:hover:-translate-y-0.5",
        moving && "is-moving",
        className,
      )}
    >
      {/* live status badge */}
      <div
        className={cn(
          "absolute -top-1 right-1 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1",
          "text-[10px] font-bold shadow-sm ring-1 ring-black/5 backdrop-blur",
          s.text,
        )}
      >
        <span className="relative flex h-2 w-2">
          {s.pulse && (
            <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", s.dot)} />
          )}
          <span className={cn("relative h-2 w-2 rounded-full", s.dot)} />
        </span>
        {status}
      </div>

      <svg
        viewBox="0 0 240 132"
        className="w-full overflow-visible drop-shadow-[0_10px_14px_rgba(15,47,87,0.18)]"
        role="img"
        aria-label={`${number}, ${route} route, ${status}`}
      >
        <style>{`
          .bus-wheel{transform-box:fill-box;transform-origin:center}
          .bus-illo:hover .bus-wheel{animation:bus-spin 1.1s linear infinite}
          .bus-illo.is-moving .bus-wheel{animation:bus-spin .9s linear infinite}
          .bus-illo.is-moving .bus-body{animation:bus-bob 1.3s ease-in-out infinite}
          @keyframes bus-spin{to{transform:rotate(360deg)}}
          @keyframes bus-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.7px)}}
          @media (prefers-reduced-motion:reduce){
            .bus-illo .bus-wheel,.bus-illo .bus-body{animation:none!important}
          }
        `}</style>

        <defs>
          {/* paint */}
          <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5aa8ee" />
            <stop offset="45%" stopColor="#2b7bcf" />
            <stop offset="100%" stopColor="#164f96" />
          </linearGradient>
          {/* glass */}
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6ebf8" />
            <stop offset="55%" stopColor="#8fb8d6" />
            <stop offset="100%" stopColor="#5f8fb4" />
          </linearGradient>
          <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`streak-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#b6c2d0" />
            <stop offset="100%" stopColor="#7d8ba0" />
          </linearGradient>
          <linearGradient id={`bumper-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id={`swoosh-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.75" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <radialGradient id={`ground-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`beam-${uid}`} cx="0" cy="0.5" r="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>

          <clipPath id={`body-${uid}`}>
            <path d={BODY_PATH} />
          </clipPath>
          <clipPath id={`glass-clip-${uid}`}>
            {WINDOWS.map((x) => (
              <rect key={x} x={x} y="32" width="31" height="32" rx="6" />
            ))}
            <rect x="130" y="34" width="13" height="44" rx="3" />
            <rect x="145" y="34" width="13" height="44" rx="3" />
            <path d="M170 32 H206 Q222 32 226 46 L227 64 H170 Z" />
          </clipPath>
        </defs>

        {/* ground shadow + headlight beam */}
        <ellipse cx="120" cy="121" rx="108" ry="7" fill={`url(#ground-${uid})`} />
        <path d="M230 78 L240 70 L240 92 L230 86 Z" fill={`url(#beam-${uid})`} />

        <g className="bus-body">
          {/* roof gear */}
          <rect x="74" y="12" width="76" height="9" rx="4" fill="#e3ebf3" />
          <rect x="74" y="12" width="76" height="3" rx="1.5" fill="#fff" opacity="0.8" />
          <rect x="82" y="15" width="60" height="1.2" fill="#94a3b8" opacity="0.6" />
          <rect x="164" y="15" width="22" height="5" rx="2.5" fill="#cbd5e1" />
          <rect x="32" y="16" width="1.5" height="6" fill="#475569" />
          <circle cx="32.7" cy="15.5" r="1.4" fill="#475569" />

          {/* main body */}
          <path d={BODY_PATH} fill={`url(#paint-${uid})`} />

          <g clipPath={`url(#body-${uid})`}>
            {/* roof edge & top gloss */}
            <rect x="0" y="20" width="240" height="3" fill={accent} />
            <rect x="0" y="23" width="240" height="9" fill={`url(#gloss-${uid})`} opacity="0.55" />

            {/* livery swoosh */}
            <path d="M0 90 C60 90 110 72 240 70 L240 79 C120 80 70 98 0 98 Z" fill={`url(#swoosh-${uid})`} />
            <path d="M0 87 C60 87 110 69 240 67 L240 68.4 C110 70.4 60 88.4 0 88.4 Z" fill="#fff" opacity="0.7" />

            {/* panel seams */}
            <rect x="84" y="64" width="0.8" height="34" fill="#0b2a52" opacity="0.28" />
            <rect x="162" y="64" width="0.8" height="34" fill="#0b2a52" opacity="0.28" />

            {/* lower shading for depth */}
            <rect x="0" y="92" width="240" height="12" fill="#0b2a52" opacity="0.35" />
          </g>

          {/* window frames */}
          {WINDOWS.map((x) => (
            <rect key={x} x={x - 1.5} y="30.5" width="34" height="35" rx="7.5" fill="#0f2542" />
          ))}
          <rect x="128" y="32" width="32" height="48" rx="4.5" fill="#0f2542" />
          <path d="M168.5 30.5 H206 Q224 30.5 228 46 L229 65.5 H168.5 Z" fill="#0f2542" />

          {/* glass */}
          {WINDOWS.map((x) => (
            <rect key={x} x={x} y="32" width="31" height="32" rx="6" fill={`url(#glass-${uid})`} />
          ))}
          <rect x="130" y="34" width="13" height="44" rx="3" fill={`url(#glass-${uid})`} />
          <rect x="145" y="34" width="13" height="44" rx="3" fill={`url(#glass-${uid})`} />
          <path d="M170 32 H206 Q222 32 226 46 L227 64 H170 Z" fill={`url(#glass-${uid})`} />

          {/* seat headrests seen through the windows */}
          {WINDOWS.map((x) => (
            <g key={x} opacity="0.32" fill="#0f2542">
              <rect x={x + 4} y="50" width="9" height="14" rx="4" />
              <rect x={x + 18} y="52" width="9" height="12" rx="4" />
            </g>
          ))}

          {/* sky reflections on all glass */}
          <g clipPath={`url(#glass-clip-${uid})`}>
            <path d="M40 30 L64 30 L38 66 L14 66 Z" fill={`url(#streak-${uid})`} />
            <path d="M104 30 L118 30 L92 66 L78 66 Z" fill={`url(#streak-${uid})`} />
            <path d="M172 30 L192 30 L172 80 L160 80 Z" fill={`url(#streak-${uid})`} opacity="0.9" />
          </g>

          {/* door handrail + kick panel */}
          <rect x="143.4" y="34" width="1.2" height="44" fill="#0f2542" opacity="0.5" />
          <rect x="131" y="80" width="26" height="14" rx="2" fill="#0b2a52" opacity="0.28" />

          {/* destination board */}
          <rect x="178" y="34" width="40" height="9" rx="2.5" fill="#0a1220" />
          <text
            x="198"
            y="40.6"
            textAnchor="middle"
            fontSize="5.4"
            fontWeight="700"
            fill="#fbbf24"
            fontFamily="var(--font-display)"
            textLength={Math.min(34, boardText.length * 3.3)}
            lengthAdjust="spacingAndGlyphs"
          >
            {boardText}
          </text>

          {/* side mirror */}
          <rect x="225" y="44" width="1.6" height="12" fill="#1e293b" />
          <rect x="226" y="42" width="7" height="13" rx="2.5" fill="#0f172a" />
          <rect x="227" y="43.5" width="2" height="9" rx="1" fill="#fff" opacity="0.35" />

          {/* headlight cluster + indicator */}
          <rect x="221" y="74" width="10" height="13" rx="3.5" fill="#1e293b" />
          <rect x="222.5" y="75.5" width="7" height="10" rx="3" fill="#fff7d6" />
          <circle cx="226" cy="80.5" r="2.2" fill="#fde68a" />
          <rect x="222" y="89" width="8" height="3.5" rx="1.5" fill="#f59e0b" />

          {/* tail light stack */}
          <rect x="10" y="68" width="5" height="22" rx="2.5" fill="#7f1d1d" />
          <rect x="10.5" y="69" width="4" height="9" rx="2" fill="#ef4444" />
          <rect x="10.5" y="80" width="4" height="8" rx="2" fill="#f87171" opacity="0.85" />

          {/* bumpers */}
          <rect x="9" y="96" width="224" height="8" rx="4" fill={`url(#bumper-${uid})`} />
          <rect x="12" y="97" width="218" height="1.6" rx="0.8" fill="#fff" opacity="0.22" />

          {/* number plate */}
          <g>
            <rect x="88" y="80" width="40" height="15" rx="3.5" fill="#fff" stroke="#0f2542" strokeWidth="1" />
            <rect x="89.5" y="81.5" width="37" height="12" rx="2.5" fill="none" stroke={accent} strokeWidth="1" />
            <text
              x="108"
              y="90.6"
              textAnchor="middle"
              fontSize={plateSize}
              fontWeight="800"
              fill="#111827"
              fontFamily="var(--font-display)"
            >
              {plate}
            </text>
          </g>
        </g>

        {/* wheel arches, tyres, rims */}
        {WHEELS.map((cx) => (
          <g key={cx}>
            <path d={`M${cx - 22} 104 A22 22 0 0 1 ${cx + 22} 104 Z`} fill="#081a30" />
            <path d={`M${cx - 22} 104 A22 22 0 0 1 ${cx + 22} 104`} fill="none" stroke="#fff" strokeOpacity="0.12" />

            <g className="bus-wheel">
              <circle cx={cx} cy="106" r="15" fill="#0f172a" />
              <circle cx={cx} cy="106" r="14" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="2.2 1.8" />
              <circle cx={cx} cy="106" r="10.5" fill="#1f2937" />
              <circle cx={cx} cy="106" r="8.6" fill={`url(#rim-${uid})`} />
              {WHEEL_ANGLES.map((a) => (
                <g key={a}>
                  <rect
                    x={cx - 0.9}
                    y="98.4"
                    width="1.8"
                    height="7.6"
                    rx="0.9"
                    fill="#64748b"
                    transform={`rotate(${a} ${cx} 106)`}
                  />
                  <circle
                    cx={cx}
                    cy="101.4"
                    r="0.95"
                    fill="#475569"
                    transform={`rotate(${a + 36} ${cx} 106)`}
                  />
                </g>
              ))}
              <circle cx={cx} cy="106" r="3.2" fill="#e2e8f0" />
              <circle cx={cx} cy="106" r="1.3" fill="#64748b" />
            </g>
          </g>
        ))}
      </svg>

      {/* route colour bar */}
      <div
        className="mt-3 h-1.5 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${accent}, ${accent}99)` }}
      />
    </div>
  );
}

/** Asphalt strip with kerb lines and dashed centre marking. Set `animated` for a moving road. */
export function RoadStrip({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none relative h-14 w-full overflow-hidden rounded-2xl",
        "bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 shadow-inner ring-1 ring-black/5",
        className,
      )}
    >
      {animated && (
        <style>{`
          @keyframes road-dash{to{background-position:60px 0}}
          .road-dash{animation:road-dash 1.1s linear infinite}
          @media (prefers-reduced-motion:reduce){.road-dash{animation:none}}
        `}</style>
      )}
      <div className="absolute inset-x-0 top-1.5 h-0.5 bg-white/85" />
      <div className="absolute inset-x-0 bottom-1.5 h-0.5 bg-white/85" />
      <div
        className={cn(
          "absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 opacity-90",
          "[background-image:repeating-linear-gradient(to_right,white_0_28px,transparent_28px_60px)]",
          animated && "road-dash",
        )}
      />
    </div>
  );
}

/** Low-opacity scenery: bus stop sign, street lamp and trees. */
export function Scenery() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.12]">
      {/* bus stop sign */}
      <svg className="absolute bottom-[12%] left-[3%] h-24 text-ink" viewBox="0 0 40 90" fill="currentColor">
        <rect x="18" y="22" width="3" height="68" />
        <rect x="6" y="4" width="28" height="20" rx="5" />
        <rect x="11" y="9" width="18" height="3" rx="1.5" fill="#fff" />
        <rect x="11" y="15" width="12" height="3" rx="1.5" fill="#fff" />
      </svg>

      {/* street lamp */}
      <svg className="absolute bottom-[8%] right-[6%] h-32 text-ink" viewBox="0 0 40 110" fill="currentColor">
        <rect x="8" y="22" width="3" height="88" />
        <path d="M9.5 22 Q9.5 4 30 8 L30 13 Q14 11 14 22 Z" />
        <rect x="26" y="12" width="9" height="5" rx="2.5" />
      </svg>

      {/* trees */}
      <svg className="absolute left-[28%] top-[6%] h-20 text-ink" viewBox="0 0 40 80" fill="currentColor">
        <rect x="18" y="46" width="4" height="34" />
        <circle cx="20" cy="32" r="18" />
      </svg>
      <svg className="absolute right-[26%] top-[14%] h-16 text-ink" viewBox="0 0 40 80" fill="currentColor">
        <rect x="18" y="46" width="4" height="34" />
        <circle cx="20" cy="30" r="15" />
      </svg>
    </div>
  );
}