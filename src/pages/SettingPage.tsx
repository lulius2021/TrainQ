// --- IMPORTS ---
import React, { useState, useEffect } from "react";
import { useI18n } from "../i18n/useI18n";
import { useAuth } from "../context/AuthContext";

import { useTheme } from "../theme/ThemeContext";

import { motion, AnimatePresence } from "framer-motion";
import {
    User as UserIcon,
    Star,
    Globe,
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
    Bell
} from "lucide-react";
import NotificationSettings from "../components/settings/NotificationSettings";
import { getMuscleDetailMode, setMuscleDetailMode, type MuscleDetailMode } from "../utils/muscleGrouping";
import { loadWarmupConfig, saveWarmupConfig, getDefaultConfig, type WarmupConfig } from "../utils/warmupCalculator";
import { useEntitlements } from "../hooks/useEntitlements";
import { readOnboardingDataFromStorage, writeOnboardingDataToStorage } from "../context/OnboardingContext";

import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { DataService } from "../services/DataService";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ProfileService } from "../services/ProfileService"; // Import ProfileService
import GarminIntegrationModal from "../components/settings/GarminIntegrationModal";
import { useGarminConnection } from "../hooks/useGarminConnection";

// --- TYPES ---
type SettingsRowProps = {
    icon: React.ElementType;
    iconColor: string;
    label: string;
    value?: string;
    onClick?: () => void;
    isDestructive?: boolean;
};

type ModalType = 'profile' | 'subscription' | 'preferences' | 'notifications' | 'legal' | 'integrations' | null;

// --- COMPONENTS ---

// 1. Reusable Settings Row
// @ts-ignore
const MotionDiv = motion.div as any;

