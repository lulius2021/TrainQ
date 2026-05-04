import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  scopedKey,
  getScopedItem,
  setScopedItem,
  removeScopedItem,
  migrateLegacyKey,
  migrateUserStorage,
  clearUserScopedData,
} from "../scopedStorage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_A = "test-user-123";
const USER_B = "other-user-456";
const SESSION_KEY = "trainq_active_session_v1";

function setSession(userId: string, isPro = false) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ userId, isPro }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scopedStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    setSession(USER_A);
  });

  // -----------------------------------------------------------------------
  // scopedKey
  // -----------------------------------------------------------------------
  describe("scopedKey", () => {
    it("returns base::userId when a session exists", () => {
      expect(scopedKey("trainq_theme_v1")).toBe(
        `trainq_theme_v1::${USER_A}`,
      );
    });

    it("uses an explicit userId over the session userId", () => {
      expect(scopedKey("trainq_theme_v1", USER_B)).toBe(
        `trainq_theme_v1::${USER_B}`,
      );
    });

    it("returns the bare baseKey when no user is available", () => {
      localStorage.clear(); // no session
      expect(scopedKey("trainq_theme_v1")).toBe("trainq_theme_v1");
    });

    it("different users produce different scoped keys", () => {
      const keyA = scopedKey("trainq_units", USER_A);
      const keyB = scopedKey("trainq_units", USER_B);
      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain(USER_A);
      expect(keyB).toContain(USER_B);
    });

    it("returns empty string for empty baseKey", () => {
      expect(scopedKey("", USER_A)).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // setScopedItem + getScopedItem  (round-trip)
  // -----------------------------------------------------------------------
  describe("setScopedItem / getScopedItem", () => {
    it("round-trips a simple string value", () => {
      setScopedItem("trainq_theme_v1", "dark");
      expect(getScopedItem("trainq_theme_v1")).toBe("dark");
    });

    it("round-trips a JSON value", () => {
      const payload = JSON.stringify({ kg: true });
      setScopedItem("trainq_units", payload);
      expect(getScopedItem("trainq_units")).toBe(payload);
    });

    it("stores an empty string without losing it", () => {
      setScopedItem("trainq_language", "");
      expect(getScopedItem("trainq_language")).toBe("");
    });

    it("returns null for a key that was never set", () => {
      expect(getScopedItem("trainq_nonexistent_key")).toBeNull();
    });

    it("isolates data between users", () => {
      setScopedItem("trainq_theme_v1", "dark", USER_A);
      setScopedItem("trainq_theme_v1", "light", USER_B);

      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("dark");
      expect(getScopedItem("trainq_theme_v1", USER_B)).toBe("light");
    });
  });

  // -----------------------------------------------------------------------
  // removeScopedItem
  // -----------------------------------------------------------------------
  describe("removeScopedItem", () => {
    it("removes a previously set value", () => {
      setScopedItem("trainq_theme_v1", "dark");
      removeScopedItem("trainq_theme_v1");
      expect(getScopedItem("trainq_theme_v1")).toBeNull();
    });

    it("does not throw when removing a non-existent key", () => {
      expect(() => removeScopedItem("trainq_no_such_key")).not.toThrow();
    });

    it("only removes the targeted user's data", () => {
      setScopedItem("trainq_units", "kg", USER_A);
      setScopedItem("trainq_units", "lbs", USER_B);

      removeScopedItem("trainq_units", USER_A);

      expect(getScopedItem("trainq_units", USER_A)).toBeNull();
      expect(getScopedItem("trainq_units", USER_B)).toBe("lbs");
    });
  });

  // -----------------------------------------------------------------------
  // migrateLegacyKey
  // -----------------------------------------------------------------------
  describe("migrateLegacyKey", () => {
    it("moves a legacy (unscoped) value to the scoped key", () => {
      localStorage.setItem("trainq_theme_v1", "dark");

      migrateLegacyKey("trainq_theme_v1", USER_A);

      // scoped key now holds the value
      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("dark");
      // legacy key is removed
      expect(localStorage.getItem("trainq_theme_v1")).toBeNull();
    });

    it("does NOT overwrite an existing scoped value", () => {
      setScopedItem("trainq_theme_v1", "light", USER_A);
      localStorage.setItem("trainq_theme_v1", "dark");

      migrateLegacyKey("trainq_theme_v1", USER_A);

      // scoped key keeps the original value
      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("light");
      // legacy key is still present (was not consumed)
      expect(localStorage.getItem("trainq_theme_v1")).toBe("dark");
    });

    it("does nothing when there is no legacy value", () => {
      migrateLegacyKey("trainq_theme_v1", USER_A);
      expect(getScopedItem("trainq_theme_v1", USER_A)).toBeNull();
    });

    it("does nothing when no userId is available", () => {
      localStorage.clear(); // no session
      localStorage.setItem("trainq_theme_v1", "dark");

      migrateLegacyKey("trainq_theme_v1"); // no explicit userId, no session

      // legacy key untouched
      expect(localStorage.getItem("trainq_theme_v1")).toBe("dark");
    });

    it("uses the session userId when none is passed explicitly", () => {
      localStorage.setItem("trainq_units", "kg");
      // USER_A session is already set in beforeEach
      migrateLegacyKey("trainq_units");

      expect(getScopedItem("trainq_units", USER_A)).toBe("kg");
      expect(localStorage.getItem("trainq_units")).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // migrateUserStorage
  // -----------------------------------------------------------------------
  describe("migrateUserStorage", () => {
    it("migrates all known legacy keys for the given user", () => {
      localStorage.setItem("trainq_theme_v1", "dark");
      localStorage.setItem("trainq_language", "de");

      migrateUserStorage(USER_A);

      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("dark");
      expect(getScopedItem("trainq_language", USER_A)).toBe("de");

      // legacy keys removed (only if scoped key didn't exist before)
      expect(localStorage.getItem("trainq_theme_v1")).toBeNull();
      expect(localStorage.getItem("trainq_language")).toBeNull();
    });

    it("leaves keys that are not in the migration list alone", () => {
      localStorage.setItem("some_other_app_key", "hello");

      migrateUserStorage(USER_A);

      expect(localStorage.getItem("some_other_app_key")).toBe("hello");
    });
  });

  // -----------------------------------------------------------------------
  // clearUserScopedData
  // -----------------------------------------------------------------------
  describe("clearUserScopedData", () => {
    it("removes all known scoped keys for the given user", () => {
      setScopedItem("trainq_theme_v1", "dark", USER_A);
      setScopedItem("trainq_language", "de", USER_A);
      setScopedItem("trainq_units", "kg", USER_A);

      clearUserScopedData(USER_A);

      expect(getScopedItem("trainq_theme_v1", USER_A)).toBeNull();
      expect(getScopedItem("trainq_language", USER_A)).toBeNull();
      expect(getScopedItem("trainq_units", USER_A)).toBeNull();
    });

    it("does not affect another user's data", () => {
      setScopedItem("trainq_theme_v1", "dark", USER_A);
      setScopedItem("trainq_theme_v1", "light", USER_B);

      clearUserScopedData(USER_A);

      expect(getScopedItem("trainq_theme_v1", USER_A)).toBeNull();
      expect(getScopedItem("trainq_theme_v1", USER_B)).toBe("light");
    });
  });

  // -----------------------------------------------------------------------
  // SSR safety (no window / no localStorage)
  // -----------------------------------------------------------------------
  describe("SSR safety", () => {
    it("getScopedItem returns null when window is undefined", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error -- intentionally removing window for SSR test
      delete globalThis.window;

      expect(getScopedItem("trainq_theme_v1")).toBeNull();

      globalThis.window = origWindow;
    });

    it("setScopedItem does not throw when window is undefined", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error -- intentionally removing window for SSR test
      delete globalThis.window;

      expect(() => setScopedItem("trainq_theme_v1", "dark")).not.toThrow();

      globalThis.window = origWindow;
    });

    it("removeScopedItem does not throw when window is undefined", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error -- intentionally removing window for SSR test
      delete globalThis.window;

      expect(() => removeScopedItem("trainq_theme_v1")).not.toThrow();

      globalThis.window = origWindow;
    });

    it("migrateLegacyKey does not throw when window is undefined", () => {
      const origWindow = globalThis.window;
      // @ts-expect-error -- intentionally removing window for SSR test
      delete globalThis.window;

      expect(() => migrateLegacyKey("trainq_theme_v1", USER_A)).not.toThrow();

      globalThis.window = origWindow;
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles null userId gracefully (falls back to session)", () => {
      setScopedItem("trainq_theme_v1", "dark", null);
      // should use session user (USER_A)
      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("dark");
    });

    it("handles undefined userId gracefully (falls back to session)", () => {
      setScopedItem("trainq_theme_v1", "dark", undefined);
      expect(getScopedItem("trainq_theme_v1", USER_A)).toBe("dark");
    });

    it("stores and retrieves values with special characters", () => {
      const value = '{"emoji":"\\ud83d\\ude00","html":"<b>bold</b>"}';
      setScopedItem("trainq_custom_foods_v1", value, USER_A);
      expect(getScopedItem("trainq_custom_foods_v1", USER_A)).toBe(value);
    });

    it("handles very long values", () => {
      const longValue = "x".repeat(10_000);
      setScopedItem("trainq_workout_history_v1", longValue, USER_A);
      expect(getScopedItem("trainq_workout_history_v1", USER_A)).toBe(longValue);
    });
  });
});
