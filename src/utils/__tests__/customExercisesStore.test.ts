import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCustomExercise,
  getCustomExercises,
  updateCustomExercise,
  deleteCustomExercise,
  migrateCustomExercises,
} from '../customExercisesStore';
import type { CustomExerciseInput } from '../customExercisesStore';
import { getScopedItem, setScopedItem } from '../scopedStorage';

const USER_A = 'user-a';
const USER_B = 'user-b';

function setSession(userId: string) {
  localStorage.setItem('trainq_active_session_v1', JSON.stringify({ userId }));
}

const makeInput = (overrides?: Partial<CustomExerciseInput>): CustomExerciseInput => ({
  name: 'Test Exercise',
  lang: 'de',
  primaryMuscles: ['chest'],
  equipment: ['barbell'],
  movement: 'push',
  type: 'strength',
  metrics: ['weight', 'reps'],
  ...overrides,
});

describe('customExercisesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setSession(USER_A);
  });

  // ── Original tests (adapted for scoped storage) ──

  describe('addCustomExercise', () => {
    it('creates exercise with cus_ prefixed ID', () => {
      const result = addCustomExercise(makeInput());
      expect(result.id).toMatch(/^cus_/);
    });

    it('persists to scoped localStorage', () => {
      addCustomExercise(makeInput());
      const raw = getScopedItem('trainq_custom_exercises_v1');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
    });

    it('sets source to "custom"', () => {
      const result = addCustomExercise(makeInput());
      expect(result.source).toBe('custom');
    });

    it('trims name', () => {
      const result = addCustomExercise(makeInput({ name: '  Spaced Name  ' }));
      expect(result.name).toBe('Spaced Name');
    });

    it('sets both nameDe and nameEn from input name', () => {
      const result = addCustomExercise(makeInput({ name: 'Bankdrücken', lang: 'de' }));
      expect(result.nameDe).toBe('Bankdrücken');
      expect(result.nameEn).toBe('Bankdrücken');
    });

    it('can add multiple exercises', () => {
      addCustomExercise(makeInput({ name: 'Ex 1' }));
      addCustomExercise(makeInput({ name: 'Ex 2' }));
      addCustomExercise(makeInput({ name: 'Ex 3' }));
      expect(getCustomExercises()).toHaveLength(3);
    });

    it('generates unique IDs', () => {
      const a = addCustomExercise(makeInput({ name: 'A' }));
      const b = addCustomExercise(makeInput({ name: 'B' }));
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('getCustomExercises', () => {
    it('returns empty array when no data', () => {
      expect(getCustomExercises()).toEqual([]);
    });

    it('returns all added exercises', () => {
      addCustomExercise(makeInput({ name: 'First' }));
      addCustomExercise(makeInput({ name: 'Second' }));
      const results = getCustomExercises();
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('First');
      expect(results[1].name).toBe('Second');
    });

    it('handles corrupted scoped storage gracefully', () => {
      setScopedItem('trainq_custom_exercises_v1', 'not json');
      expect(getCustomExercises()).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      setScopedItem('trainq_custom_exercises_v1', '{"foo": "bar"}');
      expect(getCustomExercises()).toEqual([]);
    });
  });

  describe('updateCustomExercise', () => {
    it('patches fields and preserves others', () => {
      const created = addCustomExercise(makeInput({ name: 'Original' }));
      const updated = updateCustomExercise(created.id, {
        primaryMuscles: ['back'],
      });
      expect(updated).toBeDefined();
      expect(updated!.primaryMuscles).toEqual(['back']);
      expect(updated!.name).toBe('Original');
    });

    it('returns undefined for nonexistent ID', () => {
      const result = updateCustomExercise('nonexistent', { primaryMuscles: ['back'] });
      expect(result).toBeUndefined();
    });

    it('persists update to storage', () => {
      const created = addCustomExercise(makeInput({ name: 'ToUpdate' }));
      updateCustomExercise(created.id, { type: 'hypertrophy' });
      const loaded = getCustomExercises();
      const found = loaded.find(e => e.id === created.id);
      expect(found!.type).toBe('hypertrophy');
    });
  });

  describe('deleteCustomExercise', () => {
    it('removes exercise from list', () => {
      const a = addCustomExercise(makeInput({ name: 'Keep' }));
      const b = addCustomExercise(makeInput({ name: 'Delete' }));
      deleteCustomExercise(b.id);
      const remaining = getCustomExercises();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(a.id);
    });

    it('does nothing for nonexistent ID', () => {
      addCustomExercise(makeInput({ name: 'Stay' }));
      deleteCustomExercise('nonexistent');
      expect(getCustomExercises()).toHaveLength(1);
    });
  });

  describe('toExercise mapping', () => {
    it('maps all fields correctly', () => {
      const result = addCustomExercise(makeInput({
        name: 'Full Test',
        primaryMuscles: ['chest', 'triceps'],
        equipment: ['barbell', 'bench'],
        movement: 'push',
        type: 'strength',
        metrics: ['weight', 'reps', 'rpe'],
      }));
      expect(result.source).toBe('custom');
      expect(result.primaryMuscles).toEqual(['chest', 'triceps']);
      expect(result.equipment).toEqual(['barbell', 'bench']);
      expect(result.movement).toBe('push');
      expect(result.type).toBe('strength');
      expect(result.metrics).toEqual(['weight', 'reps', 'rpe']);
    });
  });

  // ── NEW: User isolation tests ──

  describe('user isolation', () => {
    it('User A exercises are NOT visible to User B', () => {
      setSession(USER_A);
      addCustomExercise(makeInput({ name: 'A Exercise' }));
      expect(getCustomExercises()).toHaveLength(1);

      // Switch to User B
      setSession(USER_B);
      expect(getCustomExercises()).toHaveLength(0);
    });

    it('both users can have independent exercises', () => {
      setSession(USER_A);
      addCustomExercise(makeInput({ name: 'A1' }));
      addCustomExercise(makeInput({ name: 'A2' }));

      setSession(USER_B);
      addCustomExercise(makeInput({ name: 'B1' }));

      expect(getCustomExercises()).toHaveLength(1);
      expect(getCustomExercises()[0].name).toBe('B1');

      // Switch back to A
      setSession(USER_A);
      expect(getCustomExercises()).toHaveLength(2);
    });

    it('deleting for User A does not affect User B', () => {
      setSession(USER_A);
      const a = addCustomExercise(makeInput({ name: 'Shared Name' }));

      setSession(USER_B);
      addCustomExercise(makeInput({ name: 'Shared Name' }));

      // Delete from A
      setSession(USER_A);
      deleteCustomExercise(a.id);
      expect(getCustomExercises()).toHaveLength(0);

      // B still has it
      setSession(USER_B);
      expect(getCustomExercises()).toHaveLength(1);
    });
  });

  // ── NEW: Migration tests ──

  describe('migrateCustomExercises', () => {
    it('migrates legacy unscoped data to user-scoped key', () => {
      // Simulate legacy data (written before this fix)
      const legacyData = [
        { id: 'cus_old_1', name: { de: 'Alt 1', en: 'Old 1' }, aliases: { en: [], de: [] }, primaryMuscles: ['chest'], secondaryMuscles: [], equipment: ['barbell'], movement: 'push', type: 'strength', metrics: ['weight', 'reps'] },
      ];
      localStorage.setItem('trainq_custom_exercises_v1', JSON.stringify(legacyData));

      setSession(USER_A);
      migrateCustomExercises();

      // Legacy key removed
      expect(localStorage.getItem('trainq_custom_exercises_v1')).toBeNull();

      // Data accessible via scoped storage
      const exercises = getCustomExercises();
      expect(exercises).toHaveLength(1);
      expect(exercises[0].id).toBe('cus_old_1');
      expect(exercises[0].name).toBe('Alt 1');
    });

    it('merges legacy data with existing scoped data without duplicates', () => {
      const legacyData = [
        { id: 'cus_shared', name: { de: 'Shared', en: 'Shared' }, aliases: { en: [], de: [] }, primaryMuscles: ['chest'], secondaryMuscles: [], equipment: ['barbell'], movement: 'push', type: 'strength', metrics: ['weight', 'reps'] },
        { id: 'cus_legacy_only', name: { de: 'Legacy', en: 'Legacy' }, aliases: { en: [], de: [] }, primaryMuscles: ['back'], secondaryMuscles: [], equipment: ['cable'], movement: 'pull', type: 'strength', metrics: ['weight', 'reps'] },
      ];
      localStorage.setItem('trainq_custom_exercises_v1', JSON.stringify(legacyData));

      // User already has one exercise scoped
      setSession(USER_A);
      addCustomExercise(makeInput({ name: 'Scoped Existing' }));

      // Also put the shared ID in scoped to test dedup
      const scoped = JSON.parse(getScopedItem('trainq_custom_exercises_v1')!);
      scoped.push({ id: 'cus_shared', name: { de: 'Scoped Version', en: 'Scoped Version' }, aliases: { en: [], de: [] }, primaryMuscles: ['chest'], secondaryMuscles: [], equipment: ['barbell'], movement: 'push', type: 'strength', metrics: ['weight', 'reps'] });
      setScopedItem('trainq_custom_exercises_v1', JSON.stringify(scoped));

      migrateCustomExercises();

      const exercises = getCustomExercises();
      // Should have: Scoped Existing + cus_shared (scoped version wins) + cus_legacy_only
      expect(exercises).toHaveLength(3);
      // Scoped version of shared ID should be kept, not legacy
      const shared = exercises.find(e => e.id === 'cus_shared');
      expect(shared!.name).toBe('Scoped Version');
    });

    it('does nothing when no legacy data exists', () => {
      setSession(USER_A);
      addCustomExercise(makeInput({ name: 'Existing' }));
      migrateCustomExercises();
      expect(getCustomExercises()).toHaveLength(1);
    });

    it('cleans up empty legacy key', () => {
      localStorage.setItem('trainq_custom_exercises_v1', '[]');
      migrateCustomExercises();
      expect(localStorage.getItem('trainq_custom_exercises_v1')).toBeNull();
    });
  });

  // ── NEW: Persistence across logout/login ──

  describe('persistence across logout/login', () => {
    it('exercises survive session change and return', () => {
      setSession(USER_A);
      addCustomExercise(makeInput({ name: 'Persistent' }));

      // Simulate logout — session cleared
      localStorage.removeItem('trainq_active_session_v1');

      // Simulate login as same user
      setSession(USER_A);
      const exercises = getCustomExercises();
      expect(exercises).toHaveLength(1);
      expect(exercises[0].name).toBe('Persistent');
    });
  });
});
