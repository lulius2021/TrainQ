import React from "react";
import logo from "../../assets/logos/logo.png";

export const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-color)]">
            <img
                src={logo}
                alt="TrainQ"
                className="h-20 w-20 animate-spin"
                style={{ animationDuration: "1.5s" }}
            />
        </div>
    );
};
