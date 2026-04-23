// --- IMPORTS ---
import React, { useState, useEffect } from "react";
import { useI18n } from "../i18n/useI18n";
import { useAuth } from "../context/AuthContext";

import { useTheme } from "../theme/ThemeContext";

import { AnimatePresence } from "framer-motion";
import { MotionDiv } from "../components/ui/Motion";
import {
    User as UserIcon,
    Star,
    Scale,

    LifeBuoy,
    Shield,
    ChevronRight,
    X,
    ChevronLeft,
    Check,
    Volume2,
    Vibrate,
    Trash2,
    CalendarX,
    Moon,
    Sun,
    Info,
    Mail,
    FileText,
    Building2,
    Activity,
    Bell,
    UserX,
    RefreshCw,
    Users,
} from "lucide-react";
import NotificationSettings from "../components/settings/NotificationSettings";
import { getMuscleDetailMode, setMuscleDetailMode, type MuscleDetailMode } from "../utils/muscleGrouping";
import { loadWarmupConfig, saveWarmupConfig, getDefaultConfig, type WarmupConfig } from "../utils/warmupCalculator";
import { readOnboardingDataFromStorage, writeOnboardingDataToStorage } from "../context/OnboardingContext";

import { hapticHeavy, setHapticEnabled as setHapticEnabledGlobal } from "../native/haptics";
import { DataService } from "../services/DataService";
import { deleteSupabaseAccount } from "../services/supabaseAuth";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ProfileService } from "../services/ProfileService"; // Import ProfileService
import GarminIntegrationModal from "../components/settings/GarminIntegrationModal";
import { useGarminConnection } from "../hooks/useGarminConnection";
import { FEATURE_FLAGS } from "../config/featureFlags";

// --- TYPES ---
type SettingsRowProps = {
    icon: React.ElementType;
    iconColor: string;
    label: string;
    value?: string;
    onClick?: () => void;
    isDestructive?: boolean;
};

type ModalType = 'profile' | 'subscription' | 'preferences' | 'notifications' | 'legal' | 'integrations' | 'impressum' | 'privacy' | 'terms' | null;

// --- COMPONENTS ---

// 1. Reusable Settings Row
// Uses touch tracking to prevent accidental taps while scrolling on iOS.
const SettingsRow: React.FC<SettingsRowProps> = ({
    icon: Icon,
    iconColor,
    label,
    value,
    onClick,
    isDestructive
}) => {
    const touchStartY = React.useRef(0);
    const didMove = React.useRef(false);

    return (
        <button
            onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; didMove.current = false; }}
            onTouchMove={(e) => { if (Math.abs(e.touches[0].clientY - touchStartY.current) > 8) didMove.current = true; }}
            onClick={(e) => { if (didMove.current) { e.preventDefault(); return; } onClick?.(); }}
            className="w-full flex items-center justify-between p-4 bg-[var(--card-bg)] active:bg-[var(--button-bg)] transition-colors border-b border-[var(--border-color)] last:border-0 h-14 group"
        >
            <div className="flex items-center">
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center mr-4 ${iconColor} shadow-lg`}>
                    <Icon size={18} className="text-white" />
                </div>
                <span className={`font-medium text-[17px] ${isDestructive ? 'text-red-500' : 'text-[var(--text-color)]'}`}>
                    {label}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {value && (
                    <span className="text-[17px] text-[var(--text-secondary)]">{value}</span>
                )}
                {!isDestructive && (
                    <ChevronRight size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-color)] transition-colors" />
                )}
            </div>
        </button>
    );
};

// 2. Section Container
const Section: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        {title && (
            <h3 className="text-[13px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold mb-2 pl-4">
                {title}
            </h3>
        )}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)]">
            {children}
        </div>
    </div>
);

// 3. Settings Modal Wrapper
const SettingsModal = ({
    isOpen,
    onClose,
    title,
    children
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) => {
    useBodyScrollLock(isOpen);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Panel */}
                    <MotionDiv
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-x-0 bottom-0 z-[115] h-[92vh] rounded-t-[32px] bg-[var(--modal-bg)] overflow-hidden flex flex-col border-t border-[var(--border-color)] shadow-2xl"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--modal-header)] z-10">
                            <h2 className="text-xl font-bold text-[var(--text-color)]">{title}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 bg-[var(--button-bg)] rounded-full hover:opacity-80 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable with safe bottom padding */}
                        <div className="flex-1 overflow-y-auto p-6 pb-40 space-y-6">
                            {children}
                        </div>
                    </MotionDiv>
                </>
            )}
        </AnimatePresence>
    );
};

// 4. Toggle Switch Component
const ToggleSwitch = ({ checked, onChange, label, icon: Icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: React.ElementType }) => (
    <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
        <div className="flex items-center gap-3">
            {Icon && <Icon size={20} className="text-[var(--text-secondary)]" />}
            <span className="text-base font-medium text-[var(--text-color)]">{label}</span>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-7 rounded-full relative transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-[var(--button-bg)]'}`}
        >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

