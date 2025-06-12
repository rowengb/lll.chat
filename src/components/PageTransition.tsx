import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0.8 }} // Start closer to visible
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.8 }} // Don't fade completely out
      transition={{
        duration: 0.03, // Lightning fast - 30ms
        ease: "linear", // No easing for instant feel
      }}
      className="h-full min-h-screen w-full bg-gray-50"
    >
      {children}
    </motion.div>
  );
} 