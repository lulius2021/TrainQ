import React from "react";
import { twMerge } from "tailwind-merge";
import { useTheme } from "../../context/ThemeContext";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: "glass" | "solid" | "transparent" | "soft";
    noPadding?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
    children,
    className,
    variant = "glass",
    noPadding = false,
    ...props
}) => {
    const baseClasses = "rounded-2xl transition-all duration-200 border shadow-sm";
    const glassStyle = {
        backgroundColor: "var(--card-bg)", // Using card-bg as requested, can be semi-transparent if defined in CSS, or solid white/dark
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "var(--border-color)",
    };

    const solidStyle = {
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--border-color)",
    };

    const transparentStyle = {
        backgroundColor: "transparent",
        borderWidth: 0,
    };

    let style = {};
    if (variant === 'glass') style = glassStyle;
    else if (variant === 'solid') style = solidStyle;
    else if (variant === 'transparent') style = transparentStyle;
    else if (variant === 'soft') style = { ...solidStyle, opacity: 0.9 }; // Soft variant

    return (
        <div
            className={twMerge(
                baseClasses,
                !noPadding && "p-4",
                className
            )}
            style={{
                ...style,
                // Ensure text color inherits from theme if not overridden
                color: "var(--text-color)",
            }}
            {...props}
        >
            {children}
        </div>
    );
};
