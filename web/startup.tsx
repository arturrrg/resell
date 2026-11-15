import type { CSSProperties } from "react";
import { LoaderCircle } from "lucide-react";

// Centerline pen strokes, rather than font outlines or a horizontal reveal mask.
const signature = [
  { d: "M42 134 C50 104 60 69 75 39", delay: 70, duration: 230 },
  {
    d: "M43 71 C59 44 103 32 121 47 C138 65 106 92 63 92",
    delay: 285,
    duration: 320,
  },
  {
    d: "M68 91 C97 89 90 125 119 127 C129 128 133 119 138 110",
    delay: 580,
    duration: 200,
  },
  {
    d: "M135 112 C162 107 172 91 161 87 C148 83 130 111 137 122 C143 134 158 130 173 116 C184 103 196 92 198 87 C187 90 173 99 181 108 L191 117 C205 131 181 140 172 127 C182 134 198 130 211 114 C237 108 245 92 234 89 C221 84 204 113 212 124 C219 134 235 128 248 115 C264 95 294 51 285 43 C277 35 265 59 257 85 C247 117 251 132 265 126 L279 114 C296 94 327 49 317 43 C307 36 296 63 289 88 C279 119 284 130 298 126 L316 114",
    delay: 755,
    duration: 640,
  },
  { d: "M332 125 L332.1 124.9", delay: 1390, duration: 65 },
  { d: "M73 151 C137 141 231 139 320 143", delay: 1460, duration: 220 },
];

export function Startup({ error, onRetry, animate = true, showSpinner = true }: { error?: string; onRetry?: () => void; animate?: boolean; showSpinner?: boolean } = {}) {
  return (
    <div className="startup" role="status" aria-label="Loading Resell">
      {animate ? <div className="signature-mark" aria-hidden="true">
        <svg viewBox="0 0 360 180" fill="none">
          {signature.map((stroke, index) => (
            <path
              key={index}
              d={stroke.d}
              pathLength="1"
              className={
                index === signature.length - 1
                  ? "signature-flourish"
                  : undefined
              }
              style={
                {
                  "--ink-delay": `${stroke.delay}ms`,
                  "--ink-duration": `${stroke.duration}ms`,
                } as CSSProperties
              }
            />
          ))}
        </svg>
      </div> : showSpinner ? <LoaderCircle className="spinning" size={24} aria-hidden="true" /> : null}
      {error && <div className="startup-retry"><p role="alert">{error}</p><button onClick={onRetry}>Try again</button></div>}
    </div>
  );
}
