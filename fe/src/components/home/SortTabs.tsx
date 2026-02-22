import type { SortOption } from "@/types/token";

interface SortTabsProps {
  selected: SortOption;
  onChange: (sort: SortOption) => void;
}

const tabs: Array<{ value: SortOption; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending" },
  { value: "graduated", label: "Graduated" },
];

export function SortTabs({ selected, onChange }: SortTabsProps) {
  return (
    <div className="flex gap-2 border-b border-zinc-700">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            px-4 py-3 text-sm font-medium transition-colors relative
            ${
              selected === tab.value
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-300"
            }
          `}
        >
          {tab.label}
          {selected === tab.value && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      ))}
    </div>
  );
}
