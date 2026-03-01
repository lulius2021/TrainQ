import type { Theme } from "./types";

export const darkTheme: Theme = {
    mode: "dark",
    colors: {
        background: "var(--bg-color)",
        card: "var(--card-bg)",
        text: "var(--text-color)",
        textSecondary: "var(--text-secondary)",
        primary: "var(--accent-color)",
        border: "var(--border-color)",
        tabBar: "var(--tab-bar-bg)",
        inputBackground: "var(--input-bg)",
        gridLines: "var(--border-color)",
        success: "var(--success)",
        successTransparent: "rgba(52, 199, 89, 0.2)",
        danger: "var(--danger)",
        dangerTransparent: "rgba(255, 59, 48, 0.2)",
    },
};

export const lightTheme: Theme = {
    mode: "light",
    colors: {
        background: "var(--bg-color)",
        card: "var(--card-bg)",
        text: "var(--text-color)",
        textSecondary: "var(--text-secondary)",
        primary: "var(--accent-color)",
        border: "var(--border-color)",
        tabBar: "var(--tab-bar-bg)",
        inputBackground: "var(--input-bg)",
        gridLines: "var(--border-color)",
        success: "var(--success)",
        successTransparent: "rgba(52, 199, 89, 0.15)",
        danger: "var(--danger)",
        dangerTransparent: "rgba(255, 59, 48, 0.15)",
    },
};
