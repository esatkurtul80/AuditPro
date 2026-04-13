import { doc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement } from "@/lib/types";

/**
 * Marks an announcement as read by a user
 * @param announcementId - The ID of the announcement
 * @param userId - The ID of the user who read it
 * @param userName - The display name of the user
 */
export async function markAnnouncementAsRead(
    announcementId: string,
    userId: string,
    userName: string
): Promise<void> {
    try {
        if (!announcementId) return;

        const safeUserId = userId || "unknown";
        const safeUserName = userName || "Bilinmeyen Kullanıcı";
        
        const announcementRef = doc(db, "announcements", announcementId);
        
        await updateDoc(announcementRef, {
            readBy: arrayUnion({
                userId: safeUserId,
                userName: safeUserName,
                readAt: Timestamp.now()
            })
        });
        
    } catch (error) {
        console.error("[markAnnouncementAsRead] Error:", error);
        console.error("[markAnnouncementAsRead] Error details:", {
            message: error instanceof Error ? error.message : String(error),
            announcementId,
            userId,
            userName
        });
        // Silently fail - don't disrupt user experience
    }
}

/**
 * Gets the read status of an announcement
 * @param announcement - The announcement object
 * @param recipients - Array of recipient objects that should receive this announcement
 * @returns Object with readUsers and unreadUsers arrays
 */
export function getAnnouncementReadStatus(
    announcement: Announcement,
    recipients: Array<{ id: string; label: string; value?: string; type?: string }>
) {
    const readBy = announcement.readBy || [];
    
    // Deduplicate readBy array by userId (keep the first one found or latest? usually first is fine or just unique ids)
    const uniqueReadBy = Array.from(new Map(readBy.map(item => [item.userId, item])).values());
    
    // Always show who has read it (from unique readBy array)
    const readUsers = uniqueReadBy.map(r => ({
        userId: r.userId,
        userName: r.userName,
        readAt: r.readAt
    }));

    const readUserIds = new Set(readUsers.map(r => r.userId));
    
    // Extract actual user IDs from recipients (only for type "user")
    // For role_group recipients, we can't determine the full list of users
    // without querying the users collection
    const expectedUserIds = recipients
        .filter(r => r.type === "user")
        .map(r => r.id);
    
    // Calculate unread users only if we have specific user recipients
    const unreadUsers = expectedUserIds
        .filter(id => !readUserIds.has(id))
        .map(id => {
            const recipient = recipients.find(r => r.id === id);
            return {
                userId: id,
                userName: recipient?.label || "Unknown User"
            };
        });
    
    // If recipients include role_group or city/region, we can't show exact total
    // So we show read count vs expected user count (or just read count if no specific users)
    const hasRoleGroupRecipients = recipients.some(r => 
        r.type === "role_group" || 
        r.id?.startsWith("city_") || 
        r.id?.startsWith("region_")
    );
    
    return {
        readUsers,
        unreadUsers,
        totalRecipients: hasRoleGroupRecipients ? readUsers.length : expectedUserIds.length,
        readCount: readUsers.length,
        unreadCount: unreadUsers.length,
        hasRoleGroupRecipients // Flag to help UI decide what to show
    };
}
