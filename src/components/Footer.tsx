import { useTranslation } from "react-i18next";

function push(path: string) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Footer() {
    const { t } = useTranslation();

    const handleNav = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        push(path);
    };

    return (
        <footer className="w-full py-8 px-4 mt-8 border-t border-[var(--border)] text-center text-sm opacity-60">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
                <a href="/impressum" onClick={(e) => handleNav(e, "/impressum")} className="hover:underline hover:text-[var(--primary)] transition-colors">
                    Impressum
                </a>
                <a href="/privacy" onClick={(e) => handleNav(e, "/privacy")} className="hover:underline hover:text-[var(--primary)] transition-colors">
                    {t("settings.legal.tab.privacy")}
                </a>
                <a href="/terms" onClick={(e) => handleNav(e, "/terms")} className="hover:underline hover:text-[var(--primary)] transition-colors">
                    {t("settings.legal.tab.terms")}
                </a>
            </div>
            <p className="text-xs">
                &copy; {new Date().getFullYear()} TrainQ. All rights reserved.
            </p>
        </footer>
    );
}
