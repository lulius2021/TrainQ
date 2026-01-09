// src/pages/CommunityInboxPage.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  addGroupMember,
  addThreadMember,
  createChallenge,
  createGroup,
  createThread,
  ensureParticipant,
  listChallenges,
  listGroups,
  listMessages,
  listParticipants,
  listThreads,
  sendMessage,
  setParticipantProgress,
  syncWorkoutsCountFromHistory,
  type GroupChallenge,
  type InboxGroup,
  type InboxThread,
} from "../services/communityInboxService";

type InboxTab = "chats" | "groups" | "challenges";

function navigate(path: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path } }));
}

const surfaceCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
};

const surfaceSoft: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
};

export default function CommunityInboxPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [tab, setTab] = useState<InboxTab>("chats");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeChallengeGroupId, setActiveChallengeGroupId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");

  const threads = useMemo(() => (userId ? listThreads(userId) : []), [userId, tab, activeThreadId]);
  const groups = useMemo(() => (userId ? listGroups(userId) : []), [userId, tab, activeGroupId]);
  const challenges = useMemo(
    () => (userId ? listChallenges(userId, activeChallengeGroupId || undefined) : []),
    [userId, tab, activeChallengeGroupId]
  );

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;

  return (
    <div className="w-full pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Community
          </div>
          <div className="text-[18px] font-semibold" style={{ color: "var(--text)" }}>
            Inbox
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/community")}
          className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
          style={surfaceSoft}
        >
          Zurück
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {(["chats", "groups", "challenges"] as InboxTab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="rounded-full px-3 py-1.5"
            style={tab === k ? { background: "var(--primary)", color: "#061226" } : surfaceSoft}
          >
            {k === "chats" ? "Chats" : k === "groups" ? "Gruppen" : "Challenges"}
          </button>
        ))}
      </div>

      {tab === "chats" && (
        <div className="space-y-3">
          {!activeThread && (
            <div className="flex items-center justify-between">
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Direktnachrichten & Gruppen‑Chats
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!userId) return;
                  const name = window.prompt("Chat Name");
                  if (!name) return;
                  const thread = createThread(userId, name);
                  setActiveThreadId(thread.id);
                }}
                className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                style={surfaceSoft}
              >
                Anlegen
              </button>
            </div>
          )}

          {!activeThread && (
            <div className="space-y-2">
              {threads.length === 0 && (
                <div className="rounded-2xl p-3 text-[12px]" style={surfaceCard}>
                  <div style={{ color: "var(--muted)" }}>Noch keine Chats. Erstelle einen neuen Chat.</div>
                </div>
              )}
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveThreadId(t.id)}
                  className="w-full text-left rounded-2xl p-3 hover:opacity-95"
                  style={surfaceCard}
                >
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {t.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Mitglieder: {t.memberIds.length}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeThread && (
            <div className="rounded-2xl p-3 space-y-3" style={surfaceCard}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                    Thread
                  </div>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                    {activeThread.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(null)}
                    className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                    style={surfaceSoft}
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!userId) return;
                      const memberId = window.prompt("User ID einladen");
                      if (!memberId) return;
                      addThreadMember(userId, activeThread.id, memberId.trim());
                    }}
                    className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                    style={surfaceSoft}
                  >
                    Invite
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {listMessages(userId, activeThread.id).map((m) => (
                  <div key={m.id} className="rounded-xl p-2" style={surfaceSoft}>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {m.authorId}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--text)" }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {listMessages(userId, activeThread.id).length === 0 && (
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Noch keine Nachrichten.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-[12px]"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="Nachricht"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!userId) return;
                    sendMessage(userId, activeThread.id, draftMessage);
                    setDraftMessage("");
                  }}
                  className="rounded-full px-3 py-2 text-[12px] hover:opacity-95"
                  style={surfaceSoft}
                >
                  Senden
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "groups" && (
        <div className="space-y-3">
          {!activeGroup && (
            <div className="flex items-center justify-between">
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Gruppen & Mitglieder
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!userId) return;
                  const name = window.prompt("Gruppenname");
                  if (!name) return;
                  const group = createGroup(userId, name);
                  setActiveGroupId(group.id);
                }}
                className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                style={surfaceSoft}
              >
                Anlegen
              </button>
            </div>
          )}

          {!activeGroup && (
            <div className="space-y-2">
              {groups.length === 0 && (
                <div className="rounded-2xl p-3 text-[12px]" style={surfaceCard}>
                  <div style={{ color: "var(--muted)" }}>Noch keine Gruppen. Erstelle eine Gruppe.</div>
                </div>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroupId(g.id)}
                  className="w-full text-left rounded-2xl p-3 hover:opacity-95"
                  style={surfaceCard}
                >
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {g.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Mitglieder: {g.memberIds.length}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeGroup && (
            <GroupDetail
              userId={userId}
              group={activeGroup}
              onBack={() => setActiveGroupId(null)}
            />
          )}
        </div>
      )}

      {tab === "challenges" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              Gruppen‑Challenges (Workouts Count)
            </div>
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                const groupId = activeChallengeGroupId || groups[0]?.id;
                if (!groupId) {
                  alert("Erstelle zuerst eine Gruppe.");
                  return;
                }
                const name = window.prompt("Challenge Name");
                if (!name) return;
                createChallenge(userId, groupId, name);
              }}
              className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
              style={surfaceSoft}
            >
              Anlegen
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveChallengeGroupId(g.id)}
                className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                style={activeChallengeGroupId === g.id ? { background: "var(--primary)", color: "#061226" } : surfaceSoft}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {challenges.length === 0 && (
              <div className="rounded-2xl p-3 text-[12px]" style={surfaceCard}>
                <div style={{ color: "var(--muted)" }}>Noch keine Challenges.</div>
              </div>
            )}
            {challenges.map((c) => (
              <ChallengeCard key={c.id} userId={userId} challenge={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupDetail({
  userId,
  group,
  onBack,
}: {
  userId: string;
  group: InboxGroup;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl p-3 space-y-3" style={surfaceCard}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Gruppe
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            {group.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-full px-3 py-1 text-[11px] hover:opacity-95" style={surfaceSoft}>
            Zurück
          </button>
          <button
            type="button"
            onClick={() => {
              if (!userId) return;
              const memberId = window.prompt("User ID einladen");
              if (!memberId) return;
              addGroupMember(userId, group.id, memberId.trim());
            }}
            className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
            style={surfaceSoft}
          >
            Invite
          </button>
        </div>
      </div>

      <div className="text-[12px]" style={{ color: "var(--muted)" }}>
        Mitglieder: {group.memberIds.join(", ")}
      </div>

      <div className="rounded-xl p-3 text-[12px]" style={surfaceSoft}>
        Gruppen‑Feed (coming soon)
      </div>
    </div>
  );
}

function ChallengeCard({ userId, challenge }: { userId: string; challenge: GroupChallenge }) {
  const participants = listParticipants(userId, challenge.id);
  const me = ensureParticipant(userId, challenge.id);
  const leaderboard = [...participants, me]
    .filter((p, idx, arr) => arr.findIndex((x) => x.userId === p.userId) === idx)
    .sort((a, b) => b.workoutsCount - a.workoutsCount);

  return (
    <div className="rounded-2xl p-3 space-y-3" style={surfaceCard}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Challenge
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            {challenge.name}
          </div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {challenge.startDate} → {challenge.endDate}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const count = syncWorkoutsCountFromHistory(userId, challenge);
            setParticipantProgress(userId, challenge.id, count);
          }}
          className="rounded-full px-3 py-1 text-[11px] hover:opacity-95"
          style={surfaceSoft}
        >
          Sync
        </button>
      </div>

      <div className="text-[12px]" style={{ color: "var(--muted)" }}>
        Meine Workouts: {me.workoutsCount}
      </div>

      <div className="space-y-2">
        {leaderboard.map((p) => (
          <div key={p.userId} className="flex items-center justify-between text-[12px]" style={surfaceSoft}>
            <span style={{ color: "var(--text)" }}>{p.userId}</span>
            <span style={{ color: "var(--muted)" }}>{p.workoutsCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
