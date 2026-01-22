// src/components/auth/AuthInput.tsx
import React from "react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  error,
  ...props
}) => {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-300">{label}</label>
      <input
        {...props}
        className={`w-full bg-[var(--surface)] border rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none ${error ? "border-red-500" : "border-[var(--border)]"
          }`}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
