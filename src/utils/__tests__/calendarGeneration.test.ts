import { describe, it, expect } from 'vitest';
import {
  toISODateLocal,
  parseISODateLocal,
  weekdayIndexMondayFirst,
  generateCalendarWorkouts,
  buildDateSet,
} from '../calendarGeneration';
import type { TrainingPlan, CalendarWorkout, WeekdayIndex } from '../../types';

const makePlan = (overrides?: Partial<TrainingPlan>): TrainingPlan => ({
  id: 'plan-1',
  title: 'Push/Pull/Legs',
  isActive: true,
  weeklyRules: [
    { weekday: 0 as WeekdayIndex, workoutType: 'Push' },   // Monday
    { weekday: 2 as WeekdayIndex, workoutType: 'Pull' },   // Wednesday
    { weekday: 4 as WeekdayIndex, workoutType: 'Legs' },   // Friday
  ],
  ...overrides,
} as TrainingPlan);

describe('calendarGeneration', () => {
  describe('toISODateLocal', () => {
    it('formats date as YYYY-MM-DD', () => {
      const d = new Date(2025, 2, 15); // March 15
      expect(toISODateLocal(d)).toBe('2025-03-15');
    });

    it('pads single-digit month/day', () => {
      const d = new Date(2025, 0, 5); // Jan 5
      expect(toISODateLocal(d)).toBe('2025-01-05');
    });
  });

  describe('parseISODateLocal', () => {
    it('parses YYYY-MM-DD as local date', () => {
      const d = parseISODateLocal('2025-03-15');
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(2); // March = 2
      expect(d.getDate()).toBe(15);
    });

    it('round-trips with toISODateLocal', () => {
      const original = '2025-12-31';
      const parsed = parseISODateLocal(original);
      expect(toISODateLocal(parsed)).toBe(original);
    });
  });

  describe('weekdayIndexMondayFirst', () => {
    it('Monday = 0', () => {
      const mon = new Date(2025, 2, 17); // March 17, 2025 = Monday
      expect(weekdayIndexMondayFirst(mon)).toBe(0);
    });

    it('Sunday = 6', () => {
      const sun = new Date(2025, 2, 16); // March 16, 2025 = Sunday
      expect(weekdayIndexMondayFirst(sun)).toBe(6);
    });

    it('Wednesday = 2', () => {
      const wed = new Date(2025, 2, 19); // March 19, 2025 = Wednesday
      expect(weekdayIndexMondayFirst(wed)).toBe(2);
    });
  });

  describe('generateCalendarWorkouts', () => {
    it('generates workouts for matching weekdays', () => {
      const plan = makePlan();
      // Start from Monday March 17, 2025 for 7 days
      const result = generateCalendarWorkouts(plan, [], { fromDate: '2025-03-17', days: 7 });
      expect(result.created).toHaveLength(3); // Mon, Wed, Fri
      expect(result.created[0].workoutType).toBe('Push');
      expect(result.created[0].date).toBe('2025-03-17');
      expect(result.created[1].workoutType).toBe('Pull');
      expect(result.created[1].date).toBe('2025-03-19');
      expect(result.created[2].workoutType).toBe('Legs');
      expect(result.created[2].date).toBe('2025-03-21');
    });

    it('inactive plan produces empty result', () => {
      const plan = makePlan({ isActive: false });
      const result = generateCalendarWorkouts(plan, [], { fromDate: '2025-03-17', days: 7 });
      expect(result.created).toHaveLength(0);
    });

    it('skips dates with existing workouts', () => {
      const plan = makePlan();
      const existing: CalendarWorkout[] = [
        { id: 'w-1', date: '2025-03-17', workoutType: 'Push', sourcePlanId: 'plan-1', status: 'completed' } as CalendarWorkout,
      ];
      const result = generateCalendarWorkouts(plan, existing, { fromDate: '2025-03-17', days: 7 });
      expect(result.created).toHaveLength(2); // Wed + Fri only
      expect(result.skippedExistingDates).toContain('2025-03-17');
    });

    it('rest days go to skippedNoRuleDates', () => {
      const plan = makePlan();
      const result = generateCalendarWorkouts(plan, [], { fromDate: '2025-03-17', days: 7 });
      // Tue, Thu, Sat, Sun = 4 rest days
      expect(result.skippedNoRuleDates).toHaveLength(4);
    });

    it('throws for days <= 0', () => {
      const plan = makePlan();
      expect(() => generateCalendarWorkouts(plan, [], { days: 0 })).toThrow();
      expect(() => generateCalendarWorkouts(plan, [], { days: -1 })).toThrow();
    });

    it('sets sourcePlanId and status correctly', () => {
      const plan = makePlan();
      const result = generateCalendarWorkouts(plan, [], { fromDate: '2025-03-17', days: 1 });
      expect(result.created[0].sourcePlanId).toBe('plan-1');
      expect(result.created[0].status).toBe('planned');
    });

    it('first rule wins on duplicate weekday', () => {
      const plan = makePlan({
        weeklyRules: [
          { weekday: 0 as WeekdayIndex, workoutType: 'First' },
          { weekday: 0 as WeekdayIndex, workoutType: 'Second' },
        ],
      });
      const result = generateCalendarWorkouts(plan, [], { fromDate: '2025-03-17', days: 1 });
      expect(result.created[0].workoutType).toBe('First');
    });
  });

  describe('buildDateSet', () => {
    it('creates set from workout dates', () => {
      const workouts = [
        { date: '2025-03-17' },
        { date: '2025-03-19' },
      ] as CalendarWorkout[];
      const set = buildDateSet(workouts);
      expect(set.has('2025-03-17')).toBe(true);
      expect(set.has('2025-03-18')).toBe(false);
      expect(set.size).toBe(2);
    });
  });
});
