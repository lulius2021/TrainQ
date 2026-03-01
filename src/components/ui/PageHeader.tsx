import React from "react";
import { twMerge } from "tailwind-merge";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
    className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    leftAction,
    rightAction,
    className,
}) => {
    return (
        <div className={twMerge("pt-0 pb-6 px-1 flex items-end justify-between", className)}>
            <div className="flex items-center gap-3">
                {leftAction && (
                    <div className="pb-1">{leftAction}</div>
                )}
                <div>
                    <h1
                        className="text-[34px] font-bold tracking-tight leading-tight"
                        style={{ letterSpacing: "-0.02em", color: "var(--text-color)" }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-[17px] mt-1 font-medium leading-relaxed" style={{ color: "var(--text-muted)" }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {rightAction && (
                <div className="pb-2">
                    {rightAction}
                </div>
            )}
        </div>
    );
};
