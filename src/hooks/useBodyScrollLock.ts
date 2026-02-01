import { useLayoutEffect } from 'react';

export const useBodyScrollLock = (isLocked: boolean) => {
    useLayoutEffect(() => {
        if (!isLocked) return;

        // 1. Aktuelle Position speichern
        const originalStyle = window.getComputedStyle(document.body).overflow;
        const scrollY = window.scrollY;

        // 2. Body einfrieren (Der iOS Hack)
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';

        // 3. Cleanup beim Schließen
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = originalStyle;
            // Sofort zurückspringen
            window.scrollTo(0, scrollY);
        };
    }, [isLocked]);
};
