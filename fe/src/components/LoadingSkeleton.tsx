export function TokenCardSkeleton() {
    return (
      <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 animate-pulse">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-16 h-16 rounded-xl bg-zinc-700" />
          <div className="flex-1">
            <div className="h-5 bg-zinc-700 rounded mb-2 w-3/4" />
            <div className="h-4 bg-zinc-700 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-zinc-700 rounded" />
          <div className="h-4 bg-zinc-700 rounded" />
          <div className="h-4 bg-zinc-700 rounded w-2/3" />
        </div>
      </div>
    );
  }
  
  export function TokenPageSkeleton() {
    return (
      <div className="min-h-screen bg-zinc-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Image */}
            <div className="space-y-6">
              <div className="bg-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="w-full aspect-square rounded-xl bg-zinc-700" />
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 animate-pulse space-y-3">
                <div className="h-6 bg-zinc-700 rounded w-3/4" />
                <div className="h-4 bg-zinc-700 rounded w-full" />
                <div className="h-4 bg-zinc-700 rounded w-2/3" />
              </div>
            </div>
  
            {/* Right - Chart + Trading */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="h-96 bg-zinc-700 rounded" />
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 animate-pulse">
                <div className="h-64 bg-zinc-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export function ChartSkeleton() {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-zinc-700 rounded animate-pulse" />
          <div className="h-8 w-24 bg-zinc-700 rounded animate-pulse" />
        </div>
        <div className="h-96 bg-zinc-700 rounded animate-pulse" />
      </div>
    );
  }

  