import React, { useMemo } from "react";

interface Props {
    primaryMuscles: string[];
    secondaryMuscles?: string[];
    size?: number;
}

const MUSCLE_TO_REGIONS: Record<string, string[]> = {
    chest:       ["pec-l", "pec-r"],
    back:        ["back-l", "back-r"],
    lats:        ["back-l", "back-r"],
    traps:       ["trap-l", "trap-r"],
    front_delts: ["delt-l", "delt-r"],
    side_delts:  ["delt-l", "delt-r"],
    rear_delts:  ["delt-l", "delt-r"],
    biceps:      ["bicep-l", "bicep-r"],
    triceps:     ["tricep-l", "tricep-r"],
    forearms:    ["forearm-l", "forearm-r"],
    quads:       ["quad-l", "quad-r"],
    hamstrings:  ["ham-l", "ham-r"],
    glutes:      ["glute-l", "glute-r"],
    calves:      ["calf-l", "calf-r"],
    core:        ["abs"],
    obliques:    ["oblique-l", "oblique-r"],
    "obliqüs":   ["oblique-l", "oblique-r"],
    lower_back:  ["back-l", "back-r"],
    hip_flexors: ["hip-l", "hip-r"],
};

const HL = "#007AFF";
const BASE = "#6B6B6B";

