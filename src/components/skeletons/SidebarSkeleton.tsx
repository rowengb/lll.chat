export function SidebarSkeleton() {
  return (
    <div 
      className="bg-white border-r border-gray-200 flex flex-col"
      style={{ width: '288px' }}
    >
      {/* Header area */}
      <div className="p-4 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded animate-pulse mb-3"></div>
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
      
      {/* Bottom area */}
      <div className="border-t border-gray-200 p-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );
} 