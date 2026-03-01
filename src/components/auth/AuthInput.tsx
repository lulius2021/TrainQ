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
      <label className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <input
        {...props}
        className={`w-full rounded-2xl px-3 py-2 text-sm outline-none ${error ? "border-red-500" : ""}`}
        style={{ backgroundColor: "var(--input-bg)", border: `1px solid ${error ? "#ef4444" : "var(--border-color)"}`, color: "var(--text-color)" }}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
