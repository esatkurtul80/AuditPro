import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the number of calendar days between two dates.
 * @param startDate The start date (exclusive)
 * @param endDate The end date (inclusive)
 * @returns Number of calendar days
 */
export const getWorkingDaysPassed = (startDate: Date, endDate: Date) => {
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // If start is after end, return 0
    if (current >= end) return 0;

    const diffMs = end.getTime() - current.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculates the deadline date by adding 3 calendar days.
 * @param startDate The starting date
 * @returns The deadline date
 */
export const calculateDeadlineDate = (startDate: Date) => {
    let date = new Date(startDate);
    date.setDate(date.getDate() + 3);
    return date;
};
