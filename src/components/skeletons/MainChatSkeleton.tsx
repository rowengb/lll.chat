export function MainChatSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Content area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-6 w-full max-w-4xl">
          {/* Title area */}
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded mx-auto w-80 animate-pulse"></div>
            <div className="h-5 bg-gray-200 rounded mx-auto w-96 animate-pulse"></div>
          </div>
          
          {/* Cards grid */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-white border border-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 