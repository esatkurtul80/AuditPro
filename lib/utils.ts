import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the number of working days between two dates, excluding Sundays.
 * @param startDate The start date (exclusive)
 * @param endDate The end date (inclusive)
 * @returns Number of working days
 */
export const getWorkingDaysPassed = (startDate: Date, endDate: Date) => {
    let count = 0;
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // If start is after end, return 0 (or should we return negative?)
    if (current >= end) return 0;

    while (current < end) {
        current.setDate(current.getDate() + 1);
        count++;
    }
    return count;
};

/**
 * Calculates the deadline date by adding 3 working days (excluding Sundays).
 * @param startDate The starting date
 * @returns The deadline date
 */
export const calculateDeadlineDate = (startDate: Date) => {
    let date = new Date(startDate);
    let daysAdded = 0;
    // We add 3 working days
    while (daysAdded < 3) {
        date.setDate(date.getDate() + 1);
        daysAdded++;
    }
    return date;
};
