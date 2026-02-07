
export type ExerciseType = "strength" | "run" | "cycle" | "custom";

export interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    type: ExerciseType;
    duration: number;
    intensity: "low" | "medium" | "high";
    color?: string;
    workoutData?: any;
    status: "planned" | "completed" | "skipped" | "open";
}
