"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FadeInViewProps {
    children: ReactNode;
    className?: string;
    delay?: number;
}

/**
 * Fade-in with scale animation for cards and content blocks
 * Creates a subtle zoom-in effect
 */
export function FadeInView({
    children,
    className,
    delay = 0
}: FadeInViewProps) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.3,
                delay,
                ease: [0.25, 0.1, 0.25, 1], // Custom ease for smooth feel
            }}
        >
            {children}
        </motion.div>
    );
}

interface GridFadeInProps {
    children: ReactNode;
    className?: string;
}

/**
 * Grid container with staggered fade-in for child items
 */
export function GridFadeIn({ children, className }: GridFadeInProps) {
    return (
        <motion.div
            className={className}
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        staggerChildren: 0.04, // Faster, more subtle stagger
                    },
                },
            }}
        >
            {children}
        </motion.div>
    );
}

interface GridItemProps {
    children: ReactNode;
    className?: string;
}

/**
 * Individual grid item with scale + fade animation
 */
export function GridItem({ children, className }: GridItemProps) {
    return (
        <motion.div
            className={className}
            variants={{
                hidden: { opacity: 0, scale: 0.95 },
                visible: {
                    opacity: 1,
                    scale: 1,
                    transition: {
                        duration: 0.3,
                        ease: [0.25, 0.1, 0.25, 1],
                    },
                },
            }}
        >
            {children}
        </motion.div>
    );
}
