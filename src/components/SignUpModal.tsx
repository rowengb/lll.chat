import { useState, useEffect } from 'react';
import { SignUp } from '@clerk/nextjs';
import { X } from 'lucide-react';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignUpModal({ isOpen, onClose }: SignUpModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 max-w-md w-full mx-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white/80 transition-colors duration-200 z-20"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* SignUp Component */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full">
          <SignUp 
            routing="hash"
            fallbackRedirectUrl="/app"
            signInFallbackRedirectUrl="/app"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 rounded-2xl w-full",
                cardBox: "w-full",
                main: "w-full",
                headerTitle: "text-2xl font-semibold",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border border-gray-200 hover:border-gray-300 transition-colors",
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 transition-colors",
                footerActionLink: "text-blue-600 hover:text-blue-700 transition-colors"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
} 