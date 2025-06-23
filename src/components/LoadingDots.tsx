interface LoadingDotsProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingDots({ text = "Loading", size = 'md', className = '' }: LoadingDotsProps) {
  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2', 
    lg: 'h-2.5 w-2.5'
  };
  
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center space-x-1">
        <div className={`${dotSizes[size]} animate-pulse rounded-full bg-foreground/70`}></div>
        <div className={`${dotSizes[size]} animate-pulse rounded-full bg-foreground/70 animation-delay-100`}></div>
        <div className={`${dotSizes[size]} animate-pulse rounded-full bg-foreground/70 animation-delay-200`}></div>
      </div>
      <span className={`${textSizes[size]} text-foreground/80 animate-pulse`}>{text}...</span>
    </div>
  );
} 