const SettingsRow: React.FC<SettingsRowProps> = ({
    icon: Icon,
    iconColor,
    label,
    value,
    onClick,
    isDestructive
}) => {
    return (
        <button
            onClick={onClick}
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
                    {/* @ts-ignore */}
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Panel */}
                    {/* @ts-ignore */}
                    <MotionDiv
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-x-0 bottom-0 z-[70] h-[92vh] rounded-t-[32px] bg-[var(--modal-bg)] overflow-hidden flex flex-col border-t border-[var(--border-color)] shadow-2xl"
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
                    { code: "de", label: "Deutsch <span class='text-xl'>🇩🇪</span>" },
                    { code: "en", label: "English <span class='text-xl'>🇺🇸</span>" }
                ].map((opt) => (
                    <button
                        key={opt.code}
                        onClick={() => { setLang(opt.code as any); onClose(); }}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${lang === opt.code
                            ? "bg-blue-600 text-white font-bold border-blue-400/30"
                            : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)]"
                            }`}
                    >
                        <span className="flex items-center gap-2 text-[var(--text-color)]" dangerouslySetInnerHTML={{ __html: opt.label }} />
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
    onOpenPaywall: () => void;
    onOpenGoals: () => void;
};

// Demo Generator (kept but minimized)


const SettingsPage: React.FC<Props> = ({ onBack, onClearCalendar, onOpenPaywall, onOpenGoals }) => {
    const { t, lang } = useI18n();
    const { user, logout } = useAuth();
    const { isPro } = useEntitlements(user?.id);

    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [showLangModal, setShowLangModal] = useState(false);
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

    }, []);

    // Persist Preferences
    useEffect(() => { localStorage.setItem("trainq_pref_haptic", String(hapticEnabled)); }, [hapticEnabled]);
    // useEffect(() => { localStorage.setItem("trainq_pref_dark", String(darkModeForce)); }, [darkModeForce]); // Managed by ThemeContext
    useEffect(() => { localStorage.setItem("trainq_pref_sound", String(soundEnabled)); }, [soundEnabled]);

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
            console.error("Image upload failed", err);
            alert("Bild konnte nicht gespeichert werden.");
        }
    };

    const handleLogout = async () => {
        if (confirm(t("settings.confirm.logout"))) {
            await logout();
        }
    };

    const handleClearCalendarAction = async () => {
        if (!confirm("Alle geplanten Trainings aus dem Kalender löschen?")) return;

        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        DataService.clearCalendar();
        // Since onClearCalendar prop might just be a notify, we also call the service directly or rely on prop if it does specific UI updates
        // The service dispatches event, so UI should update.
        if (onClearCalendar) onClearCalendar();
        alert("Kalender geleert.");
    };

    const handleClearHistoryAction = async () => {
        if (!confirm("Kompletten Trainingsverlauf unwiderruflich löschen?")) return;

        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        DataService.clearWorkoutHistory();
        alert("Verlauf gelöscht.");
    };



    return (
        <div className="flex flex-col h-full bg-[var(--bg-color)] text-[var(--text-color)] overflow-hidden">

            {/* HEADER */}
            <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-6 bg-[var(--bg-color)] shrink-0 z-10">
                <div className="flex items-center mb-2">
                    <button onClick={onBack} className="p-2 -ml-3 rounded-full hover:bg-[var(--button-bg)] transition-colors text-[var(--text-color)]">
                        <ChevronLeft size={32} />
                    </button>
                </div>
                <div className="flex justify-between items-end">
                    <h1 className="text-4xl font-bold text-[var(--text-color)] tracking-tight">{t("settings.title")}</h1>
                    {isPro && (
                        <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-black text-[10px] font-black px-2 py-1 rounded-md mb-2 shadow-lg shadow-amber-500/20">
                            PRO
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-40 max-w-2xl mx-auto w-full">
                {/* SECTION 1: ACCOUNT */}
                <Section title={t("settings.section.account")}>
                    <SettingsRow
                        icon={UserIcon}
                        iconColor="bg-blue-500"
                        label={t("nav.profile")}
                        value={user?.email || "User"}
                        onClick={() => setActiveModal('profile')}
                    />
                    <SettingsRow
                        icon={Star}
                        iconColor="bg-amber-500"
                        label={t("settings.pro.title")}
                        value={isPro ? t("settings.pro.active") : t("settings.pro.buy")}
                        onClick={() => setActiveModal('subscription')}
                    />
                </Section>

                {/* SECTION 2: APPEARANCE */}
                <Section title="Erscheinungsbild">
                    <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border-b border-[var(--border-color)] last:border-0 h-16">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-2xl flex items-center justify-center bg-indigo-500 shadow-lg">
                                {theme.mode === 'dark' ? <Moon size={18} className="text-white" /> : <Sun size={18} className="text-white" />}
                            </div>
                            <span className="font-medium text-[17px] text-[var(--text-color)]">Design</span>
                        </div>
                        <div className="flex bg-[var(--button-bg)] p-1 rounded-lg">
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme.mode === 'light' && mode !== 'system' ? 'bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                Hell
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme.mode === 'dark' && mode !== 'system' ? 'bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                Dunkel
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'system' ? 'bg-blue-500 text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
                            >
                                Auto
                            </button>
                        </div>
                    </div>
                </Section>

                {/* SECTION 3: PREFERENCES */}
                <Section>
                    <SettingsRow
                        icon={Scale}
                        iconColor="bg-green-500"
                        label="Präferenzen & Einheiten"
                        value=""
                        onClick={() => setActiveModal('preferences')}
                    />
                    <SettingsRow
                        icon={Bell}
                        iconColor="bg-orange-500"
                        label="Mitteilungen"
                        value=""
                        onClick={() => setActiveModal('notifications')}
                    />
                </Section>

                {/* SECTION 4: DATA & PRIVACY */}
                <Section title="Daten & Sicherheit">
                    <SettingsRow
                        icon={FileText}
                        iconColor="bg-blue-500"
                        label="Daten importieren"
                        onClick={() => {
                            window.dispatchEvent(
                                new CustomEvent("trainq:navigate", { detail: { path: "/import-csv" } })
                            );
                        }}
                    />
                    <SettingsRow
                        icon={CalendarX}
                        iconColor="bg-red-500"
                        label="Kalender leeren"
                        onClick={handleClearCalendarAction}
                        isDestructive
                    />
                    <SettingsRow
                        icon={Trash2}
                        iconColor="bg-red-500"
                        label="Verlauf löschen"
                        onClick={handleClearHistoryAction}
                        isDestructive
                    />
                </Section>

                {/* SECTION: INTEGRATIONS */}
                <Section title={t("settings.section.integrations", "Integrationen")}>
                    <SettingsRow
                        icon={Activity}
                        iconColor="bg-emerald-500"
                        label={t("settings.integrations.garmin")}
                        value={garminConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
                        onClick={() => setActiveModal('integrations')}
                    />
                </Section>

                {/* SECTION 5: LEGAL */}
                <Section title={t("settings.section.legal")}>
                    <SettingsRow icon={Building2} iconColor="bg-zinc-500" label="Impressum" onClick={() => setActiveModal('legal')} />
                    <SettingsRow icon={FileText} iconColor="bg-zinc-500" label="Datenschutzerklärung" onClick={() => setActiveModal('legal')} />
                    <SettingsRow icon={Info} iconColor="bg-blue-500" label="Über uns" onClick={() => setActiveModal('legal')} />
                    <SettingsRow icon={Mail} iconColor="bg-blue-500" label="Kontakt Support" onClick={() => setActiveModal('legal')} />
                </Section>

                {/* SECTION 6: DANGER ZONE */}
                <div className="px-2 space-y-4">
                    <button onClick={handleLogout} className="w-full h-14 bg-[var(--card-bg)] active:bg-[var(--button-bg)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center text-red-500 font-bold text-[17px] shadow-lg">
                        {t("settings.account.logout")}
                    </button>
                    <div className="text-center pt-4">
                        <p className="text-xs text-[var(--text-secondary)] opacity-40 font-mono">TrainQ v1.0.2 (Build 2026)</p>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

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
                                <span className="text-xs font-bold text-white">Edit</span>
                            </div>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-blue-400 text-sm font-medium"
                        >
                            Bild ändern
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
                        Deine Profildaten werden lokal und privat gespeichert. Sie helfen uns, dein Training zu personalisieren.
                    </div>
                    <div className="space-y-4">
                        <InputField label="Anzeigename" value={profileName} onChange={setProfileName} placeholder="Dein Name" />
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Gewicht" value={profileWeight} onChange={setProfileWeight} placeholder="0" type="number" suffix="kg" />
                            <InputField label="Größe" value={profileHeight} onChange={setProfileHeight} placeholder="0" type="number" suffix="cm" />
                        </div>
                    </div>
                    <button onClick={handleSaveProfile} className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]">
                        Speichern
                    </button>
                </div>
            </SettingsModal>

            {/* SUBSCRIPTION MODAL */}
            <SettingsModal isOpen={activeModal === 'subscription'} onClose={() => setActiveModal(null)} title={t("settings.pro.title")}>
                <div className="flex flex-col items-center text-center space-y-6 pt-6">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl ${isPro ? 'bg-amber-500' : 'bg-[var(--card-bg)] border border-[var(--border-color)]'}`}>
                        <Star size={40} className="text-white" fill={isPro ? "white" : "none"} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-[var(--text-color)] mb-2">{isPro ? "TrainQ Pro Aktiviert" : "Free Plan"}</h3>
                        <p className="text-[var(--text-secondary)] max-w-xs mx-auto">
                            {isPro
                                ? "Du hast Zugriff auf alle Premium-Funktionen. Dein Training kennt keine Grenzen."
                                : "Upgrade auf Pro für unbegrenzte Workouts, Statistiken und KI-Analysen."}
                        </p>
                    </div>

                    {!isPro && (
                        <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
                            <h4 className="font-bold text-amber-400 mb-2">Pro Vorteile:</h4>
                            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                                <li className="flex gap-2"><span>✨</span> Unbegrenzter Verlauf</li>
                                <li className="flex gap-2"><span>📈</span> Erweiterte Statistiken</li>
                                <li className="flex gap-2"><span>🤖</span> KI-Trainingspläne</li>
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={() => { setActiveModal(null); onOpenPaywall(); }}
                        className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] ${isPro ? 'bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)]' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'}`}
                    >
                        {isPro ? "Abo verwalten" : "Jetzt Upgraden"}
                    </button>

                    {isPro && <p className="text-xs text-[var(--text-secondary)]">Verwaltung läuft über deinen App Store Account.</p>}
                </div>
            </SettingsModal>

            {/* PREFERENCES MODAL */}
            <SettingsModal isOpen={activeModal === 'preferences'} onClose={() => setActiveModal(null)} title="App Einstellungen">
                <div className="space-y-4">


                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Interaktion</h3>
                        <div className="space-y-3">
                            <ToggleSwitch
                                label="Haptisches Feedback"
                                checked={hapticEnabled}
                                onChange={setHapticEnabled}
                                icon={Vibrate}
                            />
                            <ToggleSwitch
                                label="Töne & Soundeffekte"
                                checked={soundEnabled}
                                onChange={setSoundEnabled}
                                icon={Volume2}
                            />
                        </div>
                    </div>

                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Einheiten</h3>
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center opacity-70">
                            <span className="text-[var(--text-color)]">Gewichtseinheit</span>
                            <span className="text-[var(--text-secondary)] font-mono">KG (Metrisch)</span>
                        </div>
                    </div>

                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Anzeige</h3>
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Activity size={20} className="text-[var(--text-secondary)]" />
                                <span className="text-base font-medium text-[var(--text-color)]">Muskeldetail</span>
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
                                    Einfach
                                </button>
                                <button
                                    onClick={() => { setMuscleDetail("komplex"); setMuscleDetailMode("komplex"); }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                        muscleDetail === "komplex"
                                            ? "bg-blue-500 text-white shadow-sm"
                                            : "text-[var(--text-secondary)]"
                                    }`}
                                >
                                    Komplex
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-1 py-2 border-t border-[var(--border-color)] pt-6">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Aufwärmsätze</h3>
                        <div className="space-y-3">
                            <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
                                <span className="text-sm font-medium text-[var(--text-color)]">Stangengewicht</span>
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
                                <span className="text-sm font-medium text-[var(--text-color)]">Scheiben-Inkrement</span>
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
                                Stufen: Leere Stange, 50%, 70%, 85% des Arbeitsgewichts
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsModal>

            {/* NOTIFICATIONS MODAL */}
            <SettingsModal isOpen={activeModal === 'notifications'} onClose={() => setActiveModal(null)} title="Mitteilungen">
                <NotificationSettings />
            </SettingsModal>

            {/* LEGAL MODAL */}
            <SettingsModal isOpen={activeModal === 'legal'} onClose={() => setActiveModal(null)} title="Rechtliches & Hilfe">
                <div className="space-y-8">

                    {/* ABOUT US */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg">
                                Q
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-color)] text-lg">Über TrainQ</h3>
                                <p className="text-blue-400 text-xs font-medium">Vision & Mission</p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            TrainQ wurde entwickelt, um ambitionierten Athleten die Werkzeuge an die Hand zu geben, die sie für echte Fortschritte benötigen. Keine Ablenkungen, reiner Fokus auf Performance und Daten.
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            Wir glauben daran, dass Training eine Wissenschaft und eine Kunst zugleich ist. TrainQ verbindet beides in einer nahtlosen Erfahrung.
                        </p>
                    </div>

                    {/* CONTACT */}
                    <div className="border-t border-[var(--border-color)] pt-6 space-y-3">
                        <h3 className="font-bold text-[var(--text-color)] mb-2">Kontakt & Support</h3>
                        <div className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
                            <p className="text-[var(--text-secondary)] text-xs">
                                Hast du Fragen, Feedback oder benötigst Hilfe?
                            </p>
                            <a href="mailto:support@trainq.app" className="flex items-center justify-center w-full py-3 bg-blue-600/10 text-blue-400 font-bold rounded-xl text-sm hover:bg-blue-600/20 transition-colors gap-2">
                                <Mail size={16} />
                                support@trainq.app
                            </a>
                        </div>
                    </div>

                    {/* LEGAL LINKS */}
                    <div className="border-t border-[var(--border-color)] pt-6 space-y-4">
                        <h3 className="font-bold text-[var(--text-color)]">Rechtliches</h3>

                        {/* Impressum */}
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
                            <h4 className="font-bold text-[var(--text-color)] mb-2 flex items-center gap-2">
                                <Building2 size={16} className="text-[var(--text-secondary)]" /> Impressum
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
                                TrainQ Inc.<br />
                                Musterstraße 1<br />
                                10115 Berlin<br />
                                Deutschland<br /><br />
                                Vertreten durch: Julius<br />
                                Kontakt: admin@trainq.app
                            </p>
                        </div>

                        {/* Privacy */}
                        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
                            <h4 className="font-bold text-[var(--text-color)] mb-2 flex items-center gap-2">
                                <FileText size={16} className="text-[var(--text-secondary)]" /> Datenschutz
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] mb-4">
                                Deine Daten gehören dir. Wir speichern Trainingsdaten lokal auf deinem Gerät und nutzen Ende-zu-Ende Verschlüsselung für Backups.
                            </p>
                            <button onClick={() => window.open("/privacy", "_system")} className="w-full py-2 bg-[var(--button-bg)] text-[var(--text-color)] text-xs font-bold rounded-lg hover:bg-[var(--button-bg)]/80 transition-colors">
                                Datenschutzerklärung öffnen
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 pb-8 text-center">
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-50 font-mono uppercase tracking-widest">
                            © 2026 TrainQ Inc.
                        </p>
                    </div>
                </div>
            </SettingsModal>

            {/* GARMIN INTEGRATION MODAL */}
            <GarminIntegrationModal isOpen={activeModal === 'integrations'} onClose={() => setActiveModal(null)} />

        </div>
    );
};

export default SettingsPage;
