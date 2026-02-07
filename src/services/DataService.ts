import { setScopedItem } from '../utils/scopedStorage';
import { getActiveUserId } from '../utils/session';
import { clearWorkoutHistory as clearHistoryUtil } from '../utils/workoutHistory';

export const DataService = {
    clearCalendar: () => {
        const userId = getActiveUserId() || "user";
        // Overwrite with empty array
        setScopedItem("trainq_calendar_events", JSON.stringify([]), userId);

        // Notify app parts
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("trainq:update_events"));
        }
    },

    clearWorkoutHistory: () => {
        // Uses the existing utility which handles storage clearing and event dispatch
        clearHistoryUtil();
    }
};
