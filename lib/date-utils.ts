
export const calculateDaysExcludingSundays = (fromDate: Date, toDate: Date): number => {
    let count = 0;
    const current = new Date(fromDate);

    while (current <= toDate) {
        if (current.getDay() !== 0) { // 0 = Sunday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

export const getReturnDeadline = (completedAt: any) => {
    if (!completedAt) return null;

    const completedDate = completedAt instanceof Date
        ? completedAt
        : typeof completedAt.toDate === 'function'
            ? completedAt.toDate()
            : new Date(completedAt.seconds * 1000);

    const now = new Date();

    // Calculate deadline: 3 days from completion (excluding Sundays)
    let daysAdded = 0;
    const deadline = new Date(completedDate);

    while (daysAdded < 3) {
        deadline.setDate(deadline.getDate() + 1);
        // Skip Sundays
        if (deadline.getDay() !== 0) {
            daysAdded++;
        }
    }

    // Calculate days remaining (excluding Sundays)
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const daysRemaining = calculateDaysExcludingSundays(tomorrow, deadlineDate);

    if (now > deadline) {
        const daysOverdue = calculateDaysExcludingSundays(deadline, now);
        return {
            deadline,
            daysRemaining: -daysOverdue,
            status: 'overdue' as const,
        };
    } else if (daysRemaining === 0) {
        return {
            deadline,
            daysRemaining: 0,
            status: 'warning' as const,
        };
    } else {
        return {
            deadline,
            daysRemaining,
            status: 'ok' as const,
        };
    }
};
