import React, { useState, useEffect } from 'react';
import { SearchIcon, LoaderIcon, TrendingUpIcon, CheckIcon, GlobeIcon } from 'lucide-react';

export interface LoadingStatus {
  step: 'thinking' | 'searching' | 'sources_found' | 'analyzing' | 'processing' | 'complete';
  message: string;
  details?: string; // Additional info like search term or source count
  progress?: number; // 0-100 for progress bar
  timestamp?: number;
}

export interface TimelineStep {
  step: LoadingStatus['step'];
  message: string;
  details?: string;
  status: 'pending' | 'active' | 'completed';
  timestamp?: number;
}

interface DynamicLoadingStatusProps {
  status: LoadingStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusIcons = {
  thinking: LoaderIcon,
  searching: SearchIcon,
  sources_found: GlobeIcon,
  analyzing: TrendingUpIcon,
  processing: LoaderIcon,
  complete: CheckIcon,
};

const statusColors = {
  thinking: 'text-blue-500',
  searching: 'text-orange-500',
  sources_found: 'text-green-500',
  analyzing: 'text-purple-500',
  processing: 'text-blue-500',
  complete: 'text-green-600',
};

// Rotating dots animation component
const RotatingDots = React.memo(function RotatingDots() {
  const [currentDot, setCurrentDot] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDot(prev => (prev + 1) % 3);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex ml-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`inline-block w-1 h-1 mx-0.5 rounded-full transition-opacity duration-200 ${
            index <= currentDot ? 'bg-current opacity-100' : 'bg-current opacity-30'
          }`}
        />
      ))}
    </span>
  );
});

// Circular progress indicator
const CircularProgress = React.memo(function CircularProgress({ 
  progress = 0, 
  size = 16, 
  strokeWidth = 2,
  className = ""
}: {
  progress?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-500 ease-out"
        />
      </svg>
    </div>
  );
});

