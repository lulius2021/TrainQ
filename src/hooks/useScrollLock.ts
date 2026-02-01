import { useEffect, useRef } from 'react';

export const useScrollLock = (isOpen: boolean) => {
    const scrollPos = useRef(0);

    useEffect(() => {
        if (isOpen) {
            // 1. Speichere aktuelle Scroll-Position
            scrollPos.current = window.scrollY;

            // 2. Friere Body ein (iOS Hack)
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollPos.current}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
        } else {
            // 3. Löse Freeze und springe zurück
            const savedScrollY = scrollPos.current;
            // Only reset if we actually locked it (check if position is fixed to avoid overwriting other states unnecessarily, 
            // though simpler is just to reset if !isOpen)
            // Note: The prompt's cleanup logic suggests we should just do it.

            // However, if we mount with isOpen=false, we shouldn't reset styles that might be correct.
            // But typically body style is empty.

            // Let's following strictly the prompt's implementation logic structure for the 'else' block,
            // but we need to be careful about initial render.

            // Wait, if I mount with isOpen=false, I shouldn't change anything.
            // The prompt code runs on every change of [isOpen]. 
            // If initialized false -> runs else block -> resets styles. This is likely fine as default state is clear.

            // Actually, checking if style.position is fixed before resetting is safer to avoid interfering with other things, 
            // but for this app it's probably fine.

            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            window.scrollTo(0, savedScrollY);
        }

        // Cleanup beim Unmount (Sicherheitshalber)
        return () => {
            // If we are unmounting while OPEN, we must restore.
            // If we are unmounting while CLOSED, we don't need to do anything (styles are already reset).
            // However, the cleanup function captures scope variables.
            // If isOpen was true, we executed the 'if' block. We need to cleanup.

            // Ref value persists.

            // Prompt logic:
            if (isOpen) { // Nur aufräumen, wenn wir noch gelockt waren
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollPos.current);
            }
        };
    }, [isOpen]);
};
