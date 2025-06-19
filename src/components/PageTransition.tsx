import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0.95, scale: 0.99 }} // Minimal initial state
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0.95, scale: 0.99 }} // Minimal exit state
      transition={{
        duration: 0.15, // Ultra-fast 150ms
        ease: [0.4, 0, 0.2, 1], // Custom easing for snappy feel
      }}
      className="h-full min-h-screen w-full bg-gray-50"
      style={{
        // Hardware acceleration
        transform: 'translateZ(0)',
        willChange: 'opacity, transform',
        backfaceVisibility: 'hidden',
        perspective: 1000,
      }}
    >
      {children}
    </motion.div>
  );
} 