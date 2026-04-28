import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Robustly parses a date from various formats including Firestore Timestamps, JS Dates, and serialized objects.
 */
export function parseDate(dateVal: any): Date | null {
    if (!dateVal) return null;
    let d: Date;
    if (dateVal instanceof Date) {
        d = dateVal;
    } else if (typeof dateVal?.toDate === 'function') {
        d = dateVal.toDate();
    } else if (typeof dateVal === 'object' && ('seconds' in dateVal || '_seconds' in dateVal)) {
        const secs = dateVal.seconds ?? dateVal._seconds ?? 0;
        d = new Date(secs * 1000);
    } else {
        d = new Date(dateVal);
    }
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Safely parses and formats a date to a string. Returns fallback string if invalid.
 */
export function formatDateSafe(dateVal: any, formatStr: string, options?: any, fallback: string = "-"): string {
    const d = parseDate(dateVal);
    if (!d) return fallback;
    return format(d, formatStr, options);
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
