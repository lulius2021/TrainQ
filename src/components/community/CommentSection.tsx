import React, { useState, useCallback, useEffect } from "react";
import { Send, Trash2 } from "lucide-react";
import { getComments, createComment, deleteComment } from "../../services/community/api";
import type { CommunityComment } from "../../services/community/types";

interface Props {
  postId: string;
  viewerId: string;
  onCommentCountChanged?: (delta: number) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function CommentSection({ postId, viewerId, onCommentCountChanged }: Props) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getComments(postId);
      setComments(result);
    } catch (e) {
      console.error("Comments load error:", e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const comment = await createComment(postId, viewerId, trimmed);
      setComments((prev) => [...prev, comment]);
      setText("");
      onCommentCountChanged?.(1);
    } catch (e) {
      console.error("Comment create error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c));
      onCommentCountChanged?.(-1);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {loading && comments.length === 0 && (
          <div className="p-4 text-center text-sm" style={{ color: "var(--text-secondary)" }}>Lade Kommentare...</div>
        )}
        {!loading && comments.length === 0 && (
          <div className="p-4 text-center text-sm" style={{ color: "var(--text-secondary)" }}>Noch keine Kommentare</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="px-4 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
              {c.author?.avatarUrl ? (
                <img src={c.author.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">{(c.author?.displayName ?? "?")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs" style={{ color: "var(--text-color)" }}>{c.author?.displayName ?? "Unbekannt"}</span>
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{timeAgo(c.createdAt)}</span>
              </div>
              {c.deletedAt ? (
                <p className="text-xs italic mt-0.5" style={{ color: "var(--text-secondary)" }}>Kommentar gelöscht</p>
              ) : (
                <p className="text-sm mt-0.5 whitespace-pre-wrap break-words" style={{ color: "var(--text-color)" }}>{c.text}</p>
              )}
            </div>
            {c.authorId === viewerId && !c.deletedAt && (
              <button onClick={() => handleDelete(c.id)} className="p-1 self-start" style={{ color: "var(--text-secondary)" }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border-color)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Kommentar schreiben..."
          maxLength={500}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-color)" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="p-2 rounded-full disabled:opacity-40"
          style={{ color: "var(--accent-color)" }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
