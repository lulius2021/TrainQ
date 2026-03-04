
import type { OnboardingData } from "../types/onboarding";
import { readOnboardingDataFromStorage, writeOnboardingDataToStorage } from "../context/OnboardingContext";
import { saveProfileImage, loadProfileImageUrl } from "../utils/profileImageStore";

const PROFILE_IMAGE_PREFIX = "db:";

export const ProfileService = {
    getUserProfile: () => {
        // Return full onboarding data view for profile
        const data = readOnboardingDataFromStorage();
        return {
            username: data.profile.username,
            weight: data.personal.weight,
            height: data.personal.height,
            age: data.personal.age,
            profileImageUrl: data.profile.profileImageUrl, // Could be "db:abc"
            isPublic: data.profile.isPublic,
            bio: (data.profile as any).bio,
        };
    },

    updateUserProfile: (updates: {
        username?: string;
        weight?: number | null;
        height?: number | null;
        age?: number | null;
        profileImageUrl?: string;
        bio?: string;
    }) => {
        const current = readOnboardingDataFromStorage();

        // Construct new data structure carefully using the existing normalize logic
        // But since writeOnboardingData uses normalize internally via context? No, context uses normalize. 
        // writeOnboardingDataToStorage just dumps it.
        // So we should manually update the fields.

        // Deep clone to be safe (simple object)
        const next: OnboardingData = JSON.parse(JSON.stringify(current));

        if (updates.username !== undefined) next.profile.username = updates.username;
        if (updates.profileImageUrl !== undefined) next.profile.profileImageUrl = updates.profileImageUrl;
        if (updates.bio !== undefined) (next.profile as any).bio = updates.bio;

        if (updates.weight !== undefined) next.personal.weight = updates.weight;
        if (updates.height !== undefined) next.personal.height = updates.height;
        if (updates.age !== undefined) next.personal.age = updates.age;

        writeOnboardingDataToStorage(next);
    },

    /**
     * Saves a file to IndexedDB and returns the "db:..." reference string.
     */
    uploadProfileImage: async (file: File): Promise<string> => {
        const { refId } = await saveProfileImage(file);
        return `${PROFILE_IMAGE_PREFIX}${refId}`;
    },

    /** 
     * Resolves a "db:..." reference OR standard URL to a visible src string.
     */
    resolveProfileImage: async (url?: string): Promise<string | undefined> => {
        if (!url) return undefined;
        if (url.startsWith(PROFILE_IMAGE_PREFIX)) {
            const refId = url.slice(PROFILE_IMAGE_PREFIX.length);
            try {
                const blobUrl = await loadProfileImageUrl(refId);
                return blobUrl;
            } catch (e) {
                if (import.meta.env.DEV) console.error("Failed to load profile image blob", e);
                return undefined;
            }
        }
        return url;
    }
};
