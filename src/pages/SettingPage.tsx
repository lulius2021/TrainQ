// --- IMPORTS ---
import React, { useState, useEffect } from "react";
import { useI18n } from "../i18n/useI18n";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    User as UserIcon,
    Star,
    Globe,
    Scale,
    Moon,
    LifeBuoy,
    Shield,
    ChevronRight,
    X,
    ChevronLeft,
    Check,
    Volume2,
    Vibrate
} from "lucide-react";
import { useEntitlements } from "../hooks/useEntitlements";
import { readOnboardingDataFromStorage, writeOnboardingDataToStorage } from "../context/OnboardingContext";
import { addWorkoutEntry } from "../utils/workoutHistory";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

// --- TYPES ---
type SettingsRowProps = {
    icon: React.ElementType;
    iconColor: string;
    label: string;
    value?: string;
    onClick?: () => void;
    isDestructive?: boolean;
};

type ModalType = 'profile' | 'subscription' | 'preferences' | 'legal' | null;

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
            className="w-full flex items-center justify-between p-4 bg-[#1c1c1e] active:bg-[#2c2c2e] transition-colors border-b border-white/5 last:border-0 h-14 group"
        >
            <div className="flex items-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 ${iconColor} shadow-lg`}>
                    <Icon size={18} className="text-white" />
                </div>
                <span className={`font-medium text-[17px] ${isDestructive ? 'text-red-500' : 'text-white'}`}>
                    {label}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {value && (
                    <span className="text-[17px] text-white/50">{value}</span>
                )}
                {!isDestructive && (
                    <ChevronRight size={20} className="text-white/20 group-hover:text-white/40 transition-colors" />
                )}
            </div>
        </button>
    );
};

