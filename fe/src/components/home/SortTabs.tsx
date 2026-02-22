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
    <div className="flex gap-1 border-b border-amber-600/20">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            px-5 py-3 text-sm font-medium transition-colors duration-200 relative
            ${
              selected === tab.value
                ? "text-amber-500"
                : "text-gray-500 hover:text-gray-300"
            }
          `}
        >
          {tab.label}
          {selected === tab.value && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
          )}
        </button>
      ))}
    </div>
  );
}
