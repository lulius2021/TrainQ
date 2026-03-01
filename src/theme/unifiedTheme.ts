export const unifiedTheme = {
    colors: {
        primary: "#007AFF", // Apple Blue
        background: {
            light: "#F5F5F7", // Apple light gray
            dark: "#000000",
        },
        surface: {
            light: "rgba(255, 255, 255, 0.8)",
            dark: "rgba(255, 255, 255, 0.05)",
        },
        text: {
            primary: {
                light: "#000000",
                dark: "#FFFFFF",
            },
            secondary: {
                light: "rgba(60, 60, 67, 0.6)",
                dark: "rgba(235, 235, 245, 0.6)",
            },
        },
    },
    layout: {
        padding: "16px", // px-4
        radius: "16px", // rounded-2xl
        headerHeight: "60px", // Collapsing Large Title base
        navHeight: "var(--nav-height, 88px)",
    },
    typography: {
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
        letterSpacing: "-0.4px",
    },
    effects: {
        blur: "backdrop-blur-xl",
        border: "border border-white/10",
    },
} as const;

export type UnifiedTheme = typeof unifiedTheme;
