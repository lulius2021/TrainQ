// src/components/avatar/HumanAvatarSvg.tsx
// Human character SVG avatar.
// - Standing pose: body part sizes reflect training volume
// - Activity poses: running, cycling, handstand, rest

import React from "react";
import { motion } from "framer-motion";
import type { ActivityPose, BodyLevels } from "../../utils/avatarProgression";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionSvg = motion.svg as any;

export type { ActivityPose, BodyLevels };

type Props = {
  pose?: ActivityPose;
  bodyLevels?: BodyLevels;
  size?: number;
  animate?: boolean;
  accentColor?: string;
};

const DEFAULT_LEVELS: BodyLevels = {
  chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0, cardio: 0,
};

/* ─── Colors ─── */
const SKIN     = "#E8B49A";
const SKIN_SH  = "#D4956E";  // shadow / darker skin
const HAIR     = "#2C1810";
const DARK     = "#1E2035";   // cloth dark
const MID      = "#32365E";   // cloth mid

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/* ─── Limb primitive ─── */
// Draws a rounded rectangle from (x1,y1) to (x2,y2) with given width.
function Limb({
  x1, y1, x2, y2, w, fill, opacity = 1,
}: {
  x1: number; y1: number; x2: number; y2: number;
  w: number; fill: string; opacity?: number;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (len < 0.5) return null;
  return (
    <rect
      x={x1} y={y1 - w / 2}
      width={len} height={w}
      rx={w / 2} fill={fill} opacity={opacity}
      transform={`rotate(${angle},${x1},${y1})`}
    />
  );
}

/* ─── STANDING POSE ─── */
function StandingPose({ levels, accent }: { levels: BodyLevels; accent: string }) {
  const t = (v: number) => v / 10;
  const avg = (a: number, b: number) => (a + b) / 2;

  // Body measurements — grow with training
  const shoulderHalf = lerp(13, 21, t(avg(levels.shoulders, levels.chest)));
  const torsoHalf    = lerp(9.5, 15.5, t(avg(levels.chest, levels.back)));
  const waistHalf    = lerp(7, 10.5, t(levels.core * 0.5));
  const upperArmW    = lerp(5, 11.5, t(levels.arms));
  const forearmW     = lerp(4, 8.5, t(levels.arms));
  const thighW       = lerp(7, 14.5, t(levels.legs));
  const calfW        = lerp(5, 9.5, t(levels.legs));

  const CX = 50;

  // Y layout
  const headCy    = 17;
  const headR     = 11;
  const neckTop   = headCy + headR;
  const shoulderY = neckTop + 9;
  const torsoBot  = shoulderY + 47;
  const hipY      = torsoBot + 3;
  const kneeY     = hipY + 30;
  const ankleY    = kneeY + 26;
  const footY     = ankleY + 5;

  // Arm positions
  const lShX   = CX - shoulderHalf;
  const rShX   = CX + shoulderHalf;
  const elbowY = shoulderY + 24;
  const wristY = elbowY + 20;

  // Leg positions
  const lHipX = CX - 7, rHipX = CX + 7;

  const showAbs  = levels.core >= 4;
  const absAlpha = Math.min(0.55, (levels.core - 4) / 6 * 0.55);

  return (
    <>
      {/* Hair */}
      <ellipse cx={CX} cy={headCy - 6} rx={headR} ry={headR * 0.68} fill={HAIR} />

      {/* Head */}
      <circle cx={CX} cy={headCy} r={headR} fill={SKIN} />
      <ellipse cx={CX} cy={headCy + 5} rx={5} ry={3} fill={SKIN_SH} opacity={0.3} />

      {/* Ears */}
      <ellipse cx={CX - headR + 1.5} cy={headCy + 2} rx={2} ry={3} fill={SKIN_SH} />
      <ellipse cx={CX + headR - 1.5} cy={headCy + 2} rx={2} ry={3} fill={SKIN_SH} />

      {/* Neck */}
      <Limb x1={CX} y1={neckTop} x2={CX} y2={shoulderY} w={8} fill={SKIN} />

      {/* Torso — tapered trapezoid */}
      <path
        d={`M ${CX - shoulderHalf} ${shoulderY}
            L ${CX + shoulderHalf} ${shoulderY}
            L ${CX + waistHalf}    ${torsoBot}
            L ${CX - waistHalf}    ${torsoBot} Z`}
        fill={DARK}
      />

      {/* Chest definition at high chest level */}
      {levels.chest >= 3 && (
        <line
          x1={CX} y1={shoulderY + 5} x2={CX} y2={torsoBot - 12}
          stroke={accent} strokeWidth={0.9} opacity={Math.min(0.4, (levels.chest - 3) / 7 * 0.4)}
        />
      )}

      {/* Abs at high core level */}
      {showAbs && [1, 2, 3].map(i => (
        <line
          key={i}
          x1={CX - torsoHalf * 0.45} y1={shoulderY + 14 + i * 10}
          x2={CX + torsoHalf * 0.45} y2={shoulderY + 14 + i * 10}
          stroke={accent} strokeWidth={0.8} opacity={absAlpha}
        />
      ))}

      {/* Shoulder caps */}
      <ellipse cx={lShX} cy={shoulderY + 5} rx={4.5} ry={3.5} fill={MID} />
      <ellipse cx={rShX} cy={shoulderY + 5} rx={4.5} ry={3.5} fill={MID} />

      {/* Left arm */}
      <Limb x1={lShX}     y1={shoulderY + 5} x2={lShX - 2}   y2={elbowY}   w={upperArmW} fill={SKIN} />
      <Limb x1={lShX - 2} y1={elbowY}        x2={lShX - 1}   y2={wristY}   w={forearmW}  fill={SKIN} />
      <ellipse cx={lShX - 1} cy={wristY + 3} rx={forearmW * 0.52} ry={3.5} fill={SKIN} />

      {/* Right arm */}
      <Limb x1={rShX}     y1={shoulderY + 5} x2={rShX + 2}   y2={elbowY}   w={upperArmW} fill={SKIN} />
      <Limb x1={rShX + 2} y1={elbowY}        x2={rShX + 1}   y2={wristY}   w={forearmW}  fill={SKIN} />
      <ellipse cx={rShX + 1} cy={wristY + 3} rx={forearmW * 0.52} ry={3.5} fill={SKIN} />

      {/* Waistband / shorts highlight */}
      <rect
        x={CX - waistHalf * 1.1} y={torsoBot - 1}
        width={waistHalf * 2.2} height={9} rx={3}
        fill={accent} opacity={0.75}
      />

      {/* Hips */}
      <rect
        x={CX - torsoHalf * 0.85} y={hipY - 4}
        width={torsoHalf * 1.7} height={16} rx={6}
        fill={DARK}
      />

      {/* Left leg */}
      <Limb x1={lHipX} y1={hipY + 4} x2={lHipX - 1} y2={kneeY}    w={thighW} fill={SKIN} />
      <Limb x1={lHipX - 1} y1={kneeY} x2={lHipX}     y2={ankleY}  w={calfW}  fill={SKIN} />
      <ellipse cx={lHipX - 4} cy={footY} rx={9} ry={4.5} fill={DARK} />

      {/* Right leg */}
      <Limb x1={rHipX} y1={hipY + 4} x2={rHipX + 1} y2={kneeY}   w={thighW} fill={SKIN} />
      <Limb x1={rHipX + 1} y1={kneeY} x2={rHipX}    y2={ankleY}  w={calfW}  fill={SKIN} />
      <ellipse cx={rHipX + 4} cy={footY} rx={9} ry={4.5} fill={DARK} />
    </>
  );
}

/* ─── RUNNING POSE ─── */
function RunningPose({ accent }: { accent: string }) {
  // Mid-stride: right leg forward, left leg back, opposite arms
  const armW = 6, legW = 8;
  return (
    <>
      {/* Hair */}
      <ellipse cx={55} cy={13} rx={11} ry={8} fill={HAIR} />
      {/* Head — slightly forward */}
      <circle cx={55} cy={18} r={11} fill={SKIN} />

      {/* Torso — leaning forward */}
      <Limb x1={52} y1={30} x2={48} y2={76} w={14} fill={DARK} />

      {/* Left arm — forward swing */}
      <Limb x1={44} y1={38} x2={36} y2={56} w={armW} fill={SKIN} />
      <Limb x1={36} y1={56} x2={30} y2={70} w={5}    fill={SKIN} />

      {/* Right arm — back swing */}
      <Limb x1={56} y1={36} x2={66} y2={52} w={armW} fill={SKIN} />
      <Limb x1={66} y1={52} x2={70} y2={66} w={5}    fill={SKIN} />

      {/* Shorts */}
      <rect x={41} y={74} width={18} height={9} rx={3} fill={accent} opacity={0.8} />

      {/* Left leg — forward, bent at knee */}
      <Limb x1={46} y1={84} x2={40} y2={108} w={legW} fill={SKIN} />
      <Limb x1={40} y1={108} x2={46} y2={130} w={6}   fill={SKIN} />
      <ellipse cx={42} cy={136} rx={10} ry={5} fill={DARK} />

      {/* Right leg — pushing back */}
      <Limb x1={54} y1={82} x2={64} y2={104} w={legW} fill={SKIN} />
      <Limb x1={64} y1={104} x2={70} y2={124} w={6}   fill={SKIN} />
      <ellipse cx={68} cy={129} rx={9} ry={4} fill={DARK} />

      {/* Speed lines */}
      {[0, 1, 2].map(i => (
        <line
          key={i}
          x1={15} y1={70 + i * 12}
          x2={28} y2={70 + i * 12}
          stroke={accent} strokeWidth={1.5}
          strokeLinecap="round" opacity={0.5 - i * 0.12}
        />
      ))}
    </>
  );
}

/* ─── CYCLING POSE ─── */
function CyclingPose({ accent }: { accent: string }) {
  return (
    <>
      {/* Bike — frame */}
      {/* Rear wheel */}
      <circle cx={32} cy={148} r={22} fill="none" stroke={DARK} strokeWidth={3} />
      <circle cx={32} cy={148} r={5}  fill={DARK} />
      {/* Front wheel */}
      <circle cx={72} cy={148} r={22} fill="none" stroke={DARK} strokeWidth={3} />
      <circle cx={72} cy={148} r={5}  fill={DARK} />
      {/* Frame */}
      <line x1={32} y1={148} x2={52} y2={115} stroke={DARK} strokeWidth={2.5} />
      <line x1={52} y1={115} x2={72} y2={148} stroke={DARK} strokeWidth={2.5} />
      <line x1={52} y1={115} x2={44} y2={130} stroke={DARK} strokeWidth={2} />
      {/* Handlebar */}
      <line x1={72} y1={148} x2={76} y2={110} stroke={DARK} strokeWidth={2} />
      <line x1={73} y1={110} x2={82} y2={112} stroke={DARK} strokeWidth={2} />
      {/* Seat */}
      <line x1={44} y1={130} x2={38} y2={95} stroke={DARK} strokeWidth={2} />
      <rect x={34} y={92} width={12} height={4} rx={2} fill={MID} />
      {/* Pedals */}
      <line x1={52} y1={115} x2={44} y2={140} stroke={DARK} strokeWidth={2} />
      <line x1={52} y1={115} x2={60} y2={130} stroke={accent} strokeWidth={2} opacity={0.7} />

      {/* Rider */}
      {/* Hair */}
      <ellipse cx={72} cy={32} rx={10} ry={7} fill={HAIR} />
      {/* Head */}
      <circle cx={72} cy={38} r={10} fill={SKIN} />
      {/* Helmet */}
      <path d={`M 62 36 Q 72 22 82 36`} fill={accent} opacity={0.85} />

      {/* Torso — bent forward */}
      <Limb x1={70} y1={50} x2={50} y2={88} w={13} fill={DARK} />

      {/* Arms to handlebar */}
      <Limb x1={60} y1={55} x2={74} y2={72} w={6} fill={SKIN} />
      <Limb x1={74} y1={72} x2={80} y2={112} w={5} fill={SKIN} />

      {/* Shorts */}
      <rect x={42} y={87} width={14} height={8} rx={3} fill={accent} opacity={0.8} />

      {/* Right leg — pedaling down */}
      <Limb x1={50} y1={95} x2={58} y2={120} w={8} fill={SKIN} />
      <Limb x1={58} y1={120} x2={60} y2={140} w={6} fill={SKIN} />

      {/* Left leg — pedaling up */}
      <Limb x1={46} y1={93} x2={38} y2={110} w={8} fill={SKIN} />
      <Limb x1={38} y1={110} x2={36} y2={125} w={6} fill={SKIN} />
    </>
  );
}

/* ─── HANDSTAND POSE ─── */
function HandstandPose({ accent }: { accent: string }) {
  // Person perfectly inverted — arms straight down (= supporting), feet up
  const armW = 7, legW = 9;
  return (
    <>
      {/* Feet at top */}
      <ellipse cx={44} cy={16} rx={9} ry={4} fill={DARK} />
      <ellipse cx={56} cy={16} rx={9} ry={4} fill={DARK} />

      {/* Calves */}
      <Limb x1={44} y1={20} x2={44} y2={42} w={6}    fill={SKIN} />
      <Limb x1={56} y1={20} x2={56} y2={42} w={6}    fill={SKIN} />

      {/* Thighs */}
      <Limb x1={44} y1={42} x2={46} y2={66} w={legW} fill={SKIN} />
      <Limb x1={56} y1={42} x2={54} y2={66} w={legW} fill={SKIN} />

      {/* Shorts */}
      <rect x={41} y={65} width={18} height={8} rx={3} fill={accent} opacity={0.8} />

      {/* Torso */}
      <Limb x1={50} y1={74} x2={50} y2={118} w={15} fill={DARK} />

      {/* Core tension line */}
      <line x1={50} y1={78} x2={50} y2={115} stroke={accent} strokeWidth={0.9} opacity={0.35} />

      {/* Shoulder caps */}
      <ellipse cx={40} cy={120} rx={5} ry={4} fill={MID} />
      <ellipse cx={60} cy={120} rx={5} ry={4} fill={MID} />

      {/* Upper arms — straight down */}
      <Limb x1={40} y1={122} x2={40} y2={144} w={armW} fill={SKIN} />
      <Limb x1={60} y1={122} x2={60} y2={144} w={armW} fill={SKIN} />

      {/* Forearms */}
      <Limb x1={40} y1={144} x2={40} y2={160} w={6}    fill={SKIN} />
      <Limb x1={60} y1={144} x2={60} y2={160} w={6}    fill={SKIN} />

      {/* Hands on floor */}
      <ellipse cx={40} cy={163} rx={7} ry={4} fill={SKIN} />
      <ellipse cx={60} cy={163} rx={7} ry={4} fill={SKIN} />

      {/* Head — at bottom */}
      <circle cx={50} cy={173} r={11} fill={SKIN} />
      <ellipse cx={50} cy={179} rx={11} ry={7.5} fill={HAIR} />

      {/* Floor line */}
      <line x1={20} y1={167} x2={80} y2={167} stroke={accent} strokeWidth={1} opacity={0.4} />
    </>
  );
}

/* ─── REST POSE ─── */
function RestPose({ accent }: { accent: string }) {
  // Sitting casually, relaxed
  return (
    <>
      {/* Hair */}
      <ellipse cx={50} cy={25} rx={12} ry={9} fill={HAIR} />
      {/* Head */}
      <circle cx={50} cy={30} r={12} fill={SKIN} />

      {/* Torso — upright */}
      <Limb x1={50} y1={42} x2={50} y2={86} w={16} fill={DARK} />

      {/* Left arm — resting on knee */}
      <Limb x1={38} y1={50} x2={30} y2={74} w={7} fill={SKIN} />
      <Limb x1={30} y1={74} x2={32} y2={92} w={6} fill={SKIN} />

      {/* Right arm — resting on knee */}
      <Limb x1={62} y1={50} x2={70} y2={74} w={7} fill={SKIN} />
      <Limb x1={70} y1={74} x2={68} y2={92} w={6} fill={SKIN} />

      {/* Shorts */}
      <rect x={36} y={84} width={28} height={10} rx={4} fill={accent} opacity={0.7} />

      {/* Left leg — bent/sitting */}
      <Limb x1={42} y1={94} x2={30} y2={114} w={9}  fill={SKIN} />
      <Limb x1={30} y1={114} x2={28} y2={134} w={7} fill={SKIN} />
      <ellipse cx={24} cy={138} rx={10} ry={5} fill={DARK} />

      {/* Right leg — bent/sitting */}
      <Limb x1={58} y1={94} x2={70} y2={114} w={9}  fill={SKIN} />
      <Limb x1={70} y1={114} x2={72} y2={134} w={7} fill={SKIN} />
      <ellipse cx={76} cy={138} rx={10} ry={5} fill={DARK} />

      {/* "Zzz" rest indicator */}
      {["Z", "z", "z"].map((z, i) => (
        <text
          key={i}
          x={66 + i * 5}
          y={22 - i * 7}
          fontSize={10 - i * 2}
          fill={accent}
          opacity={0.6 - i * 0.1}
          fontWeight="bold"
        >
          {z}
        </text>
      ))}
    </>
  );
}

/* ─── Main component ─── */

export default function HumanAvatarSvg({
  pose = "stand",
  bodyLevels = DEFAULT_LEVELS,
  size = 120,
  animate = false,
  accentColor = "#FF6B35",
}: Props) {
  const poseContent = (() => {
    switch (pose) {
      case "run":       return <RunningPose  accent={accentColor} />;
      case "cycle":     return <CyclingPose  accent={accentColor} />;
      case "handstand": return <HandstandPose accent={accentColor} />;
      case "rest":      return <RestPose     accent={accentColor} />;
      default:          return <StandingPose levels={bodyLevels} accent={accentColor} />;
    }
  })();

  const svgProps = {
    width: size,
    height: size * (190 / 100),
    viewBox: "0 0 100 190",
    overflow: "visible",
  };

  if (animate) {
    return (
      <MotionSvg
        {...svgProps}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {poseContent}
      </MotionSvg>
    );
  }

  return <svg {...svgProps}>{poseContent}</svg>;
}
