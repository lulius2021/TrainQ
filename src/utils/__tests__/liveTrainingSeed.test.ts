import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeGlobalLiveSeed,
  readGlobalLiveSeed,
  clearGlobalLiveSeed,
  writeLiveSeedForEvent,
  readLiveSeedForEvent,
  deleteLiveSeedForEvent,
  writeLiveSeedForKey,
  readLiveSeedForKey,
  makeSeedKey,
  resolveLiveSeed,
  writeLiveSeedForEventOrKey,
  type LiveTrainingSeed,
} from '../liveTrainingSeed';

// Set up scoped storage session
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('trainq_active_session_v1', JSON.stringify({ userId: 'test-user-seed' }));
});

const makeSeed = (overrides?: Partial<LiveTrainingSeed>): LiveTrainingSeed => ({
  title: 'Push Day',
  sport: 'Gym',
  isCardio: false,
  exercises: [
    { name: 'Bench Press', sets: [{ reps: 10, weight: 80 }] },
  ],
  ...overrides,
});

describe('liveTrainingSeed', () => {
  describe('global seed', () => {
    it('write + read round-trip', () => {
      const seed = makeSeed();
      writeGlobalLiveSeed(seed);
      const loaded = readGlobalLiveSeed();
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('Push Day');
      expect(loaded!.sport).toBe('Gym');
      expect(loaded!.exercises).toHaveLength(1);
    });

    it('clear removes seed', () => {
      writeGlobalLiveSeed(makeSeed());
      clearGlobalLiveSeed();
      expect(readGlobalLiveSeed()).toBeNull();
    });

    it('returns null when no seed', () => {
      expect(readGlobalLiveSeed()).toBeNull();
    });
  });

  describe('seed by eventId', () => {
    it('write + read + delete', () => {
      const seed = makeSeed({ title: 'Event Training' });
      writeLiveSeedForEvent('evt-1', seed);
      const loaded = readLiveSeedForEvent('evt-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('Event Training');

      deleteLiveSeedForEvent('evt-1');
      expect(readLiveSeedForEvent('evt-1')).toBeNull();
    });

    it('different events are independent', () => {
      writeLiveSeedForEvent('evt-a', makeSeed({ title: 'A' }));
      writeLiveSeedForEvent('evt-b', makeSeed({ title: 'B' }));
      expect(readLiveSeedForEvent('evt-a')!.title).toBe('A');
      expect(readLiveSeedForEvent('evt-b')!.title).toBe('B');
    });

    it('returns null for unknown eventId', () => {
      expect(readLiveSeedForEvent('unknown')).toBeNull();
    });
  });

  describe('seed by key', () => {
    it('makeSeedKey produces date|title format', () => {
      const key = makeSeedKey('2025-03-15', 'Push Day');
      expect(key).toBe('2025-03-15|Push Day');
    });

    it('makeSeedKey trims whitespace', () => {
      const key = makeSeedKey('2025-03-15', '  Push  Day  ');
      expect(key).toBe('2025-03-15|Push Day');
    });

    it('write + read by key', () => {
      const key = makeSeedKey('2025-03-15', 'Pull Day');
      writeLiveSeedForKey(key, makeSeed({ title: 'Pull Day' }));
      const loaded = readLiveSeedForKey(key);
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('Pull Day');
    });
  });

  describe('resolveLiveSeed', () => {
    it('eventId match wins over key', () => {
      writeLiveSeedForEvent('evt-1', makeSeed({ title: 'From Event' }));
      const key = makeSeedKey('2025-03-15', 'From Key');
      writeLiveSeedForKey(key, makeSeed({ title: 'From Key' }));

      const result = resolveLiveSeed({ eventId: 'evt-1', dateISO: '2025-03-15', title: 'From Key' });
      expect(result!.title).toBe('From Event');
    });

    it('falls back to key if no eventId match', () => {
      const key = makeSeedKey('2025-03-15', 'Leg Day');
      writeLiveSeedForKey(key, makeSeed({ title: 'Leg Day' }));

      const result = resolveLiveSeed({ dateISO: '2025-03-15', title: 'Leg Day' });
      expect(result!.title).toBe('Leg Day');
    });

    it('returns null when nothing matches', () => {
      expect(resolveLiveSeed({ eventId: 'nope' })).toBeNull();
    });
  });

  describe('writeLiveSeedForEventOrKey', () => {
    it('writes to all locations', () => {
      writeLiveSeedForEventOrKey({
        eventId: 'evt-x',
        dateISO: '2025-04-01',
        title: 'Full Write',
        seed: makeSeed({ title: 'Full Write' }),
      });

      expect(readLiveSeedForEvent('evt-x')!.title).toBe('Full Write');
      const key = makeSeedKey('2025-04-01', 'Full Write');
      expect(readLiveSeedForKey(key)!.title).toBe('Full Write');
    });
  });

  describe('normalization', () => {
    it('normalizes sport "run" to "Laufen"', () => {
      writeGlobalLiveSeed({ title: 'Run', sport: 'run' as any, isCardio: true, exercises: [] });
      const loaded = readGlobalLiveSeed();
      expect(loaded!.sport).toBe('Laufen');
    });

    it('normalizes sport "bike" to "Radfahren"', () => {
      writeGlobalLiveSeed({ title: 'Ride', sport: 'bike' as any, isCardio: true, exercises: [] });
      const loaded = readGlobalLiveSeed();
      expect(loaded!.sport).toBe('Radfahren');
    });

    it('normalizes empty sport to "Gym"', () => {
      writeGlobalLiveSeed({ title: 'Default', sport: '' as any, isCardio: false, exercises: [] });
      const loaded = readGlobalLiveSeed();
      expect(loaded!.sport).toBe('Gym');
    });

    it('trims and compresses title whitespace', () => {
      writeGlobalLiveSeed({ title: '  Push  Day  ', sport: 'Gym', isCardio: false, exercises: [] });
      const loaded = readGlobalLiveSeed();
      expect(loaded!.title).toBe('Push Day');
    });
  });
});
