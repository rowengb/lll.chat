import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', onClick }) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl', 
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  // If onClick is provided, use a button instead of Link
  if (onClick) {
    return (
      <button 
        onClick={onClick}
        className={`font-inter font-normal ${sizeClasses[size]} ${className} cursor-pointer hover:opacity-80 transition-opacity`}
      >
        <span className="text-gray-900 opacity-100 font-bold">lll</span>
        <span className="text-gray-900 opacity-40">.</span>
        <span className="text-black font-normal">chat</span>
      </button>
    );
  }

  return (
    <Link href="/" className={`font-inter font-normal ${sizeClasses[size]} ${className} cursor-pointer hover:opacity-80 transition-opacity`}>
      <span className="text-gray-900 opacity-100 font-bold">lll</span>
      <span className="text-gray-900 opacity-40">.</span>
      <span className="text-black font-normal">chat</span>
    </Link>
  );
};

export default Logo; 