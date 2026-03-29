import React from "react";
const logo = "/logo.png";

export const LoadingScreen: React.FC = () => {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--bg-color)",
                gap: 0,
            }}
        >
            <style>{`
                @keyframes tq-logo-in {
                    0%   { opacity: 0; transform: scale(0.78); }
                    60%  { opacity: 1; transform: scale(1.04); }
                    100% { opacity: 1; transform: scale(1.0); }
                }
                @keyframes tq-glow-pulse {
                    0%, 100% { opacity: 0.18; transform: scale(1); }
                    50%       { opacity: 0.38; transform: scale(1.15); }
                }
                @keyframes tq-wordmark-in {
                    0%   { opacity: 0; transform: translateY(6px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes tq-bar-fill {
                    0%   { width: 0%; }
                    60%  { width: 80%; }
                    100% { width: 100%; }
                }
            `}</style>

            {/* Glow ring behind logo */}
            <div
                style={{
                    position: "absolute",
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, #0A84FF55 0%, transparent 70%)",
                    animation: "tq-glow-pulse 2s ease-in-out infinite",
                    animationDelay: "0.3s",
                }}
            />

            {/* Logo */}
            <img
                src={logo}
                alt="TrainQ"
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: 20,
                    animation: "tq-logo-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                    opacity: 0,
                    position: "relative",
                }}
            />

            {/* Wordmark */}
            <span
                style={{
                    marginTop: 16,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.5px",
                    color: "var(--text-color)",
                    animation: "tq-wordmark-in 0.4s ease forwards",
                    animationDelay: "0.35s",
                    opacity: 0,
                    position: "relative",
                }}
            >
                TrainQ
            </span>

            {/* Progress bar */}
            <div
                style={{
                    position: "absolute",
                    bottom: "calc(env(safe-area-inset-bottom) + 40px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 120,
                    height: 3,
                    borderRadius: 99,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        borderRadius: 99,
                        background: "linear-gradient(90deg, #0A84FF, #34AADC)",
                        animation: "tq-bar-fill 1.8s cubic-bezier(0.4,0,0.2,1) forwards",
                        animationDelay: "0.1s",
                        width: 0,
                    }}
                />
            </div>
        </div>
    );
};
