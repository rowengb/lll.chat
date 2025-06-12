import React, { useState } from 'react';
import { Button } from './ui/button';
import { CheckIcon } from 'lucide-react';

interface ActionButtonProps {
  variant?: "ghost" | "default" | "destructive" | "outline" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  onClick: () => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function ActionButton({ 
  variant = "ghost", 
  size = "sm", 
  onClick, 
  className = "", 
  children, 
  disabled = false 
}: ActionButtonProps) {
  const [showCheck, setShowCheck] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleClick = async () => {
    if (disabled || showCheck || isTransitioning) return;
    
    try {
      await onClick();
      
      // Start transition
      setIsTransitioning(true);
      
      // Show checkmark animation
      setShowCheck(true);
      
      // Hide checkmark after animation
      setTimeout(() => {
        setShowCheck(false);
        
        // Allow time for smooth transition back
        setTimeout(() => {
          setIsTransitioning(false);
        }, 150);
      }, 300);
    } catch (error) {
      console.error('Action button error:', error);
      setIsTransitioning(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`relative overflow-hidden transition-all duration-200 ${className}`}
      disabled={disabled}
    >
      <div 
        className={`transition-opacity duration-150 ease-out transition-transform duration-300 ease-in-out ${
          showCheck ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
        }`}
      >
        {children}
      </div>
      
      <div 
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ease-out transition-transform duration-300 ease-in-out ${
          showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
      >
        <CheckIcon 
          className={`h-4 w-4 text-accent-foreground`}
        />
      </div>
    </Button>
  );
} 