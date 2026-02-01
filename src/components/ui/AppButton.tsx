import React from "react";
import { twMerge } from "tailwind-merge";

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
    isLoading?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
    children,
    className,
    variant = "primary",
    size = "md",
    fullWidth = false,
    isLoading = false,
    disabled,
    ...props
}) => {
    const baseStyles = "relative inline-flex items-center justify-center font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl";

    const variants = {
        primary: "bg-blue-600/90 text-white shadow-lg shadow-blue-500/20 backdrop-blur-xl border border-white/10 hover:opacity-90 active:scale-[0.98]",
        secondary: "bg-zinc-800 text-white border border-zinc-700 backdrop-blur-md hover:bg-zinc-700 hover:border-zinc-600",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-[1.5px] border-red-500/20",
        ghost: "bg-transparent text-blue-500 hover:bg-zinc-800",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-[15px]",
        md: "px-5 py-3 text-[17px]",
        lg: "px-6 py-4 text-[19px]",
    };

    return (
        <button
            className={twMerge(
                baseStyles,
                variants[variant],
                sizes[size],
                fullWidth ? "w-full" : "",
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </span>
            ) : (
                children
            )}
        </button>
    );
};
