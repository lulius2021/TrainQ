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
        glass: "bg-zinc-800/60 backdrop-blur-xl border border-zinc-800 shadow-sm",
        solid: "bg-zinc-800 backdrop-blur-lg border border-zinc-800",
        transparent: "bg-transparent border-0",
        soft: "bg-zinc-800 backdrop-blur-md border border-zinc-800",
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
