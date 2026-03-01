import React, { useEffect, useMemo, useRef } from "react";
import type { StoryTemplateId, StoryTemplateDef, WorkoutShareModel } from "../../utils/share/renderStoryExport";
import StoryExportCanvas from "./StoryExportCanvas";

type Props = {
  templates: Array<StoryTemplateDef & { label: string }>;
  activeId: StoryTemplateId;
  onChange: (id: StoryTemplateId) => void;
  locale: "de" | "en";
  model: WorkoutShareModel;
  stickerLabel: string;
};

const CARD_W = 270;
const CARD_H = 480;
const GAP = 16;

export default function StoryExportPicker({ templates, activeId, onChange, locale, model, stickerLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<Map<StoryTemplateId, HTMLDivElement>>(new Map());
  const activeIndex = useMemo(
    () => Math.max(0, templates.findIndex((t) => t.id === activeId)),
    [templates, activeId]
  );

  useEffect(() => {
    const node = cardsRef.current.get(activeId);
    if (node) node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const raw = el.scrollLeft / (CARD_W + GAP);
        const idx = Math.round(raw);
        const next = templates[idx];
        if (next && next.id !== activeId) onChange(next.id);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [templates, activeId, onChange]);

  return (
    <div>
      <div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {templates.map((tpl, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={tpl.id}
              ref={(node) => {
                if (!node) return;
                cardsRef.current.set(tpl.id, node);
              }}
              className={`shrink-0 rounded-2xl border p-3 transition-transform ${isActive ? "scale-[1.02]" : "scale-[0.98]"}`}
              style={{
                width: CARD_W,
                borderColor: isActive ? "rgba(37,99,235,0.7)" : "var(--border-color)",
                background: "var(--button-bg)",
                scrollSnapAlign: "center",
              }}
              onClick={() => onChange(tpl.id)}
            >
              <div
                className="rounded-3xl overflow-hidden"
                style={{ width: CARD_W - 24, height: CARD_H - 60, background: "rgba(2,6,23,0.9)" }}
              >
                <div
                  style={{
                    width: 1080,
                    height: 1920,
                    transform: `scale(${(CARD_W - 24) / 1080})`,
                    transformOrigin: "top left",
                  }}
                >
                  {tpl.mode === "full" ? (
                    <StoryExportCanvas>
                      <tpl.Component model={model} locale={locale} />
                    </StoryExportCanvas>
                  ) : (
                    <div
                      style={{
                        width: 1080,
                        height: 1920,
                        position: "relative",
                        background: "transparent",
                        color: "#0f172a",
                        fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
                      }}
                    >
                      <tpl.Component model={model} locale={locale} />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {tpl.label}
                </div>
                {tpl.mode === "sticker" && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "rgba(148,163,184,0.2)", color: "var(--text-muted)" }}
                  >
                    {stickerLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1">
        {templates.map((tpl, idx) => (
          <span
            key={tpl.id}
            className="h-1.5 w-4 rounded-full"
            style={{ background: idx === activeIndex ? "var(--accent-color)" : "rgba(148,163,184,0.3)" }}
          />
        ))}
      </div>
    </div>
  );
}
