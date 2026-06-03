import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { filterSuggestions } from "../utils/fuzzyMatch";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
  hint?: string;
}

export default function SingleAutocomplete({
  label,
  value,
  onChange,
  options,
  placeholder = "输入搜索…",
  required = false,
  allowCustom = true,
  hint,
}: Props) {
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = filterSuggestions(options, query, value ? [value] : [], 12);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  const pick = (opt: string) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) pick(suggestions[activeIndex] || suggestions[0]);
      else if (allowCustom && query.trim()) pick(query.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={inputId} className="text-sm text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div className="relative mt-1">
        <input
          id={inputId}
          required={required && !value}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {open && (suggestions.length > 0 || (allowCustom && query.trim())) && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 text-sm">
          {suggestions.map((opt, idx) => (
            <li key={opt}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-brand-50 ${
                  idx === activeIndex ? "bg-brand-50 text-brand-800" : "text-gray-700"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {opt}
              </button>
            </li>
          ))}
          {allowCustom &&
            query.trim() &&
            !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
              <li>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-brand-700 hover:bg-brand-50 border-t"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(query.trim())}
                >
                  使用「{query.trim()}」
                </button>
              </li>
            )}
        </ul>
      )}
    </div>
  );
}