// 5. Input Field Component
const InputField = ({ label, value, onChange, placeholder, type = "text", suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suffix?: string }) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">{label}</label>
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-2xl p-4 text-[var(--text-color)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            {suffix && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                    {suffix}
                </span>
            )}
        </div>
    </div>
);

// 6. Language Modal (Kept separate as it was working)
const LanguageModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const { t, setLang, lang } = useI18n();
    if (!open) return null;
    return (
        <SettingsModal isOpen={open} onClose={onClose} title={t("settings.language.subtitle")}>
            <div className="flex flex-col gap-2">
                {[
                    { code: "de", name: "Deutsch", flag: "🇩🇪" },
                    { code: "en", name: "English", flag: "🇺🇸" }
                ].map((opt) => (
                    <button
                        key={opt.code}
                        onClick={() => { setLang(opt.code as any); onClose(); }}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${lang === opt.code
                            ? "bg-blue-600 text-white font-bold border-blue-400/30"
                            : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)]"
                            }`}
                    >
                        <span className="flex items-center gap-2 text-[var(--text-color)]">{opt.name} <span className="text-xl">{opt.flag}</span></span>
                        {lang === opt.code && <Check size={20} className="text-white" />}
                    </button>
                ))}
            </div>
        </SettingsModal>
    );
};

// --- MAIN PAGE ---

type Props = {
    onBack: () => void;
    onClearCalendar: () => void;
    onOpenGoals: () => void;
    isSheet?: boolean;
};

const SettingsPage: React.FC<Props> = ({ onBack, onClearCalendar, onOpenGoals, isSheet }) => {
    const { t, lang } = useI18n();
    const { user, logout, resetOnboarding } = useAuth();

    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showResetOnboardingConfirm, setShowResetOnboardingConfirm] = useState(false);
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    // Language modal removed — app is German-only for now
    const { connected: garminConnected } = useGarminConnection();

    // -- Profile State --
    const [profileName, setProfileName] = useState("");
    const [profileWeight, setProfileWeight] = useState("");
    const [profileHeight, setProfileHeight] = useState("");
    const [profileImageSrc, setProfileImageSrc] = useState<string | undefined>(undefined);
    const [profileImageUrlRaw, setProfileImageUrlRaw] = useState<string | undefined>(undefined); // The db: reference
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // -- Preferences State --
    const [hapticEnabled, setHapticEnabled] = useState(true);
    const { theme, setTheme, mode } = useTheme();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [autoShareWorkout, setAutoShareWorkout] = useState(true);
    const [muscleDetail, setMuscleDetail] = useState<MuscleDetailMode>(() => getMuscleDetailMode());
    const [warmupConfig, setWarmupConfigState] = useState<WarmupConfig>(() => loadWarmupConfig());

    // Initial Load
    useEffect(() => {
        // Load Profile
        // Load Profile via Service
        const data = ProfileService.getUserProfile();
        setProfileName(data.username || "");
        setProfileWeight(data.weight ? String(data.weight) : "");
        setProfileHeight(data.height ? String(data.height) : "");
        setProfileImageUrlRaw(data.profileImageUrl);

        // Resolve Image
        if (data.profileImageUrl) {
            ProfileService.resolveProfileImage(data.profileImageUrl).then(src => {
                if (src) setProfileImageSrc(src);
            });
        }

        // Load Preferences
        const storedHaptic = localStorage.getItem("trainq_pref_haptic");
        if (storedHaptic !== null) setHapticEnabled(storedHaptic === "true");

        // const storedDark = localStorage.getItem("trainq_pref_dark"); // Managed by ThemeContext
        // if (storedDark !== null) setDarkModeForce(storedDark === "true");

        const storedSound = localStorage.getItem("trainq_pref_sound");
        if (storedSound !== null) setSoundEnabled(storedSound === "true");

        const storedAutoShare = localStorage.getItem("trainq_pref_auto_share_workout");
        if (storedAutoShare !== null) setAutoShareWorkout(storedAutoShare === "true");

    }, []);

    // Persist Preferences
    useEffect(() => { setHapticEnabledGlobal(hapticEnabled); }, [hapticEnabled]);
    // useEffect(() => { localStorage.setItem("trainq_pref_dark", String(darkModeForce)); }, [darkModeForce]); // Managed by ThemeContext
    useEffect(() => { localStorage.setItem("trainq_pref_sound", String(soundEnabled)); }, [soundEnabled]);
    useEffect(() => { localStorage.setItem("trainq_pref_auto_share_workout", String(autoShareWorkout)); }, [autoShareWorkout]);

    const handleSaveProfile = () => {
        ProfileService.updateUserProfile({
            username: profileName,
            weight: parseFloat(profileWeight) || null, // Allow 0 or null
            height: parseFloat(profileHeight) || null,
            profileImageUrl: profileImageUrlRaw
        });
        setActiveModal(null);
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dbRef = await ProfileService.uploadProfileImage(file);
            const blobUrl = URL.createObjectURL(file);
            setProfileImageSrc(blobUrl);
            setProfileImageUrlRaw(dbRef);
            // Optional: Auto-save immediately to ensure image works if app crashes
            ProfileService.updateUserProfile({ profileImageUrl: dbRef });
        } catch (err) {
            if (import.meta.env.DEV) console.error("Image upload failed", err);
            alert(t("settings.profile.imageSaveError"));
        }
    };

    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = async () => {
        setShowLogoutConfirm(false);
        await logout();
    };

    const handleResetOnboarding = () => setShowResetOnboardingConfirm(true);
    const confirmResetOnboarding = async () => {
        setShowResetOnboardingConfirm(false);
        await resetOnboarding();
    };

    const handleClearCalendarAction = async () => {
        if (!confirm(t("settings.confirm.clearCalendarAll"))) return;

        hapticHeavy();
        DataService.clearCalendar();
        // Since onClearCalendar prop might just be a notify, we also call the service directly or rely on prop if it does specific UI updates
        // The service dispatches event, so UI should update.
        if (onClearCalendar) onClearCalendar();
        alert(t("settings.alert.calendarCleared"));
    };

    const handleClearHistoryAction = async () => {
        if (!confirm(t("settings.confirm.clearHistoryAll"))) return;

        hapticHeavy();
        DataService.clearWorkoutHistory();
        alert(t("settings.alert.historyCleared"));
    };

    const handleDeleteAccount = () => setShowDeleteAccountConfirm(true);
    const confirmDeleteAccount = async () => {
        setShowDeleteAccountConfirm(false);
        hapticHeavy();

        // Clear all local data first
        DataService.clearCalendar();
        DataService.clearWorkoutHistory();

        const { error } = await deleteSupabaseAccount();
        if (error) {
            alert(error);
            return;
        }

        await logout();
    };



    return (
        <div className={isSheet ? "flex flex-col" : "flex flex-col h-full bg-[var(--bg-color)] text-[var(--text-color)] overflow-hidden"}>

            {/* HEADER */}
            <div className={isSheet ? "px-5 pt-1 pb-4 shrink-0" : "pt-page px-6 pb-6 bg-[var(--bg-color)] shrink-0 z-10"}>
                {!isSheet && (
                    <div className="flex items-center mb-2">
                        <button onClick={onBack} className="p-2 -ml-3 rounded-full hover:bg-[var(--button-bg)] transition-colors text-[var(--text-color)]">
                            <ChevronLeft size={32} />
                        </button>
                    </div>
                )}
                <div className="flex justify-between items-end">
                    <h1 className={`font-bold text-[var(--text-color)] tracking-tight ${isSheet ? "text-2xl" : "text-4xl"}`}>{t("settings.title")}</h1>
                </div>
            </div>

            <div className={isSheet ? "px-4 pb-10 max-w-2xl mx-auto w-full" : "flex-1 overflow-y-auto px-4 pb-40 max-w-2xl mx-auto w-full"}>
                {/* SECTION 1: ACCOUNT */}
                <Section title={t("settings.section.account")}>
                    <SettingsRow
                        icon={UserIcon}
                        iconColor="bg-blue-500"
                        label={t("nav.profile")}
                        value={user?.email || "User"}
                        onClick={() => setActiveModal('profile')}
                    />
                </Section>

                {/* SECTION 2: APPEARANCE */}
                <Section title={t("settings.section.appearance")}>
                    <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border-b border-[var(--border-color)] last:border-0 h-16">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-2xl flex items-center justify-center bg-indigo-500 shadow-lg">
                                {theme.mode === 'dark' ? <Moon size={18} className="text-white" /> : <Sun size={18} className="text-white" />}
                            </div>
                            <span className="font-medium text-[17px] text-[var(--text-color)]">{t("settings.appearance.design")}</span>
                        </div>
                        <div className="flex bg-[var(--button-bg)] p-1 rounded-lg">
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme.mode === 'light' && mode !== 'system' ? 'bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {t("settings.appearance.light")}
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme.mode === 'dark' && mode !== 'system' ? 'bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {t("settings.appearance.dark")}
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'system' ? 'bg-blue-500 text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                {t("settings.appearance.auto")}
                            </button>
                        </div>
                    </div>
                </Section>

                {/* SECTION 3: PREFERENCES */}
                <Section>
                    <SettingsRow
                        icon={Scale}
                        iconColor="bg-green-500"
                        label={t("settings.section.preferencesUnits")}
                        value=""
                        onClick={() => setActiveModal('preferences')}
                    />
                    <SettingsRow
                        icon={Bell}
                        iconColor="bg-orange-500"
                        label={t("settings.section.notifications")}
                        value=""
                        onClick={() => setActiveModal('notifications')}
                    />
                </Section>

                {/* SECTION 4: DATA & PRIVACY */}
                <Section title={t("settings.section.dataSecurity")}>
                    <SettingsRow
                        icon={FileText}
                        iconColor="bg-blue-500"
                        label={t("settings.data.importData")}
                        onClick={() => {
                            window.dispatchEvent(
                                new CustomEvent("trainq:navigate", { detail: { path: "/import-csv" } })
                            );
                        }}
                    />
                    <SettingsRow
                        icon={CalendarX}
                        iconColor="bg-red-500"
                        label={t("settings.data.clearCalendar")}
                        onClick={handleClearCalendarAction}
                        isDestructive
                    />
                    <SettingsRow
                        icon={Trash2}
                        iconColor="bg-red-500"
                        label={t("settings.data.deleteHistory")}
                        onClick={handleClearHistoryAction}
                        isDestructive
                    />
                </Section>

                {/* SECTION: INTEGRATIONS (hidden while Garmin is behind feature flag) */}
                {FEATURE_FLAGS.garmin && (
                <Section title={t("settings.section.integrations", "Integrationen")}>
                    <SettingsRow
                        icon={Activity}
                        iconColor="bg-emerald-500"
                        label={t("settings.integrations.garmin")}
                        value={garminConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
                        onClick={() => setActiveModal('integrations')}
                    />
                </Section>
                )}

                {/* SECTION 5: DANGER ZONE — placed above Legal to avoid iOS scroll-tap misfire */}
                <div className="space-y-3 mb-8">
                    <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); handleResetOnboarding(); }}
                        className="w-full h-14 bg-[var(--card-bg)] active:bg-[var(--button-bg)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center gap-2 text-[var(--text-color)] font-semibold text-[16px]"
                    >
                        <RefreshCw size={18} style={{ color: "var(--accent-color)" }} />
                        {t("settings.data.resetOnboarding")}
                    </button>
                    <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); handleLogout(); }}
                        className="w-full h-14 bg-[var(--card-bg)] active:bg-[var(--button-bg)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center text-red-500 font-bold text-[17px] shadow-lg"
                    >
                        {t("settings.account.logout")}
                    </button>
                    <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); handleDeleteAccount(); }}
                        className="w-full h-14 bg-[var(--card-bg)] active:bg-[var(--button-bg)] rounded-2xl border border-red-500/30 flex items-center justify-center gap-2 text-red-500/70 font-medium text-[15px]"
                    >
                        <UserX size={18} />
                        {t("settings.account.deleteProfile")}
                    </button>
                </div>

                {/* SECTION 6: LEGAL */}
                <Section title={t("settings.section.legal")}>
                    <SettingsRow icon={Building2} iconColor="bg-zinc-500" label={t("settings.legal.imprint")} onClick={() => setActiveModal('impressum')} />
                    <SettingsRow icon={FileText} iconColor="bg-zinc-500" label={t("settings.legal.privacy")} onClick={() => setActiveModal('privacy')} />
                    <SettingsRow icon={Shield} iconColor="bg-zinc-500" label="Nutzungsbedingungen" onClick={() => setActiveModal('terms')} />
                    <SettingsRow icon={Info} iconColor="bg-blue-500" label={t("settings.legal.aboutUs")} onClick={() => setActiveModal('legal')} />
                    <SettingsRow icon={Mail} iconColor="bg-blue-500" label={t("settings.legal.contactSupport")} onClick={() => setActiveModal('legal')} />
                </Section>

                <div className="text-center pt-2 pb-4">
                    <p className="text-xs text-[var(--text-secondary)] opacity-40 font-mono">TrainQ v1.0.2 (Build 2026)</p>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* LOGOUT CONFIRM DIALOG */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-color)" }}>{t("settings.logout.confirmTitle")}</h3>
                        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                            {t("settings.logout.confirmMessage")}
                        </p>
                        <div className="flex flex-col gap-3 w-full">
                            <button onClick={confirmLogout} className="w-full py-3.5 rounded-2xl bg-red-500 text-white font-bold text-[16px] active:scale-95 transition-transform">
                                {t("settings.logout.confirmButton")}
                            </button>
                            <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-3.5 rounded-2xl font-semibold text-[16px] active:scale-95 transition-transform" style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }}>
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RESET ONBOARDING CONFIRM DIALOG */}
            {showResetOnboardingConfirm && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-color)" }}>Onboarding wiederholen?</h3>
                        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                            Du durchläufst die Einrichtung erneut. Deine Daten bleiben erhalten.
                        </p>
                        <div className="flex flex-col gap-3 w-full">
                            <button onClick={confirmResetOnboarding} className="w-full py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-[16px] active:scale-95 transition-transform">
                                Ja, wiederholen
                            </button>
                            <button onClick={() => setShowResetOnboardingConfirm(false)} className="w-full py-3.5 rounded-2xl font-semibold text-[16px] active:scale-95 transition-transform" style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }}>
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE ACCOUNT CONFIRM DIALOG */}
            {showDeleteAccountConfirm && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                        <h3 className="text-xl font-bold mb-2 text-red-500">Profil endgültig löschen?</h3>
                        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                            Alle deine Daten werden unwiderruflich gelöscht — Trainings, Ernährung, Einstellungen. Das kann nicht rückgängig gemacht werden.
                        </p>
                        <div className="flex flex-col gap-3 w-full">
                            <button onClick={confirmDeleteAccount} className="w-full py-3.5 rounded-2xl bg-red-500 text-white font-bold text-[16px] active:scale-95 transition-transform">
                                Ja, endgültig löschen
                            </button>
                            <button onClick={() => setShowDeleteAccountConfirm(false)} className="w-full py-3.5 rounded-2xl font-semibold text-[16px] active:scale-95 transition-transform" style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }}>
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROFILE MODAL */}
            <SettingsModal isOpen={activeModal === 'profile'} onClose={handleSaveProfile} title={t("nav.profile")}>
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center py-4 gap-3">
                        <div
                            className="relative h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {profileImageSrc ? (
                                <img src={profileImageSrc} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span>{profileName.slice(0, 2).toUpperCase() || "TQ"}</span>
                            )}

                            {/* Overlay Hint */}
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold text-white">{t("common.edit")}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-blue-400 text-sm font-medium"
                        >
                            {t("settings.profile.changeImage")}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImagePick}
                        />
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-500 text-sm">
                        {t("settings.profile.dataPrivacyNote")}
                    </div>
                    <div className="space-y-4">
                        <InputField label={t("settings.profile.displayName")} value={profileName} onChange={setProfileName} placeholder={t("settings.profile.yourName")} />
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label={t("settings.profile.weight")} value={profileWeight} onChange={setProfileWeight} placeholder="0" type="number" suffix="kg" />
                            <InputField label={t("settings.profile.height")} value={profileHeight} onChange={setProfileHeight} placeholder="0" type="number" suffix="cm" />
                        </div>
                    </div>
                    <button onClick={handleSaveProfile} className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]">
                        {t("common.save")}
                    </button>
                </div>
            </SettingsModal>


            {/* PREFERENCES MODAL */}
            <SettingsModal isOpen={activeModal === 'preferences'} onClose={() => setActiveModal(null)} title={t("settings.preferences.title")}>
                <div className="space-y-4">


                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">{t("settings.preferences.interaction")}</h3>
                        <div className="space-y-3">
                            {FEATURE_FLAGS.haptics && (
                            <ToggleSwitch
                                label={t("settings.preferences.hapticFeedback")}
                                checked={hapticEnabled}
                                onChange={setHapticEnabled}
                                icon={Vibrate}
                            />
                            )}
                            <ToggleSwitch
                                label={t("settings.preferences.sounds")}
                                checked={soundEnabled}
                                onChange={setSoundEnabled}
                                icon={Volume2}
                            />
                        </div>
                    </div>

                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">{t("settings.preferences.units")}</h3>
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center opacity-70">
                            <span className="text-[var(--text-color)]">{t("settings.preferences.weightUnit")}</span>
                            <span className="text-[var(--text-secondary)] font-mono">{t("settings.preferences.kgMetric")}</span>
                        </div>
                    </div>

                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">{t("settings.preferences.display")}</h3>
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Activity size={20} className="text-[var(--text-secondary)]" />
                                <span className="text-base font-medium text-[var(--text-color)]">{t("settings.preferences.muscleDetail")}</span>
                            </div>
                            <div className="flex bg-[var(--button-bg)] p-0.5 rounded-lg">
                                <button
                                    onClick={() => { setMuscleDetail("einfach"); setMuscleDetailMode("einfach"); }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                        muscleDetail === "einfach"
                                            ? "bg-blue-500 text-white shadow-sm"
                                            : "text-[var(--text-secondary)]"
                                    }`}
                                >
                                    {t("settings.preferences.simple")}
                                </button>
                                <button
                                    onClick={() => { setMuscleDetail("komplex"); setMuscleDetailMode("komplex"); }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                        muscleDetail === "komplex"
                                            ? "bg-blue-500 text-white shadow-sm"
                                            : "text-[var(--text-secondary)]"
                                    }`}
                                >
                                    {t("settings.preferences.complex")}
                                </button>
                            </div>
                        </div>
                    </div>

                    {FEATURE_FLAGS.warmupSets && (
                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">{t("settings.preferences.warmupSets")}</h3>
                        <div className="space-y-3">
                            <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
                                <span className="text-sm font-medium text-[var(--text-color)]">{t("settings.preferences.barWeight")}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={warmupConfig.barWeight}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (!Number.isFinite(v) || v < 0) return;
                                            const next = { ...warmupConfig, barWeight: v };
                                            setWarmupConfigState(next);
                                            saveWarmupConfig(next);
                                        }}
                                        className="w-16 h-8 text-center text-sm font-bold rounded-lg bg-[var(--input-bg)] text-[var(--text-color)] outline-none border border-[var(--border-color)]"
                                    />
                                    <span className="text-xs text-[var(--text-secondary)]">kg</span>
                                </div>
                            </div>
                            <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
                                <span className="text-sm font-medium text-[var(--text-color)]">{t("settings.preferences.plateIncrement")}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.5"
                                        value={warmupConfig.plateIncrement}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (!Number.isFinite(v) || v <= 0) return;
                                            const next = { ...warmupConfig, plateIncrement: v };
                                            setWarmupConfigState(next);
                                            saveWarmupConfig(next);
                                        }}
                                        className="w-16 h-8 text-center text-sm font-bold rounded-lg bg-[var(--input-bg)] text-[var(--text-color)] outline-none border border-[var(--border-color)]"
                                    />
                                    <span className="text-xs text-[var(--text-secondary)]">kg</span>
                                </div>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] px-1">
                                {t("settings.preferences.warmupSteps")}
                            </p>
                        </div>
                    </div>
                    )}

                    {/* Auto-Share: removed — feature not implemented yet */}
                </div>
            </SettingsModal>

            {/* NOTIFICATIONS MODAL */}
            <SettingsModal isOpen={activeModal === 'notifications'} onClose={() => setActiveModal(null)} title={t("settings.section.notifications")}>
                <NotificationSettings />
            </SettingsModal>

            {/* LEGAL MODAL */}
            <SettingsModal isOpen={activeModal === 'legal'} onClose={() => setActiveModal(null)} title={t("settings.legal.title")}>
                <div className="space-y-8">

                    {/* ABOUT US */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <img
                                src={theme.mode === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
                                alt="TrainQ"
                                className="w-10 h-10 rounded-xl shadow-lg"
                            />
                            <div>
                                <h3 className="font-bold text-[var(--text-color)] text-lg">{t("settings.legal.aboutTrainQ")}</h3>
                                <p className="text-blue-400 text-xs font-medium">{t("settings.legal.visionMission")}</p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {t("settings.legal.aboutText1")}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {t("settings.legal.aboutText2")}
                        </p>
                    </div>

                    {/* CONTACT */}
                    <div className="border-t border-[var(--border-color)] pt-6 space-y-3">
                        <h3 className="font-bold text-[var(--text-color)] mb-2">{t("settings.legal.contactAndSupport")}</h3>
                        <div className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
                            <p className="text-[var(--text-secondary)] text-xs">
                                {t("settings.legal.contactText")}
                            </p>
                            <a href="mailto:support@trainq.app" className="flex items-center justify-center w-full py-3 bg-blue-600/10 text-blue-400 font-bold rounded-xl text-sm hover:bg-blue-600/20 transition-colors gap-2">
                                <Mail size={16} />
                                support@trainq.app
                            </a>
                        </div>
                    </div>

                    <div className="pt-6 pb-8 text-center">
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-50 font-mono uppercase tracking-widest">
                            © 2026 Julius Deusch — TrainQ
                        </p>
                    </div>
                </div>
            </SettingsModal>

            {/* IMPRESSUM MODAL */}
            <SettingsModal isOpen={activeModal === 'impressum'} onClose={() => setActiveModal(null)} title={t("settings.legal.imprint")}>
                <div className="space-y-5 leading-relaxed">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
                    <div>
                        <h3 className="font-bold text-base mb-1">Verantwortlich für den Inhalt</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Julius Deusch<br/>In den Grüben 140<br/>84489 Burghausen<br/>Deutschland</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-base mb-1">Kontakt</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Telefon: +49 162 3172876<br/>E-Mail: julius.deusch@trainq.app</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-base mb-1">Umsatzsteuer-ID</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: Noch nicht vergeben (Kleinunternehmerregelung gemäß § 19 UStG).</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-base mb-1">EU-Streitschlichtung</h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                            <span className="underline" style={{ color: 'var(--accent-color)' }} onClick={() => window.open("https://ec.europa.eu/consumers/odr/", "_system")}>
                                https://ec.europa.eu/consumers/odr/
                            </span>
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-base mb-1">Haftung für Inhalte</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG für eigene Inhalte in dieser App nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
                    </div>
                    <p className="text-xs text-center pt-4" style={{ color: 'var(--text-secondary)' }}>Stand: April 2026</p>
                </div>
            </SettingsModal>

            {/* PRIVACY MODAL */}
            <SettingsModal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title="Datenschutzerklärung">
                <div className="space-y-5 leading-relaxed text-sm">
                    <div><h3 className="font-bold text-base mb-2">1. Verantwortlicher</h3><p className="text-[var(--text-secondary)]">Julius Deusch<br/>In den Grüben 140, 84489 Burghausen, Deutschland<br/>E-Mail: julius.deusch@trainq.app</p></div>
                    <div><h3 className="font-bold text-base mb-2">2. Überblick der Verarbeitungen</h3><p className="text-[var(--text-secondary)]">TrainQ ist eine Fitness-App für iOS. Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer funktionsfähigen App sowie unserer Inhalte und Leistungen erforderlich ist.</p><p className="text-[var(--text-secondary)] mt-2 font-medium">Arten der verarbeiteten Daten:</p><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li>Bestandsdaten (Name, E-Mail-Adresse)</li><li>Nutzungsdaten (Trainingseinträge, Übungen, Gewichte, Sätze, Wiederholungen)</li><li>Gesundheitsbezogene Daten (Fitness-Level, Körpergewicht, Körpergröße)</li><li>Ernährungsdaten (Mahlzeiten, Makronährstoffe)</li><li>Standortdaten (GPS bei Cardio-Tracking)</li><li>Geräteinformationen (Gerätetyp, Betriebssystem)</li></ul></div>
                    <div><h3 className="font-bold text-base mb-2">3. Rechtsgrundlagen</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li><strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> Bereitstellung der App-Funktionen.</li><li><strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</strong> Standort (GPS), Kamera (Barcode), Push-Benachrichtigungen.</li><li><strong>Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO):</strong> Fehleranalyse und Verbesserung.</li><li><strong>Ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO):</strong> Gesundheitsbezogene Daten.</li></ul></div>
                    <div><h3 className="font-bold text-base mb-2">4. Datenspeicherung und Hosting</h3><p className="text-[var(--text-secondary)]">Deine Daten werden über Supabase (EU-Region Frankfurt) verarbeitet und gespeichert. Mit Supabase besteht ein Auftragsverarbeitungsvertrag (AVV/DPA) gemäß Art. 28 DSGVO. Für Datentransfers in Drittländer gelten die EU-Standardvertragsklauseln (SCCs).</p></div>
                    <div><h3 className="font-bold text-base mb-2">5. Lokale Datenspeicherung</h3><p className="text-[var(--text-secondary)]">Viele Daten werden direkt auf deinem Gerät gespeichert (Trainingseinstellungen, Ernährungstagebuch, GPS-Sessions, App-Einstellungen). Diese Daten verlassen dein Gerät nicht ohne Cloud-Synchronisierung.</p></div>
                    <div><h3 className="font-bold text-base mb-2">6. Authentifizierung</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li><strong>E-Mail & Passwort:</strong> Passwort wird gehasht gespeichert.</li><li><strong>Apple Sign-In:</strong> Nur von Apple freigegebene Daten.</li><li><strong>Google Sign-In:</strong> Nur Basis-Profildaten.</li></ul></div>
                    <div><h3 className="font-bold text-base mb-2">7. Gerätezugriffe</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li><strong>Standort (GPS):</strong> Nur während aktiver Cardio-Aufzeichnung.</li><li><strong>Kamera:</strong> Nur für den Barcode-Scanner.</li><li><strong>Push-Benachrichtigungen:</strong> Für Trainingserinnerungen.</li></ul><p className="text-[var(--text-secondary)] mt-1">Jede Berechtigung kann jederzeit in den iOS-Einstellungen widerrufen werden.</p></div>
                    <div><h3 className="font-bold text-base mb-2">8. Garmin Connect Integration</h3><p className="text-[var(--text-secondary)]">Optional: Aktivitäten, tägliche Metriken und Schlafdaten von Garmin. Die Verbindung kann jederzeit getrennt werden.</p></div>
                    <div><h3 className="font-bold text-base mb-2">9. In-App-Käufe</h3><p className="text-[var(--text-secondary)]">Zahlungsabwicklung ausschließlich über Apple. Wir erhalten keine Zahlungsdaten.</p></div>
                    <div><h3 className="font-bold text-base mb-2">10. Datenübermittlung an Dritte</h3><p className="text-[var(--text-secondary)]">Wir verkaufen deine Daten niemals. Übermittlung nur an: Supabase (Hosting), Apple (In-App-Käufe), Garmin (bei aktiver Verbindung). Keine Tracking-SDKs, Analyse-Tools oder Werbenetzwerke.</p></div>
                    <div><h3 className="font-bold text-base mb-2">11. Speicherdauer</h3><p className="text-[var(--text-secondary)]">Daten werden gespeichert, solange dein Konto besteht. Bei Löschung werden alle Daten innerhalb von 30 Tagen unwiderruflich entfernt.</p></div>
                    <div><h3 className="font-bold text-base mb-2">12. Deine Rechte (Art. 15–21 DSGVO)</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li><strong>Auskunft</strong> (Art. 15)</li><li><strong>Berichtigung</strong> (Art. 16)</li><li><strong>Löschung</strong> (Art. 17)</li><li><strong>Einschränkung</strong> (Art. 18)</li><li><strong>Datenübertragbarkeit</strong> (Art. 20)</li><li><strong>Widerspruch</strong> (Art. 21)</li><li><strong>Widerruf der Einwilligung</strong></li></ul><p className="text-[var(--text-secondary)] mt-1">Kontakt: julius.deusch@trainq.app</p></div>
                    <div><h3 className="font-bold text-base mb-2">13. Beschwerderecht</h3><p className="text-[var(--text-secondary)]">Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)<br/>Promenade 18, 91522 Ansbach</p></div>
                    <div><h3 className="font-bold text-base mb-2">14. Datensicherheit</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li>Verschlüsselte Datenübertragung (TLS/HTTPS)</li><li>Gehashte Passwörter (bcrypt)</li><li>Row-Level-Security (Supabase RLS)</li><li>Datenhosting in der EU (Frankfurt)</li></ul></div>
                    <p className="text-xs text-center pt-4" style={{ color: 'var(--text-secondary)' }}>Stand: April 2026</p>
                </div>
            </SettingsModal>

            {/* TERMS MODAL */}
            <SettingsModal isOpen={activeModal === 'terms'} onClose={() => setActiveModal(null)} title="Nutzungsbedingungen">
                <div className="space-y-5 leading-relaxed text-sm">
                    <div><h3 className="font-bold text-base mb-2">1. Geltungsbereich</h3><p className="text-[var(--text-secondary)]">Diese Nutzungsbedingungen gelten für die Nutzung der App "TrainQ", betrieben von Julius Deusch, In den Grüben 140, 84489 Burghausen. Mit der Registrierung stimmst du diesen Bedingungen zu.</p></div>
                    <div><h3 className="font-bold text-base mb-2">2. Leistungsbeschreibung</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li>Erstellung und Verwaltung von Trainingsplänen</li><li>Adaptive Trainingsvorschläge</li><li>Live-Training mit Satz-Tracking und Pausentimer</li><li>Ernährungstagebuch mit Makronährstoff-Tracking</li><li>Kalender mit Trainingsplanung</li><li>Cardio-Tracking mit GPS</li><li>Gamification (XP, Level-System)</li><li>Statistiken und Fortschrittsanalyse</li></ul></div>
                    <div><h3 className="font-bold text-base mb-2">3. Registrierung und Konto</h3><p className="text-[var(--text-secondary)]">Registrierung per E-Mail/Passwort, Apple Sign-In oder Google Sign-In. Du bist für die Sicherheit deiner Zugangsdaten selbst verantwortlich.</p></div>
                    <div><h3 className="font-bold text-base mb-2">4. Free & Pro</h3><p className="text-[var(--text-secondary)]">TrainQ bietet eine kostenlose Basisversion und ein Pro-Abonnement. Abrechnung über Apple In-App Purchase. Kündigung jederzeit über die iOS-Einstellungen. Nach Kündigung bleibt Pro-Zugang bis zum Ende des bezahlten Zeitraums bestehen.</p></div>
                    <div><h3 className="font-bold text-base mb-2">5. Nutzungspflichten</h3><ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]"><li>Keine rechtswidrige Nutzung</li><li>Keine Umgehung von Sicherheitsmechanismen</li><li>Keine automatisierten Zugriffe</li><li>Keine falschen Angaben bei der Registrierung</li><li>Kein Kopieren oder Dekompilieren der App</li></ul></div>
                    <div><h3 className="font-bold text-base mb-2">6. Gesundheitshinweis</h3><p className="text-[var(--text-secondary)] font-medium">TrainQ ist kein medizinisches Produkt.</p><p className="text-[var(--text-secondary)] mt-1">Die App ersetzt keine ärztliche Beratung. Konsultiere vor Beginn eines neuen Trainingsprogramms einen Arzt. Die Nutzung erfolgt auf eigene Verantwortung. Keine Haftung für Verletzungen oder gesundheitliche Schäden.</p></div>
                    <div><h3 className="font-bold text-base mb-2">7. Geistiges Eigentum</h3><p className="text-[var(--text-secondary)]">Alle Inhalte der App sind urheberrechtlich geschützt. Nutzergenerierte Inhalte verbleiben im Eigentum des Nutzers.</p></div>
                    <div><h3 className="font-bold text-base mb-2">8. Verfügbarkeit</h3><p className="text-[var(--text-secondary)]">Kein Anspruch auf ständige Verfügbarkeit. Wartungsarbeiten oder technische Störungen können zu Einschränkungen führen.</p></div>
                    <div><h3 className="font-bold text-base mb-2">9. Haftungsbeschränkung</h3><p className="text-[var(--text-secondary)]">Unbeschränkte Haftung bei Vorsatz und grober Fahrlässigkeit. Bei leichter Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten, beschränkt auf vorhersehbare Schäden.</p></div>
                    <div><h3 className="font-bold text-base mb-2">10. Kontolöschung</h3><p className="text-[var(--text-secondary)]">Jederzeit in den App-Einstellungen möglich. Alle Daten werden innerhalb von 30 Tagen unwiderruflich gelöscht.</p></div>
                    <div><h3 className="font-bold text-base mb-2">11. Anwendbares Recht</h3><p className="text-[var(--text-secondary)]">Es gilt das Recht der Bundesrepublik Deutschland. Für Verbraucher gelten zusätzlich die zwingenden Verbraucherschutzbestimmungen ihres Aufenthaltslandes.</p></div>
                    <div><h3 className="font-bold text-base mb-2">12. Kontakt</h3><p className="text-[var(--text-secondary)]">E-Mail: julius.deusch@trainq.app</p></div>
                    <p className="text-xs text-center pt-4" style={{ color: 'var(--text-secondary)' }}>Stand: April 2026</p>
                </div>
            </SettingsModal>

            {/* GARMIN INTEGRATION MODAL */}
            {FEATURE_FLAGS.garmin && <GarminIntegrationModal isOpen={activeModal === 'integrations'} onClose={() => setActiveModal(null)} />}

        </div>
    );
};

export default SettingsPage;
