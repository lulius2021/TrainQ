import React from "react";
import { twMerge } from "tailwind-merge";

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
    const baseStyles = "rounded-2xl transition-all duration-200";

    const variants = {
        glass: "bg-white/10 backdrop-blur-xl border-[1.5px] border-white/10 shadow-sm",
        solid: "bg-[var(--surface2)] backdrop-blur-lg border border-[var(--border)]",
        transparent: "bg-transparent border-0",
        soft: "bg-[var(--surface)] backdrop-blur-md border border-[var(--border)]",
    };

    return (
        <div
            className={twMerge(
                baseStyles,
                variants[variant],
                !noPadding && "p-4", // Default padding if not disabled
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
