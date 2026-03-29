// Community module — shared types

export type PostType = "workout_share" | "text_post" | "progress_update" | "garmin_activity";
export type Visibility = "public" | "followers" | "private";
export type ReportReason = "spam" | "harassment" | "hate" | "nudity" | "self_harm" | "other";
export type ReportTarget = "post" | "comment" | "user";
export type NotificationType = "like" | "comment" | "follow";

export interface CommunityProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
}

export interface WorkoutData {
  title: string;
  sport: string;
  durationMin: number;
  durationLabel: string;
  totalVolumeKg: number;
  totalSets: number;
  totalExercises: number;
  topExercises: string[];
  muscleGroups: string[];
}

export interface GarminActivityData {
  garminActivityId: string;
  activityType: string;
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
  avgHeartRate: number;
  maxHeartRate: number;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  type: PostType;
  text: string | null;
  cardImageUrl: string | null;
  workoutRefId: string | null;
  workoutData: WorkoutData | null;
  garminData: GarminActivityData | null;
  visibility: Visibility;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  // Joined fields
  author?: CommunityProfile;
  isLiked?: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  deletedAt: string | null;
  createdAt: string;
  author?: CommunityProfile;
}

export interface CommunityNotification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  postId: string | null;
  commentId: string | null;
  createdAt: string;
  readAt: string | null;
  actor?: CommunityProfile;
}

export interface FeedParams {
  type: "forYou" | "following";
  cursor?: string; // ISO date of last post
  limit?: number;
}

export const DEFAULT_VISIBILITY: Record<PostType, Visibility> = {
  workout_share: "public",
  text_post: "followers",
  progress_update: "followers",
  garmin_activity: "public",
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Öffentlich",
  followers: "Follower",
  private: "Privat",
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  workout_share: "Workout teilen",
  text_post: "Beitrag",
  progress_update: "Fortschritt",
  garmin_activity: "Garmin Aktivität",
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Belästigung",
  hate: "Hassrede",
  nudity: "Nacktheit",
  self_harm: "Selbstverletzung",
  other: "Sonstiges",
};
