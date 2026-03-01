import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Theme } from "./types";
import { darkTheme, lightTheme } from "./tokens";

interface ThemeContextType {
    theme: Theme;
    mode: "dark" | "light" | "system";
    toggleTheme: () => void;
    setTheme: (mode: "dark" | "light" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. Initialize from storage or default to system
    const [mode, setMode] = useState<"dark" | "light" | "system">(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("trainq_theme");
            if (stored === "light" || stored === "dark" || stored === "system") {
                return stored as "dark" | "light" | "system";
            }
        }
        return "system";
    });

    // 2. Determine effective theme (dark/light) based on mode + system preference
    useEffect(() => {
        const applyTheme = () => {
            const body = document.body;
            let effectiveMode = mode;

            if (mode === "system") {
                const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                effectiveMode = systemDark ? "dark" : "light";
            }

            if (effectiveMode === "light") {
                body.classList.add("light-theme");
            } else {
                body.classList.remove("light-theme");
            }

            // Update meta theme-color for iOS status bar
            const metaThemeColor = document.querySelector("meta[name=theme-color]");
            if (metaThemeColor) {
                metaThemeColor.setAttribute("content", effectiveMode === "light" ? "#F2F2F7" : "#000000");
            }
        };

        applyTheme();

        // Listen for system changes if in system mode
        if (mode === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyTheme();
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        }

        localStorage.setItem("trainq_theme", mode);
    }, [mode]);

    // 3. Memoize theme object
    const theme = useMemo(() => {
        // Note used for JS-side access, doesn't reflect active system mode instantly in this simple implementation
        // but typically we rely on CSS vars. For JS logic that needs "isDark", we might want to expose effectiveMode.
        // For now, let's map 'system' to current system state for the initial render or just assume dark if uncertain.
        // Actually, better to separate "userChoice" from "effectiveTheme". 
        // But to keep it simple and given we use CSS variables, the JS object is less critical for styling.
        // Let's return the tokens that match the *current* state.

        let isLight = false;
        if (mode === 'light') isLight = true;
        else if (mode === 'system' && typeof window !== 'undefined') {
            isLight = !window.matchMedia("(prefers-color-scheme: dark)").matches;
        }

        return isLight ? lightTheme : darkTheme;
    }, [mode]);

    const toggleTheme = () => {
        setMode((prev) => {
            if (prev === 'dark') return 'light';
            if (prev === 'light') return 'system';
            return 'dark';
        });
    };

    const handleSetTheme = (newMode: "dark" | "light" | "system") => {
        setMode(newMode);
    };

    return (
        <ThemeContext.Provider value={{ theme, mode, toggleTheme, setTheme: handleSetTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
