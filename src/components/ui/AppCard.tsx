import React from "react";
import { clsx } from "clsx";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "soft" | "glass";
    noPadding?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
    children,
    className,
    variant = "default",
    noPadding = false,
    ...props
}) => {
    const baseStyles = "rounded-2xl border transition-all duration-200 overflow-hidden";

    const variants = {
        default: "bg-[var(--surface)] border-[var(--border)]", // Using CSS variables for theme-aware colors
        soft: "bg-[var(--surface2)] border-transparent",
        glass: "bg-white/5 backdrop-blur-xl border-[1.5px] border-white/10", // Explicit glassmorphism override
    };

    return (
        <div
            className={clsx(
                baseStyles,
                variants[variant],
                !noPadding && "p-4",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
