import React from "react";
import { clsx } from "clsx";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger";
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
    onClick,
    disabled,
    ...props
}) => {
    const handleHaptic = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) {
            // Ignore haptics error on web/unsupported
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled && !isLoading) {
            handleHaptic();
            onClick?.(e);
        }
    };

    const baseStyles =
        "relative inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-2xl";

    const variants = {
        primary: "bg-[var(--primary)] text-white shadow-lg shadow-blue-500/20 active:bg-blue-600",
        secondary: "bg-[var(--surface2)] text-[var(--text)] active:bg-gray-200 dark:active:bg-slate-700",
        ghost: "bg-transparent text-[var(--primary)] hover:bg-[var(--primary)]/10",
        danger: "bg-red-500 text-white shadow-lg shadow-red-500/20 active:bg-red-600",
    };

    const sizes = {
        sm: "h-9 px-4 text-sm",
        md: "h-12 px-6 text-[17px]", // Standard Apple-like height and size
        lg: "h-14 px-8 text-lg",
    };

    return (
        <button
            className={clsx(
                baseStyles,
                variants[variant],
                sizes[size],
                fullWidth && "w-full",
                className
            )}
            onClick={handleClick}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="animate-spin mr-2 h-5 w-5 border-2 border-white/30 border-t-white rounded-full block" />
            ) : null}
            {children}
        </button>
    );
};
