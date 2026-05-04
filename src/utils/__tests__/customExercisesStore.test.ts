import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCustomExercise,
  getCustomExercises,
  updateCustomExercise,
  deleteCustomExercise,
} from '../customExercisesStore';
import type { CustomExerciseInput } from '../customExercisesStore';

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
  });

  describe('addCustomExercise', () => {
    it('creates exercise with cus_ prefixed ID', () => {
      const result = addCustomExercise(makeInput());
      expect(result.id).toMatch(/^cus_/);
    });

    it('persists to localStorage', () => {
      addCustomExercise(makeInput());
      const raw = localStorage.getItem('trainq_custom_exercises_v1');
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

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('trainq_custom_exercises_v1', 'not json');
      expect(getCustomExercises()).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      localStorage.setItem('trainq_custom_exercises_v1', '{"foo": "bar"}');
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
      expect(updated!.name).toBe('Original'); // preserved
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
});
