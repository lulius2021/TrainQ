import React from "react";

export default function CommunityInboxPage() {
  const navigateBack = () => {
    window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/community" } }));
  };

  return (
    <div className="min-h-screen text-white pb-20">
      <div className="sticky top-0 z-10 mx-auto max-w-2xl bg-space-blue/80 backdrop-blur-xl rounded-b-3xl border-b border-white/10 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={navigateBack}
            className="p-3 text-gray-300 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white"
          >
            Zurück
          </button>
          <h1 className="text-lg font-bold">Inbox</h1>
          <div className="w-12" aria-hidden="true" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl p-6 text-gray-400">
        Noch keine Nachrichten.
      </div>
    </div>
  );
}
