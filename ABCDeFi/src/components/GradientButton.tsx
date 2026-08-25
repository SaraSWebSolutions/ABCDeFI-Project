import React from "react";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Accessible web replacement for the legacy React Native gradient button. */
export const GradientButton: React.FC<Props> = ({ title, onPress, disabled = false }) => (
  <button
    type="button"
    onClick={onPress}
    disabled={disabled}
    className="min-h-11 w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {title}
  </button>
);
