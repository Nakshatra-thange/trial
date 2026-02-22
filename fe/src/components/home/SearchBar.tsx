import { useState, useEffect } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = "Search tokens..." }: SearchBarProps) {
  const [value, setValue] = useState("");

  // Debounce search - wait 300ms after user stops typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 pl-10 rounded-lg bg-black/40 border border-amber-600/30 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:bg-black/60 transition-all duration-200 backdrop-blur-sm"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-600/80"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}