// 2. Section Container
const Section: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        {title && (
            <h3 className="text-[13px] uppercase tracking-wider text-white/40 font-semibold mb-2 pl-4">
                {title}
            </h3>
        )}
        <div className="rounded-2xl overflow-hidden border border-white/5">
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
                        className="fixed inset-x-0 bottom-0 z-[70] h-[92vh] rounded-t-[32px] bg-[#1c1c1e] overflow-hidden flex flex-col border-t border-white/10 shadow-2xl"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1c1c1e] z-10">
                            <h2 className="text-xl font-bold text-white">{title}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 bg-white/10 rounded-full hover:bg-white/20 text-white/60 hover:text-white transition-colors"
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
    <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
            {Icon && <Icon size={20} className="text-zinc-400" />}
            <span className="text-base font-medium text-white">{label}</span>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-7 rounded-full relative transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-zinc-700'}`}
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
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            {suffix && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
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
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all border border-transparent ${lang === opt.code
                            ? "bg-blue-600 text-white font-bold border-blue-400/30"
                            : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border-white/5"
                            }`}
                    >
                        <span className="flex items-center gap-2" dangerouslySetInnerHTML={{ __html: opt.label }} />
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
const generateDemoHistory = () => {
    // ... (Use existing logic or placeholder to save space if needed, copying logic for robustness)
    const exercisesList = [
        { name: "Bankdrücken", muscle: "Brust" }, { name: "Kniebeugen", muscle: "Beine" },
        { name: "Kreuzheben", muscle: "Rücken" }, { name: "Schulterdrücken", muscle: "Schulter" }
    ];
    const now = new Date();
    const entries: any[] = [];
    for (let w = 0; w < 12; w++) { // 12 Weeks
        const sessions = 2 + Math.floor(Math.random() * 2);
        for (let s = 0; s < sessions; s++) {
            const dayOffset = (w * 7) + (s * 2);
            if (dayOffset === 0) continue;
            const date = new Date(now);
            date.setDate(date.getDate() - dayOffset);
            const duration = 2700 + Math.floor(Math.random() * 1000);
            entries.push({
                title: "Workout", sport: "Gym", startedAt: date.toISOString(),
                endedAt: new Date(date.getTime() + duration * 1000).toISOString(),
                durationSec: duration, exercises: [{ name: "Bankdrücken", sets: [{ reps: 10, weight: 60 }] }]
            });
        }
    }
    return entries;
};

const SettingsPage: React.FC<Props> = ({ onBack, onClearCalendar, onOpenPaywall, onOpenGoals }) => {
    const { t, lang } = useI18n();
    const { user, logout } = useAuth();
    const { isPro } = useEntitlements(user?.id);

    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [showLangModal, setShowLangModal] = useState(false);

    // -- Profile State --
    const [profileName, setProfileName] = useState("");
    const [profileWeight, setProfileWeight] = useState("");
    const [profileHeight, setProfileHeight] = useState("");

    // -- Preferences State --
    const [hapticEnabled, setHapticEnabled] = useState(true);
    const [darkModeForce, setDarkModeForce] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Initial Load
    useEffect(() => {
        // Load Profile
        const data = readOnboardingDataFromStorage();
        setProfileName(data.profile.username || "");
        setProfileWeight(data.personal.weight ? String(data.personal.weight) : "");
        setProfileHeight(data.personal.height ? String(data.personal.height) : "");

        // Load Preferences
        const storedHaptic = localStorage.getItem("trainq_pref_haptic");
        if (storedHaptic !== null) setHapticEnabled(storedHaptic === "true");

        const storedDark = localStorage.getItem("trainq_pref_dark");
        if (storedDark !== null) setDarkModeForce(storedDark === "true");

        const storedSound = localStorage.getItem("trainq_pref_sound");
        if (storedSound !== null) setSoundEnabled(storedSound === "true");

    }, []);

    // Persist Preferences
    useEffect(() => { localStorage.setItem("trainq_pref_haptic", String(hapticEnabled)); }, [hapticEnabled]);
    useEffect(() => { localStorage.setItem("trainq_pref_dark", String(darkModeForce)); }, [darkModeForce]);
    useEffect(() => { localStorage.setItem("trainq_pref_sound", String(soundEnabled)); }, [soundEnabled]);

    const handleSaveProfile = () => {
        const current = readOnboardingDataFromStorage();
        const updated = {
            ...current,
            profile: { ...current.profile, username: profileName },
            personal: {
                ...current.personal,
                weight: parseFloat(profileWeight) || null,
                height: parseFloat(profileHeight) || null
            }
        };
        writeOnboardingDataToStorage(updated);
        setActiveModal(null);
    };

    const handleLogout = async () => {
        if (confirm(t("settings.confirm.logout"))) {
            await logout();
        }
    };

    const handleSeedData = () => {
        if (!confirm("Generiere Demo-Daten?")) return;
        const history = generateDemoHistory();
        history.forEach(entry => addWorkoutEntry(entry));
        alert("Daten generiert.");
    };

    return (
        <div className="min-h-screen bg-transparent pb-40">

            {/* HEADER */}
            <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-6">
                <div className="flex items-center mb-2">
                    <button onClick={onBack} className="p-2 -ml-3 rounded-full hover:bg-white/10 transition-colors text-white">
                        <ChevronLeft size={32} />
                    </button>
                </div>
                <div className="flex justify-between items-end">
                    <h1 className="text-4xl font-bold text-white tracking-tight">{t("settings.title")}</h1>
                    {isPro && (
                        <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-black text-[10px] font-black px-2 py-1 rounded-md mb-2 shadow-lg shadow-amber-500/20">
                            PRO
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 max-w-2xl mx-auto">
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

                {/* SECTION 2: PREFERENCES */}
                <Section title={t("settings.title")}>
                    <SettingsRow
                        icon={Scale}
                        iconColor="bg-green-500"
                        label="Einheiten & App"
                        value=""
                        onClick={() => setActiveModal('preferences')}
                    />
                </Section>

                {/* SECTION 3: LEGAL */}
                <Section title={t("settings.section.legal")}>
                    <SettingsRow
                        icon={Shield}
                        iconColor="bg-zinc-500"
                        label={t("settings.section.legal")}
                        onClick={() => setActiveModal('legal')}
                    />
                </Section>

                {/* SECTION 4: DANGER ZONE */}
                <div className="mt-8 px-2 space-y-4">
                    <button onClick={handleSeedData} className="w-full p-4 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 text-sm font-medium hover:bg-blue-500/20 transition-colors">
                        🛠️ Generate Demo Data (Review)
                    </button>
                    <button onClick={handleLogout} className="w-full h-14 bg-[#1c1c1e] active:bg-[#2c2c2e] rounded-2xl border border-white/5 flex items-center justify-center text-red-500 font-bold text-[17px] shadow-lg">
                        {t("settings.account.logout")}
                    </button>
                    <div className="text-center pt-4">
                        <p className="text-xs text-white/20 font-mono">TrainQ v1.0.2 (Build 2026)</p>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* PROFILE MODAL */}
            <SettingsModal isOpen={activeModal === 'profile'} onClose={() => setActiveModal(null)} title={t("nav.profile")}>
                <div className="space-y-6">
                    <div className="flex items-center justify-center py-4">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                            {profileName.slice(0, 2).toUpperCase() || "TQ"}
                        </div>
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-sm">
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
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl ${isPro ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                        <Star size={40} className="text-white" fill={isPro ? "white" : "none"} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">{isPro ? "TrainQ Pro Aktiviert" : "Free Plan"}</h3>
                        <p className="text-zinc-400 max-w-xs mx-auto">
                            {isPro
                                ? "Du hast Zugriff auf alle Premium-Funktionen. Dein Training kennt keine Grenzen."
                                : "Upgrade auf Pro für unbegrenzte Workouts, Statistiken und KI-Analysen."}
                        </p>
                    </div>

                    {!isPro && (
                        <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
                            <h4 className="font-bold text-amber-400 mb-2">Pro Vorteile:</h4>
                            <ul className="space-y-2 text-sm text-zinc-300">
                                <li className="flex gap-2"><span>✨</span> Unbegrenzter Verlauf</li>
                                <li className="flex gap-2"><span>📈</span> Erweiterte Statistiken</li>
                                <li className="flex gap-2"><span>🤖</span> KI-Trainingspläne</li>
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={() => { setActiveModal(null); onOpenPaywall(); }}
                        className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] ${isPro ? 'bg-zinc-800 text-white border border-white/10' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'}`}
                    >
                        {isPro ? "Abo verwalten" : "Jetzt Upgraden"}
                    </button>

                    {isPro && <p className="text-xs text-zinc-500">Verwaltung läuft über deinen App Store Account.</p>}
                </div>
            </SettingsModal>

            {/* PREFERENCES MODAL */}
            <SettingsModal isOpen={activeModal === 'preferences'} onClose={() => setActiveModal(null)} title="App Einstellungen">
                <div className="space-y-4">
                    <div className="px-1 py-2">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Erscheinungsbild</h3>
                        <ToggleSwitch
                            label="Dunkelmodus erzwingen"
                            checked={darkModeForce}
                            onChange={setDarkModeForce}
                            icon={Moon}
                        />
                        <p className="text-xs text-zinc-500 mt-2 px-2">TrainQ ist für Dark Mode optimiert. Deaktivieren führt zum System-Standard (nicht empfohlen).</p>
                    </div>

                    <div className="px-1 py-2 border-t border-white/5 pt-6">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Interaktion</h3>
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

                    <div className="px-1 py-2 border-t border-white/5 pt-6">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Einheiten</h3>
                        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/5 flex justify-between items-center opacity-70">
                            <span className="text-white">Gewichtseinheit</span>
                            <span className="text-zinc-400 font-mono">KG (Metrisch)</span>
                        </div>
                    </div>
                </div>
            </SettingsModal>

            {/* LEGAL MODAL */}
            <SettingsModal isOpen={activeModal === 'legal'} onClose={() => setActiveModal(null)} title="Rechtliches & Hilfe">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-white">Support</h3>
                        <p className="text-zinc-400 text-sm">Probleme oder Feedback? Wir helfen gerne weiter.</p>
                        <a href="mailto:support@trainq.app" className="block w-full text-center py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors">
                            support@trainq.app
                        </a>
                    </div>

                    <div className="border-t border-white/5 pt-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">Rechtliches</h3>
                        <div className="space-y-2">
                            <div className="p-4 bg-zinc-900 rounded-xl border border-white/5">
                                <h4 className="font-bold text-white mb-1">Impressum</h4>
                                <p className="text-xs text-zinc-500">
                                    TrainQ Inc.<br />
                                    Musterstraße 1<br />
                                    10115 Berlin<br />
                                    Vertreten durch: Julius
                                </p>
                            </div>
                            <div className="p-4 bg-zinc-900 rounded-xl border border-white/5">
                                <h4 className="font-bold text-white mb-1">Datenschutz</h4>
                                <p className="text-xs text-zinc-500 mb-3">
                                    Wir speichern Daten lokal auf deinem Gerät. Backups erfolgen verschlüsselt in der Cloud.
                                </p>
                                <button onClick={() => window.open("/privacy", "_system")} className="text-blue-400 text-xs font-bold hover:underline">
                                    Vollständige Erklärung lesen
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/5 pt-6">
                        <p className="text-center text-xs text-zinc-600">
                            © 2026 TrainQ. All rights reserved.
                        </p>
                    </div>
                </div>
            </SettingsModal>

        </div>
    );
};

export default SettingsPage;
