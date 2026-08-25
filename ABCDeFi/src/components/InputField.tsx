import React, { useState } from "react";

interface Props {
  value: string;
  placeholder: string;
  secure?: boolean;
  leftIcon?: string;
  onChange: (text: string) => void;
  editable: boolean;
  inputStyle?: React.CSSProperties;
}

/** Controlled HTML input retaining the legacy mobile component API. */
export const InputField: React.FC<Props> = ({
  value,
  placeholder,
  secure = false,
  leftIcon,
  onChange,
  editable,
  inputStyle,
}) => {
  const [hidePassword, setHidePassword] = useState(secure);

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-violet-500" style={inputStyle}>
      {leftIcon ? <span aria-hidden="true" className="text-slate-500">{leftIcon}</span> : null}
      <input
        value={value}
        placeholder={placeholder}
        type={secure && hidePassword ? "password" : "text"}
        onChange={(event) => onChange(event.target.value)}
        disabled={!editable}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {secure ? (
        <button type="button" onClick={() => setHidePassword((hidden) => !hidden)} className="text-xs text-violet-700">
          {hidePassword ? "Show" : "Hide"}
        </button>
      ) : null}
    </label>
  );
};
