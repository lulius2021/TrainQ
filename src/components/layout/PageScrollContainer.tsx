// PageScrollContainer — the standard scroll wrapper for all tab pages and modal content.
//
// Responsibilities:
//   1. Provides the correct scroll container: h-full, overflow-y-auto, scroll-pb
//   2. Toggles .is-scrolled on itself when scrollTop crosses 10px — zero React state,
//      direct DOM mutation. CSS then transitions .page-nav-bar surface automatically.
//   3. Exposes scrollToTop() via forwardRef for the tab bar active-tap handler.
//
// Usage:
//   const scrollRef = useRef<PageScrollContainerHandle>(null);
//   <PageScrollContainer ref={scrollRef}>
//     <PageNavBar mode="large" title="Dashboard" />
//     {content}
//   </PageScrollContainer>
//
// Scroll-to-top from tab bar:
//   scrollRef.current?.scrollToTop();

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ReactNode } from "react";

export interface PageScrollContainerHandle {
    scrollToTop: () => void;
}

interface Props {
    children: ReactNode;
    /** Additional Tailwind classes. Applied alongside the base scroll classes. */
    className?: string;
}

export const PageScrollContainer = forwardRef<PageScrollContainerHandle, Props>(
    ({ children, className }, ref) => {
        const divRef = useRef<HTMLDivElement>(null);
        // Tracks current state to prevent redundant DOM mutations on every scroll event.
        const scrolledRef = useRef(false);

        useImperativeHandle(ref, () => ({
            scrollToTop() {
                divRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            },
        }));

        const handleScroll = () => {
            const scrolled = (divRef.current?.scrollTop ?? 0) > 10;
            // Only act when crossing the threshold — not on every pixel.
            if (scrolled === scrolledRef.current) return;
            scrolledRef.current = scrolled;
            divRef.current?.classList.toggle("is-scrolled", scrolled);
        };

        return (
            <div
                ref={divRef}
                onScroll={handleScroll}
                className={`h-full overflow-y-auto overflow-x-hidden scroll-pb${className ? ` ${className}` : ""}`}
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                {children}
            </div>
        );
    }
);

PageScrollContainer.displayName = "PageScrollContainer";
