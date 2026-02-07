
import { useEffect, useState } from "react";

export function useSafeAreaInsets() {
    const [insets, setInsets] = useState({ top: 47, bottom: 34, left: 0, right: 0 });

    useEffect(() => {
        // Simple detection for web/PWA context
        // Relying on CSS env variables is hard in JS, so we use a safe default for iOS Notch devices
        // Ideally we would read this from Capacitor SafeArea plugin if installed
        // For now, hardcode iPhone-like safe areas as default for consistent "app-like" feel

        // Potential enhancement: Read from CSS custom properties if set by global CSS
        const rootStyle = getComputedStyle(document.documentElement);
        const sat = rootStyle.getPropertyValue("--sat");
        const sab = rootStyle.getPropertyValue("--sab");

        if (sat && sab) {
            setInsets({
                top: parseInt(sat, 10) || 47,
                bottom: parseInt(sab, 10) || 34,
                left: 0,
                right: 0
            });
        }
    }, []);

    return insets;
}
