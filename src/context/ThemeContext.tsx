
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Theme, ColorTokens } from "../theme/types";
import { darkTheme, lightTheme } from "../theme/tokens";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (mode: "dark" | "light" | "system") => void;
    mode: "dark" | "light" | "system";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to dark for safety as requested
    const [mode, setMode] = useState<"dark" | "light" | "system">("dark");
    const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

    // Initialize system theme listener
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? "dark" : "light");
        };

        // Set initial
        setSystemTheme(mediaQuery.matches ? "dark" : "light");

        // Listen
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // Memoize the theme object to prevent unnecessary re-renders (CRITICAL REQUIREMENT)
    const theme = useMemo(() => {
        // Resolve effective mode
        const effectiveMode = mode === "system" ? systemTheme : mode;
        const baseTheme = effectiveMode === "dark" ? darkTheme : lightTheme;

        // Apply global class to body for CSS variables
        if (typeof document !== "undefined") {
            if (effectiveMode === "light") {
                document.body.classList.add("light-theme");
                document.body.classList.remove("dark-theme");
            } else {
                document.body.classList.add("dark-theme");
                document.body.classList.remove("light-theme");
            }

            // Explicit Auto-Logic Enforcement as requested
            if (mode === 'system') {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.body.classList.toggle('light-theme', !isDark);
                document.body.classList.toggle('dark-theme', isDark);
            }
        }

        // Safety Logic: Proxy for colors to prevent crashes if a token is missing
        // If the system cannot find a color or an error occurs, force return the value from darkTheme (Fallback-Strategy)
        const safeColors = new Proxy(baseTheme.colors, {
            get(target, prop: string | symbol) {
                // If property exists on target (lightTheme), return it
                if (prop in target) {
                    const value = target[prop as keyof ColorTokens];
                    if (value) return value;
                }

                // Fallback to darkTheme
                return darkTheme.colors[prop as keyof ColorTokens];
            }
        });

        return {
            ...baseTheme,
            colors: safeColors
        };
    }, [mode, systemTheme]);

    const toggleTheme = () => {
        setMode((prev) => {
            if (prev === "system") return "light"; // Cycle system -> light -> dark
            return prev === "dark" ? "light" : "dark";
        });
    };

    const handleSetTheme = (newMode: "dark" | "light" | "system") => {
        setMode(newMode);
    };

    // Status-Bar Protection
    useEffect(() => {
        // Safe Update of meta theme-color tag for PWA/Web
        const metaThemeColor = document.querySelector("meta[name=theme-color]");
        if (metaThemeColor) {
            metaThemeColor.setAttribute("content", theme.colors.background);
        }

        // Logic for iOS/Android status bar style if using Capacitor
        // Since @capacitor/status-bar is not explicitly available, we rely on web meta tags primarily.
        // However, if the plugin becomes available later, this hook is where the logic belongs.
        // For now, we simulate the behavior by setting the document background color to match the theme background.
        document.body.style.backgroundColor = theme.colors.background;

        // Note: Actual native status bar color change requires @capacitor/status-bar plugin.
        // If installed: StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light });
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: handleSetTheme, mode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        // SAFETY: Return default dark theme structure if provider is missing
        // This prevents crashes in error boundaries or race conditions
        return {
            theme: { mode: "dark", colors: darkTheme.colors },
            toggleTheme: () => { },
            setTheme: () => { }
        } as any;
    }
    return context;
};
