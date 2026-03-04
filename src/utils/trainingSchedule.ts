import { format, addDays } from 'date-fns';
import { getScopedItem, setScopedItem } from './scopedStorage';
import { getActiveUserId } from './session';

/**
 * Shifts all PLANNED training sessions from (and including) today into the future.
 * Uses SCOPED STORAGE (Local) for immediate UI update.
 * @param days Number of days to shift (default: 1)
 */
export async function shiftWorkouts(days: number = 1): Promise<{ count: number }> {
    try {
        const userId = getActiveUserId();
        const storageKey = "trainq_calendar_events";

        // 1. Load Local Events
        const raw = getScopedItem(storageKey, userId);
        if (!raw) return { count: 0 };

        let events: any[] = [];
        try {
            events = JSON.parse(raw);
        } catch {
            return { count: 0 };
        }

        if (!Array.isArray(events)) return { count: 0 };

        const todayISO = new Date().toISOString().split('T')[0];
        let count = 0;

        // 2. Process Shifts
        const updatedEvents = events.map((ev) => {
            // Check eligibility:
            // - Must be training
            // - Must have date >= today
            // - NOT completed

            const isTraining = ev.type === 'training' || !!ev.trainingType || (ev.sport && ev.sport !== 'Other');
            if (!isTraining) return ev;

            const date = ev.date;
            if (!date || date < todayISO) return ev;

            // Allow shifting 'planned', 'open', or undefined status. 
            // Do NOT shift 'completed' or 'skipped' (unless user wants to? Usually only open ones).
            const status = ev.trainingStatus || ev.status;
            if (status === 'completed' || status === 'skipped') return ev;

            // Shift it (Safe Local Date)
            const [y, m, d] = date.split('-').map(Number);
            const localDate = new Date(y, m - 1, d); // Local Midnight
            const newDate = addDays(localDate, days);
            const newDateISO = format(newDate, 'yyyy-MM-dd');

            count++;
            return { ...ev, date: newDateISO };
        });

        // 3. Save Back
        if (count > 0) {
            setScopedItem(storageKey, JSON.stringify(updatedEvents), userId);
            // 4. Trigger Global Refresh for MainAppShell
            window.dispatchEvent(new Event("trainq:update_events"));
        }

        return { count };

    } catch (error) {
        if (import.meta.env.DEV) console.error("Shift Workouts Error:", error);
        throw error;
    }
}
