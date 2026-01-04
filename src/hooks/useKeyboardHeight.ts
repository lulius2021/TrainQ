import { useEffect, useState } from "react";

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const diff = window.innerHeight - vv.height;
      const open = diff > 80;
      setIsOpen(open);
      setKeyboardHeight(open ? Math.max(0, diff) : 0);
    };

    vv.addEventListener("resize", onResize);
    onResize();

    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return { keyboardHeight, isOpen };
}