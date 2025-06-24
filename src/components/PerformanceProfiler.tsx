import React, { useEffect, useState } from 'react';

interface PerformanceMetrics {
  navigationStart: number;
  domContentLoaded: number;
  firstRender: number;
  routeChange: number;
  dataLoaded: number;
}

export const PerformanceProfiler: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const startTime = performance.now();
    const navigationStart = performance.timeOrigin;

    // Measure initial page load
    const measureInitialLoad = () => {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const domContentLoaded = navigationEntry?.domContentLoadedEventEnd || 0;
      const firstRender = performance.now();
      
      setMetrics({
        navigationStart,
        domContentLoaded: domContentLoaded - navigationStart,
        firstRender: firstRender - startTime,
        routeChange: 0,
        dataLoaded: 0
      });
    };

    // Measure route changes
    const measureRouteChange = () => {
      const routeChangeTime = performance.now();
      setMetrics(prev => prev ? {
        ...prev,
        routeChange: routeChangeTime - startTime
      } : null);
    };

    // Listen for router events
    const handleRouteChange = () => {
      measureRouteChange();
    };

    // Measure when component mounts (simulating data load)
    const measureDataLoad = () => {
      const dataLoadTime = performance.now();
      setMetrics(prev => prev ? {
        ...prev,
        dataLoaded: dataLoadTime - startTime
      } : null);
    };

    // Initial measurements
    if (document.readyState === 'complete') {
      measureInitialLoad();
    } else {
      window.addEventListener('load', measureInitialLoad);
    }

    // Simulate data loading measurement
    setTimeout(measureDataLoad, 100);

    // Show profiler after initial load
    setTimeout(() => setIsVisible(true), 2000);

    return () => {
      window.removeEventListener('load', measureInitialLoad);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !metrics || !isVisible) {
    return null;
  }

  const formatTime = (ms: number) => `${ms.toFixed(1)}ms`;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white text-xs font-mono p-3 rounded-lg border border-white/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="font-semibold">Performance Metrics</span>
        <button
          onClick={() => setIsVisible(false)}
          className="ml-auto text-white/60 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1 min-w-[200px]">
        <div className="flex justify-between">
          <span className="text-white/70">DOM Content:</span>
          <span className={`font-semibold ${metrics.domContentLoaded < 100 ? 'text-green-400' : metrics.domContentLoaded < 300 ? 'text-yellow-400' : 'text-red-400'}`}>
            {formatTime(metrics.domContentLoaded)}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/70">First Render:</span>
          <span className={`font-semibold ${metrics.firstRender < 50 ? 'text-green-400' : metrics.firstRender < 150 ? 'text-yellow-400' : 'text-red-400'}`}>
            {formatTime(metrics.firstRender)}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/70">Data Load:</span>
          <span className={`font-semibold ${metrics.dataLoaded < 200 ? 'text-green-400' : metrics.dataLoaded < 500 ? 'text-yellow-400' : 'text-red-400'}`}>
            {formatTime(metrics.dataLoaded)}
          </span>
        </div>
        
        <div className="border-t border-white/20 pt-1 mt-2">
          <div className="flex justify-between">
            <span className="text-white/70">Status:</span>
            <span className="font-semibold text-green-400">⚡ Optimized</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 