// Timeline step component - redesigned for subtlety
const TimelineStepComponent = React.memo(function TimelineStepComponent({ 
  step, 
  size = 'sm',
  isLast = false,
  progress = 0
}: { 
  step: TimelineStep; 
  size?: 'sm' | 'md' | 'lg';
  isLast?: boolean;
  progress?: number;
}) {
  const IconComponent = statusIcons[step.step];
  
  const sizes = {
    sm: {
      icon: 'h-3 w-3',
      text: 'text-xs',
      connector: 'h-4',
      dot: 'w-2 h-2',
    },
    md: {
      icon: 'h-4 w-4',
      text: 'text-sm',
      connector: 'h-6',
      dot: 'w-3 h-3',
    },
    lg: {
      icon: 'h-5 w-5',
      text: 'text-base',
      connector: 'h-8',
      dot: 'w-4 h-4',
    }
  };

  // Typing animation for active search steps
  const [typedDetails, setTypedDetails] = useState('');
  const [lastDetails, setLastDetails] = useState('');
  
  useEffect(() => {
    if (step.details !== lastDetails) {
      setLastDetails(step.details || '');
      
      if (step.details && step.step === 'searching' && step.status === 'active') {
        setTypedDetails('');
        let i = 0;
        const timer = setInterval(() => {
          if (i < step.details!.length) {
            setTypedDetails(step.details!.substring(0, i + 1));
            i++;
          } else {
            clearInterval(timer);
          }
        }, 30);
        return () => clearInterval(timer);
      } else if (step.details) {
        setTypedDetails(step.details);
      } else {
        setTypedDetails('');
      }
    }
  }, [step.details, step.step, step.status, lastDetails]);

  const isActive = step.status === 'active';
  const isCompleted = step.status === 'completed';
  const isPending = step.status === 'pending';

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Timeline connector */}
      {!isLast && (
        <div className={`absolute left-1.5 top-6 w-px ${sizes[size].connector} ${
          isCompleted ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
        }`} />
      )}
      
      {/* Status indicator */}
      <div className="relative z-10 flex-shrink-0">
        {isCompleted ? (
          <div className={`${sizes[size].dot} rounded-full bg-gray-400 dark:bg-gray-500 flex items-center justify-center`}>
            <CheckIcon className="w-2 h-2 text-white" />
          </div>
        ) : isActive ? (
          <div className="relative">
            {progress > 0 ? (
              <CircularProgress 
                progress={progress} 
                size={size === 'sm' ? 12 : size === 'md' ? 16 : 20}
                strokeWidth={1.5}
                className="text-blue-500"
              />
            ) : (
              <div className={`${sizes[size].dot} rounded-full bg-blue-500 animate-pulse`} />
            )}
          </div>
        ) : (
          <div className={`${sizes[size].dot} rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`${sizes[size].text} font-medium transition-colors duration-300 ${
          isCompleted 
            ? 'text-gray-500 dark:text-gray-400 line-through' 
            : isActive
            ? 'text-gray-900 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500'
        }`}>
          {step.message}
          {isActive && (
            <RotatingDots />
          )}
        </div>

        {/* Details/Search Term - only show for active steps */}
        {step.details && isActive && (
          <div className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mt-0.5 font-mono`}>
            {step.step === 'searching' ? (
              <span className="italic">
                "{typedDetails}
                {typedDetails.length < step.details.length && (
                  <span className="animate-pulse">|</span>
                )}
                "
              </span>
            ) : (
              step.details
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.step.step === nextProps.step.step &&
    prevProps.step.message === nextProps.step.message &&
    prevProps.step.details === nextProps.step.details &&
    prevProps.step.status === nextProps.step.status &&
    prevProps.size === nextProps.size &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.progress === nextProps.progress
  );
});

export const DynamicLoadingStatus = React.memo(function DynamicLoadingStatus({ 
  status, 
  size = 'sm', 
  className = ''
}: DynamicLoadingStatusProps) {

  // Simple status display 
  const IconComponent = statusIcons[status.step];
  const colorClass = statusColors[status.step];
  
  const sizes = {
    sm: {
      icon: 'h-4 w-4',
      text: 'text-sm',
      progressSize: 16,
      gap: 'gap-3',
    },
    md: {
      icon: 'h-5 w-5',
      text: 'text-base',
      progressSize: 20,
      gap: 'gap-4',
    },
    lg: {
      icon: 'h-6 w-6',
      text: 'text-lg',
      progressSize: 24,
      gap: 'gap-5',
    }
  };

  // Show message immediately, add typing later if needed
  const displayMessage = status.message;

  // Simple animation for dots
  const [dotsAnimation, setDotsAnimation] = useState(0);
  
  // Dots animation
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDotsAnimation(prev => (prev + 1) % 3); // 0, 1, 2 dots cycling
    }, 500); // Slower, more visible
    
    return () => clearInterval(dotsTimer);
  }, []);
  
  // Show details immediately
  const displayDetails = status.details;

  // Only show progress for specific steps that should have progress bars
  const showProgress = false; // Disable progress indicators for now

    return (
    <div className={`flex items-center ${sizes[size].gap} ${className}`}>
      {/* Dynamic Status Indicator */}
      <div className="relative flex-shrink-0">
        {status.step === 'complete' ? (
          <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center">
            <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
          </div>
        ) : showProgress ? (
          <CircularProgress 
            progress={status.progress!} 
            size={sizes[size].progressSize}
            strokeWidth={2}
            className="text-blue-500"
          />
        ) : (
          <div className="relative">
            <IconComponent 
              className={`${sizes[size].icon} ${colorClass} transition-colors duration-300 ${
                status.step === 'thinking' ? 'animate-pulse' : 'animate-spin'
              }`}
            />
            {status.step === 'searching' && (
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Dynamic Content - Clean single line */}
      <div className="flex-1 min-w-0 flex items-center">
        <div className={`${sizes[size].text} font-medium text-gray-700 dark:text-gray-300`}>
          {/* Main message */}
          <span>{displayMessage}</span>
          
          {/* Search terms inline */}
          {status.details && displayDetails && (
            <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-blue-600 dark:text-blue-400 font-mono ml-2`}>
              "{displayDetails}"
            </span>
          )}
          
          {/* Simple animated dots */}
          {status.step !== 'complete' && (
            <span className="ml-1">
              {Array.from({ length: 3 }, (_, i) => (
                <span 
                  key={i}
                  className={`inline-block animate-pulse ${i <= dotsAnimation ? 'opacity-100' : 'opacity-30'}`}
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  .
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.status.step === nextProps.status.step &&
    prevProps.status.message === nextProps.status.message &&
    prevProps.status.details === nextProps.status.details &&
    prevProps.status.progress === nextProps.status.progress &&
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className
  );
});

// Pre-built status creators for common scenarios
export const createLoadingStatus = {
  thinking: (): LoadingStatus => ({
    step: 'thinking',
    message: 'Processing your request',
    progress: 25,
    timestamp: Date.now(),
  }),
  
  searching: (searchTerm?: string): LoadingStatus => ({
    step: 'searching',
    message: 'Searching the web',
    details: searchTerm,
    progress: 50,
    timestamp: Date.now(),
  }),
  
  sourcesFound: (count: number): LoadingStatus => ({
    step: 'sources_found',
    message: `Found ${count} source${count !== 1 ? 's' : ''}`,
    progress: 75,
    timestamp: Date.now(),
  }),
  
  analyzing: (): LoadingStatus => ({
    step: 'analyzing',
    message: 'Analyzing information',
    progress: 85,
    timestamp: Date.now(),
  }),
  
  processing: (): LoadingStatus => ({
    step: 'processing',
    message: 'Generating response',
    progress: 95,
    timestamp: Date.now(),
  }),
  
  complete: (): LoadingStatus => ({
    step: 'complete',
    message: 'Complete',
    progress: 100,
    timestamp: Date.now(),
  }),
};

// Timeline builder that tracks progress through steps
export class TimelineBuilder {
  private steps: TimelineStep[] = [];
  private currentStepIndex = 0;

  constructor() {
    // Initialize with all possible steps - more concise messaging
    this.steps = [
      { step: 'thinking', message: 'Processing request', status: 'active' },
      { step: 'searching', message: 'Searching web', status: 'pending' },
      { step: 'sources_found', message: 'Found sources', status: 'pending' },
      { step: 'analyzing', message: 'Analyzing data', status: 'pending' },
      { step: 'processing', message: 'Generating response', status: 'pending' },
    ];
  }

  updateStep(status: LoadingStatus): TimelineStep[] {
    const stepIndex = this.getStepIndex(status.step);
    let hasChanges = false;
    
    // Check if we're actually changing anything to prevent unnecessary updates
    if (stepIndex !== this.currentStepIndex || 
        this.steps[stepIndex]?.status !== 'active' ||
        this.steps[stepIndex]?.details !== status.details) {
      hasChanges = true;
    }

    // Check if any previous steps need to be completed
    for (let i = 0; i < stepIndex && i < this.steps.length; i++) {
      const step = this.steps[i];
      if (step && step.status !== 'completed') {
        hasChanges = true;
        break;
      }
    }

    // If no changes needed, return the same reference
    if (!hasChanges) {
      return this.steps;
    }

    // Mark previous steps as completed
    for (let i = 0; i < stepIndex && i < this.steps.length; i++) {
      const step = this.steps[i];
      if (step && step.status !== 'completed') {
        step.status = 'completed';
      }
    }

    // Update current step based on status
    if (stepIndex !== -1 && stepIndex < this.steps.length) {
      this.currentStepIndex = stepIndex;
      const currentStep = this.steps[stepIndex];
      if (currentStep) {
        this.steps[stepIndex] = {
          step: currentStep.step,
          message: currentStep.message,
          status: 'active' as const,
          details: status.details,
          timestamp: status.timestamp,
        };

        // Update message for specific steps
        if (status.step === 'sources_found' && status.message.includes('source')) {
          this.steps[stepIndex].message = status.message;
        }
      }
    }

    return [...this.steps];
  }

  private getStepIndex(step: LoadingStatus['step']): number {
    const stepMap: Record<LoadingStatus['step'], number> = {
      'thinking': 0,
      'searching': 1,
      'sources_found': 2,
      'analyzing': 3,
      'processing': 4,
      'complete': 4, // Complete maps to processing step
    };
    return stepMap[step] ?? -1;
  }

  markCompleted(): TimelineStep[] {
    // Mark all steps as completed
    this.steps.forEach(step => {
      step.status = 'completed';
    });
    return [...this.steps];
  }

  getTimeline(): TimelineStep[] {
    return this.steps;
  }
} 