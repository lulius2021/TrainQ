import { getSupabaseClient } from '../lib/supabaseClient';
import { format, addDays } from 'date-fns';

/**
 * Shifts all PLANNED training sessions from (and including) today into the future.
 * @param days Number of days to shift (default: 1)
 */
export async function shiftWorkouts(days: number = 1) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn("No Supabase client available, skipping shift.");
        return { count: 0 };
    }

    try {
        const todayISO = new Date().toISOString().split('T')[0];

        // 1. Fetch future planned workouts
        const { data: workouts, error: fetchError } = await supabase
            .from('user_trainings')
            .select('id, date, status')
            .gte('date', todayISO)
            .neq('status', 'completed');

        if (fetchError) throw fetchError;
        if (!workouts || workouts.length === 0) return { count: 0 };

        // 2. Update each
        const updates = workouts.map(async (workout: { id: string; date: string }) => {
            const oldDate = new Date(workout.date);
            const newDate = addDays(oldDate, days);
            const newDateISO = format(newDate, 'yyyy-MM-dd');

            return supabase
                .from('user_trainings')
                .update({ date: newDateISO })
                .eq('id', workout.id);
        });

        await Promise.all(updates);
        return { count: workouts.length };

    } catch (error) {
        console.error("Shift Workouts Error:", error);
        throw error;
    }
}
