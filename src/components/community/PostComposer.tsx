import React, { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import { createPost } from "../../services/community/api";
import type { PostType, Visibility } from "../../services/community/types";
import { DEFAULT_VISIBILITY, POST_TYPE_LABELS, VISIBILITY_LABELS } from "../../services/community/types";

interface Props {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function PostComposer({ userId, onClose, onCreated }: Props) {
  const [postType, setPostType] = useState<PostType>("text_post");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY.text_post);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = text.trim().length > 0 && text.length <= 1000;

  const handleTypeChange = (type: PostType) => {
    setPostType(type);
    setVisibility(DEFAULT_VISIBILITY[type]);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost(userId, { type: postType, text: text.trim(), visibility });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Posten");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--bg-color)" }} data-overlay-open="true">
      {/* Header */}
      <div className="pt-safe">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <button onClick={onClose} className="p-1" style={{ color: "var(--text-color)" }}>
          <X size={24} />
        </button>
        <span className="font-semibold" style={{ color: "var(--text-color)" }}>Neuer Beitrag</span>
        <AppButton onClick={handleSubmit} variant="primary" size="sm" disabled={!isValid || submitting} isLoading={submitting}>
          Posten
        </AppButton>
      </div>
      </div>

      {/* Post type picker */}
      <div className="flex gap-2 px-4 pt-3">
        {(["text_post", "workout_share", "progress_update"] as PostType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${postType === type ? "text-white" : ""}`}
            style={{
              background: postType === type ? "var(--accent-color)" : "var(--border-color)",
              color: postType === type ? "#fff" : "var(--text-secondary)",
            }}
          >
            {POST_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Visibility selector */}
      <div className="px-4 pt-2 relative">
        <button
          onClick={() => setShowVisMenu(!showVisMenu)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
          style={{ background: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          {VISIBILITY_LABELS[visibility]} <ChevronDown size={12} />
        </button>
        {showVisMenu && (
          <div className="absolute left-4 top-full mt-1 z-10 rounded-xl border shadow-lg p-1" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
            {(["public", "followers", "private"] as Visibility[]).map((v) => (
              <button
                key={v}
                onClick={() => { setVisibility(v); setShowVisMenu(false); }}
                className="block w-full text-left px-3 py-2 text-sm rounded-lg"
                style={{ color: visibility === v ? "var(--accent-color)" : "var(--text-color)" }}
              >
                {VISIBILITY_LABELS[v]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text area */}
      <div className="flex-1 px-4 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Was hast du trainiert?"
          maxLength={1000}
          className="w-full h-48 resize-none bg-transparent text-base outline-none"
          style={{ color: "var(--text-color)" }}
          autoFocus
        />
        <div className="text-xs text-right" style={{ color: text.length > 950 ? "#E63946" : "var(--text-secondary)" }}>
          {text.length}/1000
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