// All body fill paths combined for clipping
const BODY_CLIP_PATHS = [
    // Head
    "m274.3 56.4c-1.5-7.5-14.7-33.4 15.5-46.4 7.8-2.9 24.3-4.6 36.2 11.9 6.4 9.6 7.9 18.9 4.1 34.5l-4.1 40.9-18.4 39.7-11.1 2.9-20.5-36.1-1.7-47.4z",
    // Left leg
    "m255.6 322.2c-10.5 3.5-35.3 56.7-40.3 77.4-4.9 20.7-9.8 55.9 0.4 83.5 5.6 19.7 5.3 28.2-0.4 51.4-5.7 19-15.2 38.2-7.4 77.6 3.8 27 4.2 51.5 1.3 71.8h22.4s-1.7-16.3 3.8-35.1c5.6-18.7 18.5-36.7 21.9-56.8s-2.1-53.1-2.1-53.1l15.8-60.7s15.8-29.1 18.8-72.6c1.2-15.4 1.2-18.7 1.2-18.7l-35.4-64.7z",
    // Right leg
    "m347.7 322.2c10.5 3.5 35.3 56.7 40.2 77.4 5 20.7 9.9 55.9-0.4 83.5-5.6 19.7-5.2 28.2 0.4 51.4 5.7 19 15.2 38.2 7.4 77.6-3.8 27-4.6 39.9-1.7 60.2l-22 0.9s1.7-5.6-3.8-24.4c-5.5-18.7-18.4-36.7-21.8-56.8s2.1-53.1 2.1-53.1l-15.9-60.7s-15.8-29.1-18.7-72.6c-1.3-15.4-1.3-18.7-1.3-18.7l35.5-64.7z",
    // Main body (torso + arms)
    "m274.3 99.4-25.9 26.3c-24.2 2.2-43 5.5-54.8 46-10.3 6.9-21.8 15.8-22.2 37.8-10.7 20.5-8.1 42.9-12.4 63.6s-2.6 31.4 0 53.9c0.9 7.4-3 10.8-2.6 14.6 0.5 3.8 2.2 11.2 1.7 18.6-0.4 7.4-5.9 19.7 1.3 23.8l9.9 8.3c3.8 1.7 13.4 1.2 17.8-2.5 4.3-0.5 6-1.3 6.5-4.3 3 3 8.9 4.3 8.9-0.8v-10.3l-5.1-14.2-15.8-15.6v-8.9l10.3-36.5 2.1-33.2c15.6-11.9 21.1-21 32.7-48.1l19.2 42.7-1.7 37.7 11.8 18.4c15 13.2 27 32.3 35.4 63.2 3 8.6 6.8 7.7 6.8 7.7 2.1-2.9 3.4-3.4 6.4 0 3 0 3.8-0.4 6.8-7.7 12.4-31.3 20-42.9 37.1-63.6l9.7-18-1.3-37.7 19.2-42.7c9.3 24.1 17.5 36.2 33.1 48.1l12 69.7v7.2l-14.5 14.8-6.3 17.9 1.2 12.9 5.1 1.3 5.9-4.3 3 4.3c4.3 3.4 14.9 5.9 19.6 2.5l10.3-7.6c4.2-5.2 2.1-10.7 1.3-20.5v-19.6l2.1-5.1-2.1-12.5c2.1-22.5 2.9-36.2-1.7-54.7-2.1-16.9-2.1-39.3-10.2-61.1-1.2-15.2-9-26.7-20.6-36.5-11.4-30.5-26.8-44.6-53.6-47.3l-33.8-21.4 2.5 18-21.4 12.5-9 2.1-7.1-1.6-18-14.3 0.4-23.3z",
    // Hip detail
    "m272.6 291.7 27.3-0.9 29.2 1.7-6.4 38.2-13 44.5h-16.6l-15.4-44-5.1-39.5z",
    // Shoulder regions
    "m258.2 134.6c-11.9 5.6-26.2 12.9-23.2 31l-31.7 29-9.7-19.9c7.2-19.1 16.4-42.6 41.8-43.9l22.8 3.8z",
    "m345.1 134.6c11.8 5.6 26.1 12.9 23.1 31l31.7 29 11-19.9c-7.1-19.1-16.5-42.6-41.9-43.9l-23.9 3.8z",
    // Arms
    "m193.6 181.9-8.2 6-6.8 14.7 0.4 18.4-14.4 43.3-1.7 46.1 3.3 25.3h13.2l9.9-41.1 0.8-29.5 10.7-21.8 25-61.8 4.9-9.4-37.1 9.8z",
    "m410.9 181.9 6.4 3.8 11.1 21.1-3.8 14.2 8.9 24.9 6.9 20.1 5.5 44.4-2.1 25.3-18.8 1.3-4.7-42.4-5.6-29.5-10.5-21.8-25.1-61.8-4.7-9.4 36.5 9.8z",
    // Chest panel
    "m276 100.3 10.3 9.1 12.7 28.4 13.6-27.9 10.9-10.5-3.4 18.6-13.8 19-7.3 1.6-8.9-1.6-11.5-17.3-2.6-19.4z",
    // Leg details
    "m258.2 349c-21.5 20.7-38.4 32.7-42.6 95.1 0.8 17 3.8 29.5 9.8 43.5l12-3.4 10.6-43.4 10.2-52.3v-39.5z",
    "m264.1 343.3 17.9 23.5-10.6 10.1-7.3 45.8-1.7 68.3-9.7 18.1-11.9 3.9-2.2-27.9 11.1-49.8 12.3-57.9 2.1-34.1z",
    "m248.4 513 6.4 24.4-17.4 22.4-7.5 97.5h-12.2c4.3-34.6-3.8-83.3 3.8-126.3l3.5-20.6 23.4 2.6z",
    "m344.7 349c21.5 20.7 38.6 32.7 42.8 95.1-0.8 17-3.8 29.5-9.7 43.5l-12-3.4-10.6-43.4-10.5-52.3v-39.5z",
    "m339.1 343.3-17.9 23.5 10.6 10.1 7.3 45.8 1.7 68.3 9.8 18.1 11.8 3.9 2.1-27.9-10.8-49.8-12.5-57.9-2.1-34.1z",
    "m354.8 513-6.3 24.4 17.3 22.4 7.5 97.5 10.4-1.3c-2.6-34.2 5.1-82-2.6-125l-3.3-20.6-23 2.6z",
    // Feet
    "m209.6 682.7-11.4 16.7-11.9 16-2.6 10.3 6.9 5.5 16.1 3.4 11.4-4.3 5.2-8.5c5.7-2.1 10.8-4.2 10.8-11l-2.1-15.6 2.1-11.3-2.1-10.3-19.9-3-2.5 12.1z",
    "m392.7 682.7 11.5 16.7 13.5 16 2.6 10.3-6.8 5.5-16.1 0.8-11.5-3.8-4.8-8.5c-5.6-0.4-12.5-2.1-12.9-8.9l0.8-15.6-2.5-11.3 2.1-15.9 22.8-0.4 1.3 15.1z",
    // Hands
    "m156.4 339.9 3.9 4.7h19.6l1.7-7.6c-7.6-1.3-15.8-0.9-25.2 2.9z",
    "m448.1 339.5-3.9 5.1h-19.6l-3-7.6c7.7-1.3 17.1-1.3 26.5 2.5z",
];

