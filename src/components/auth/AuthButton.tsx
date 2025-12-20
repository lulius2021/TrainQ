// src/components/auth/AuthButton.tsx
import React from "react";

interface AuthButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  children,
  ...props
}) => {
  return (
    <button
      {...props}
      className={`w-full rounded-full py-2 text-sm font-medium bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${
        props.className || ""
      }`}
    >
      {children}
    </button>
  );
};
