import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { filterSuggestions } from "../utils/fuzzyMatch";

interface Props {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder?: string;
  hint?: string;
  allowCustom?: boolean;
  maxItems?: number;
}

export default function TagAutocomplete({
  label,
  value,
  onChange,
  options,
  placeholder = "输入后选择或回车添加",
  hint,
  allowCustom = true,
  maxItems = 20,
}: Props) {
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = filterSuggestions(options, query, value, 14);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || value.length >= maxItems) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setQuery("");
    setOpen(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  const addFromQuery = () => {
    if (suggestions.length > 0 && query.trim()) {
      addTag(suggestions[activeIndex] || suggestions[0]);
      return;
    }
    if (allowCustom && query.trim()) {
      addTag(query);
    }
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
      addFromQuery();
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("、") && !text.includes(",") && !text.includes("，")) return;
    e.preventDefault();
    const parts = text.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      if (next.length >= maxItems) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={inputId} className="text-sm text-gray-600">
        {label}
      </label>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div
        className={`mt-1 min-h-[42px] w-full rounded-xl border bg-white px-2 py-1.5 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-300 ${
          open ? "border-brand-300" : "border-gray-200"
        }`}
        onClick={() => setOpen(true)}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-brand-50 text-brand-800 text-sm border border-brand-100"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="p-0.5 rounded-full hover:bg-brand-100 text-brand-600"
              aria-label={`移除 ${tag}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="flex-1 min-w-[120px] border-0 outline-none text-sm py-1 px-1 bg-transparent"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={value.length >= maxItems}
        />
      </div>
      {open && (suggestions.length > 0 || (allowCustom && query.trim())) && (
        <ul
          className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 text-sm"
          role="listbox"
        >
          {suggestions.map((opt, idx) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={idx === activeIndex}
                className={`w-full text-left px-3 py-2 hover:bg-brand-50 ${
                  idx === activeIndex ? "bg-brand-50 text-brand-800" : "text-gray-700"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(opt)}
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
                  className="w-full text-left px-3 py-2 text-brand-700 hover:bg-brand-50 border-t border-gray-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(query)}
                >
                  添加「{query.trim()}」
                </button>
              </li>
            )}
        </ul>
      )}
    </div>
  );
}
