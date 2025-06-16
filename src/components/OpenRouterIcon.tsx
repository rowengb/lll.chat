import React from 'react';

interface OpenRouterIconProps {
  size?: number;
  className?: string;
}

export const OpenRouterIcon: React.FC<OpenRouterIconProps> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-10 -10 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g>
        <path
          d="M1.8,145.9c8.8,0,42.8-7.6,60.4-17.5s17.6-10,53.9-35.7c46-32.6,78.5-21.7,131.8-21.7"
          stroke="currentColor"
          strokeWidth="52.7"
          strokeMiterlimit="2.3"
          fill="none"
        />
        <path
          d="M299.4,71.2l-90.1,52V19.2l90.1,52Z"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeMiterlimit="2.3"
          fill="none"
        />
        <path
          d="M0,145.9c8.8,0,42.8,7.6,60.4,17.5s17.6,10,53.9,35.7c46,32.6,78.5,21.7,131.8,21.7"
          stroke="currentColor"
          strokeWidth="52.7"
          strokeMiterlimit="2.3"
          fill="none"
        />
        <path
          d="M297.7,220.6l-90.1-52v104l90.1-52Z"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeMiterlimit="2.3"
          fill="none"
        />
      </g>
    </svg>
  );
};

// Avatar version with circular background
export const OpenRouterAvatar: React.FC<OpenRouterIconProps> = ({ size = 24, className = "" }) => {
  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 border-2 border-white dark:border-gray-800 ${className}`}
      style={{ 
        width: size, 
        height: size,
        minWidth: size,
        minHeight: size
      }}
    >
      <OpenRouterIcon 
        size={Math.round(size * 0.85)} 
        className="text-blue-600 dark:text-blue-400" 
      />
    </div>
  );
};

export default OpenRouterIcon; 