export default function MuscleBodyMap({ primaryMuscles, secondaryMuscles = [], size = 160 }: Props) {
    const { primarySet, secondarySet } = useMemo(() => {
        const p = new Set<string>();
        const s = new Set<string>();
        for (const m of primaryMuscles) for (const r of MUSCLE_TO_REGIONS[m] || []) p.add(r);
        for (const m of secondaryMuscles) for (const r of MUSCLE_TO_REGIONS[m] || []) { if (!p.has(r)) s.add(r); }
        return { primarySet: p, secondarySet: s };
    }, [primaryMuscles, secondaryMuscles]);

    const fill = (id: string) => primarySet.has(id) ? HL : secondarySet.has(id) ? HL : BASE;
    const op = (id: string) => primarySet.has(id) ? 0.85 : secondarySet.has(id) ? 0.35 : 0;

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="150 5 310 740" width={size} height={size * (740/310)} style={{ display: "block" }}>
            <defs>
                {/* Clip to body silhouette — overlays can never exceed the body */}
                <clipPath id="bodyClip">
                    {BODY_CLIP_PATHS.map((d, i) => <path key={i} d={d} />)}
                </clipPath>
            </defs>

            {/* ═══ GREY BASE BODY ═══ */}
            {BODY_CLIP_PATHS.map((d, i) => <path key={`base-${i}`} fill={BASE} d={d} />)}

            {/* ═══ MUSCLE OVERLAYS (clipped to body silhouette) ═══ */}
            <g clipPath="url(#bodyClip)">

                {/* ── CHEST / Pectorals ── */}
                {/* Left pec: from sternum (x≈298) to armpit (x≈258), y 150–205 */}
                <path fill={fill("pec-l")} opacity={op("pec-l")}
                      d="M296 150 Q282 148 266 158 Q258 168 258 182 Q260 196 268 204 Q278 210 290 206 Q296 198 296 175 Z"/>
                {/* Right pec: mirror */}
                <path fill={fill("pec-r")} opacity={op("pec-r")}
                      d="M304 150 Q318 148 334 158 Q342 168 342 182 Q340 196 332 204 Q322 210 310 206 Q304 198 304 175 Z"/>

                {/* ── SHOULDERS / Deltoids ── */}
                {/* Left delt: wraps over shoulder joint ~x230-260, y128-172 */}
                <path fill={fill("delt-l")} opacity={op("delt-l")}
                      d="M258 134 Q244 132 234 144 Q230 156 232 168 Q238 172 248 166 Q256 158 260 148 Z"/>
                {/* Right delt: mirror */}
                <path fill={fill("delt-r")} opacity={op("delt-r")}
                      d="M342 134 Q356 132 366 144 Q370 156 368 168 Q362 172 352 166 Q344 158 340 148 Z"/>

                {/* ── TRAPS ── */}
                {/* Left trap: neck to shoulder ~x262-296, y108-138 */}
                <path fill={fill("trap-l")} opacity={op("trap-l")}
                      d="M296 108 Q284 112 272 122 Q264 130 260 138 Q268 136 280 132 Q292 128 296 128 Z"/>
                {/* Right trap: mirror */}
                <path fill={fill("trap-r")} opacity={op("trap-r")}
                      d="M304 108 Q316 112 328 122 Q336 130 340 138 Q332 136 320 132 Q308 128 304 128 Z"/>

                {/* ── BICEPS ── */}
                {/* Left bicep: front of upper arm ~x226-240, y182-246 */}
                <path fill={fill("bicep-l")} opacity={op("bicep-l")}
                      d="M236 182 Q240 196 240 214 Q240 232 236 246 Q230 248 226 242 Q224 228 224 214 Q224 198 228 186 Z"/>
                {/* Right bicep: mirror */}
                <path fill={fill("bicep-r")} opacity={op("bicep-r")}
                      d="M364 182 Q360 196 360 214 Q360 232 364 246 Q370 248 374 242 Q376 228 376 214 Q376 198 372 186 Z"/>

                {/* ── TRICEPS ── */}
                {/* Left tricep: back of upper arm ~x212-226, y186-244 */}
                <path fill={fill("tricep-l")} opacity={op("tricep-l")}
                      d="M226 186 Q222 198 220 214 Q218 230 220 244 Q214 246 212 240 Q210 226 210 214 Q212 198 216 186 Z"/>
                {/* Right tricep: mirror */}
                <path fill={fill("tricep-r")} opacity={op("tricep-r")}
                      d="M374 186 Q378 198 380 214 Q382 230 380 244 Q386 246 388 240 Q390 226 390 214 Q388 198 384 186 Z"/>

                {/* ── FOREARMS ── */}
                {/* Left forearm: ~x196-220, y250-332, angled slightly inward */}
                <path fill={fill("forearm-l")} opacity={op("forearm-l")}
                      d="M220 250 Q218 270 212 295 Q208 315 202 332 Q196 334 194 328 Q198 308 204 288 Q210 268 214 252 Z"/>
                {/* Right forearm: mirror */}
                <path fill={fill("forearm-r")} opacity={op("forearm-r")}
                      d="M380 250 Q382 270 388 295 Q392 315 398 332 Q404 334 406 328 Q402 308 396 288 Q390 268 386 252 Z"/>

                {/* ── ABS / CORE ── */}
                {/* Central abs strip ~x286-314, y210-298 */}
                <path fill={fill("abs")} opacity={op("abs")}
                      d="M294 212 Q288 214 286 224 Q284 244 284 264 Q284 282 288 294 Q294 300 300 302 Q306 300 312 294 Q316 282 316 264 Q316 244 314 224 Q312 214 306 212 Z"/>

                {/* ── OBLIQUES ── */}
                {/* Left oblique: side of torso ~x262-284, y220-296 */}
                <path fill={fill("oblique-l")} opacity={op("oblique-l")}
                      d="M284 222 Q276 226 270 244 Q266 264 266 284 Q268 294 274 296 Q280 290 282 270 Q284 248 284 222 Z"/>
                {/* Right oblique: mirror */}
                <path fill={fill("oblique-r")} opacity={op("oblique-r")}
                      d="M316 222 Q324 226 330 244 Q334 264 334 284 Q332 294 326 296 Q320 290 318 270 Q316 248 316 222 Z"/>

                {/* ── QUADS ── */}
                {/* Left quad: front of thigh ~x252-296, y332-488 */}
                <path fill={fill("quad-l")} opacity={op("quad-l")}
                      d="M276 332 Q262 350 256 380 Q252 410 254 440 Q258 462 264 478 Q272 488 282 486 Q290 482 292 470 Q294 446 294 418 Q292 388 288 362 Q284 344 280 336 Z"/>
                {/* Right quad: mirror */}
                <path fill={fill("quad-r")} opacity={op("quad-r")}
                      d="M324 332 Q338 350 344 380 Q348 410 346 440 Q342 462 336 478 Q328 488 318 486 Q310 482 308 470 Q306 446 306 418 Q308 388 312 362 Q316 344 320 336 Z"/>

                {/* ── HAMSTRINGS (inner thigh visible from front) ── */}
                <path fill={fill("ham-l")} opacity={op("ham-l")}
                      d="M284 336 Q290 352 294 376 Q296 396 294 412 Q290 416 286 408 Q282 390 280 370 Q278 352 280 340 Z"/>
                <path fill={fill("ham-r")} opacity={op("ham-r")}
                      d="M316 336 Q310 352 306 376 Q304 396 306 412 Q310 416 314 408 Q318 390 320 370 Q322 352 320 340 Z"/>

                {/* ── GLUTES ── */}
                <path fill={fill("glute-l")} opacity={op("glute-l")}
                      d="M280 298 Q268 306 264 318 Q266 328 274 330 Q284 326 292 318 Q296 310 294 302 Q290 298 284 298 Z"/>
                <path fill={fill("glute-r")} opacity={op("glute-r")}
                      d="M320 298 Q332 306 336 318 Q334 328 326 330 Q316 326 308 318 Q304 310 306 302 Q310 298 316 298 Z"/>

                {/* ── HIP FLEXORS ── */}
                <path fill={fill("hip-l")} opacity={op("hip-l")}
                      d="M282 302 Q274 312 272 324 Q276 328 282 324 Q288 316 290 306 Q288 302 284 302 Z"/>
                <path fill={fill("hip-r")} opacity={op("hip-r")}
                      d="M318 302 Q326 312 328 324 Q324 328 318 324 Q312 316 310 306 Q312 302 316 302 Z"/>

                {/* ── CALVES ── */}
                {/* Left calf: ~x234-262, y500-640 */}
                <path fill={fill("calf-l")} opacity={op("calf-l")}
                      d="M260 500 Q254 520 248 550 Q242 580 238 610 Q236 630 240 640 Q248 642 252 632 Q256 610 258 580 Q262 550 264 525 Q264 510 262 500 Z"/>
                {/* Right calf: mirror */}
                <path fill={fill("calf-r")} opacity={op("calf-r")}
                      d="M340 500 Q346 520 352 550 Q358 580 362 610 Q364 630 360 640 Q352 642 348 632 Q344 610 342 580 Q338 550 336 525 Q336 510 338 500 Z"/>

                {/* ── BACK / LATS (side torso visible from front) ── */}
                <path fill={fill("back-l")} opacity={op("back-l")}
                      d="M258 158 Q252 172 248 194 Q246 216 250 234 Q254 240 258 236 Q260 220 260 200 Q260 178 260 164 Z"/>
                <path fill={fill("back-r")} opacity={op("back-r")}
                      d="M342 158 Q348 172 352 194 Q354 216 350 234 Q346 240 342 236 Q340 220 340 200 Q340 178 340 164 Z"/>
            </g>

            {/* ═══ SUBTLE OUTLINES ═══ */}
            <g fill="none" stroke="#555" strokeWidth="1" strokeMiterlimit="10" opacity="0.4">
                <path d="m274.3 56.4c-2.5-11.4-5.5-33.7 17.1-44.8 7.6-3.8 22.1-5.5 33.4 6.4 8.5 9.8 10.4 21.1 6.6 38.4"/>
                <path d="m299 138.6c-5.5-6.9-11-24.1-17.9-27.9-6.5-5.6-6.8-11.3-6.8-30.5"/>
                <path d="m299 138.6c5.6-6.9 11.1-24.1 17.9-27.9 6.6-5.6 7.5-11.3 7.5-30.5"/>
                <path d="m248 126.1 21.2-16.2 5.1-3.9 5.1 0.4"/>
                <path d="m353.7 126.1-21.2-16.2-5.2-3.9-3.4 0.4"/>
                <path d="m245.5 306.2c18.4 17.8 33.1 34.2 45.9 73.7 2.1 6 4.2 8.1 6.8 7.7 2.5-3.4 4.7-4.2 6.8 0 3 0.4 4.7-1.7 6.4-7.7 14.7-37.4 25.3-48.5 44.6-72"/>
                <path d="m268.8 56.4c-3-3.8-7.2-3.8-5.5 7.3 2.1 10.2 5.1 14.4 9.3 11.5"/>
                <path d="m333.9 56c3-2.5 7.3-2.5 5.6 8.6-2.1 10.2-5.1 13.5-9.4 11.9"/>
            </g>
        </svg>
    );
}
