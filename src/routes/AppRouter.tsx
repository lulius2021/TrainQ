import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import { Onboarding } from "../components/Onboarding";
import MainAppShell from "../components/MainAppShell";

export const AppRouter: React.FC = () => {
    const { user, loading } = useAuth();
    const [authScreen, setAuthScreen] = useState<"login" | "register" | "forgot">("login");

    // Route Guard: Sync URL with State
    useEffect(() => {
        if (loading || !user) return;

        const needsOnboarding = user.onboardingCompleted === false;
        const path = window.location.pathname;

        if (needsOnboarding && path !== "/onboarding") {
            window.history.replaceState(null, "", "/onboarding");
        } else if (!needsOnboarding && path === "/onboarding") {
            window.history.replaceState(null, "", "/");
        }
    }, [user?.onboardingCompleted, loading, !!user]);

    // 0. Loading State
    if (loading) {
        return <LoadingScreen />;
    }

    // 1. Not Authenticated
    if (!user) {
        if (authScreen === "register") {
            return <RegisterPage onGoToLogin={() => setAuthScreen("login")} />;
        }
        if (authScreen === "forgot") {
            return <ForgotPasswordPage onGoBackToLogin={() => setAuthScreen("login")} />;
        }
        return (
            <LoginPage
                onGoToRegister={() => setAuthScreen("register")}
                onGoToForgotPassword={() => setAuthScreen("forgot")}
            />
        );
    }

    // 2. Onboarding Required
    if (user.onboardingCompleted === false) {
        return <Onboarding />;
    }

    // 3. Main App (Authenticated & Onboarded)
    return <MainAppShell />;
};
