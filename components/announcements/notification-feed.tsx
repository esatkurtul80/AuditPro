"use client"

import * as React from "react"
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Announcement } from "@/lib/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Bell, CalendarDays } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"
// Import Suspense and useSearchParams for Deep Linking
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { markAnnouncementAsRead } from "@/lib/announcement-utils"



function NotificationFeedContent() {
  const { userProfile } = useAuth()
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([])
  const [loading, setLoading] = React.useState(true)
  
  // Deep Linking Logic
  const searchParams = useSearchParams()
  const notificationId = searchParams.get("notificationId")
  const [activeItem, setActiveItem] = React.useState<string | undefined>(undefined)

  // 1. Fetch Data
  React.useEffect(() => {
    if (!userProfile) return

    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(20)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allAnnouncements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[]

      const filtered = allAnnouncements.filter(announcement => {
        if (!announcement.recipients || announcement.recipients.length === 0) return false

        return announcement.recipients.some(recipient => {
            if (recipient.type === "user" && recipient.id === userProfile.uid) return true
            
            if (recipient.type === "role_group") {
                if (recipient.value === "all") return true
                if (recipient.value === "magaza" && userProfile.role === "magaza") return true
                if (recipient.value === "denetmen" && userProfile.role === "denetmen") return true
                if (recipient.value === "bolge-muduru" && userProfile.role === "bolge-muduru") return true
                if (recipient.value === "admin" && userProfile.role === "admin") return true
            }

            if (userProfile.role === "magaza") {
                const user = userProfile as any
                if (recipient.type === "store" && recipient.id === user.storeId) return true
                if (recipient.id.startsWith("city_") && recipient.value === user.city) return true
                if (recipient.id.startsWith("region_") && recipient.value === user.regionalManagerId) return true
            }

            return false
        })
      })

      setAnnouncements(filtered)
      setLoading(false)
    })

    // Safety timeout for slow connections
    const timer = setTimeout(() => {
        setLoading(false)
    }, 7000)

    return () => {
        unsubscribe()
        clearTimeout(timer)
    }
  }, [userProfile])

  // 2. Handle Deep Linking
  React.useEffect(() => {
    if (notificationId && !loading && announcements.length > 0) {
        // Check if the notification exists in our list
        const exists = announcements.some(a => a.id === notificationId)
        if (exists) {
            setActiveItem(notificationId)
            
            // iOS PWA needs more time for accordion expansion and reliable scrolling
            setTimeout(() => {
                const element = document.getElementById(notificationId)
                if (element) {
                    // Force reflow to ensure element is in correct position
                    element.getBoundingClientRect()
                    
                    // Primary scroll method
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                    
                    // Fallback for iOS if scrollIntoView doesn't work properly
                    setTimeout(() => {
                        const rect = element.getBoundingClientRect()
                        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
                        
                        if (!isVisible) {
                            // Use window.scrollTo as fallback
                            const top = element.offsetTop - (window.innerHeight / 2) + (element.offsetHeight / 2)
                            window.scrollTo({ top, behavior: 'smooth' })
                        }
                    }, 100)
                    
                    // Highlight effect - longer duration for mobile
                    element.classList.add("ring-2", "ring-primary", "ring-offset-2")
                    setTimeout(() => element.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000)
                }
            }, 800) // Increased timeout for iOS accordion expansion
        }
    }
  }, [notificationId, loading, announcements])


  if (loading) {
     return null
  }

  if (announcements.length === 0) {
      return null
  }

  return (
    <div className="w-full mb-6 border rounded-lg overflow-hidden bg-card/50 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
      <div className="bg-primary/5 px-4 py-3 flex items-center gap-2 border-b border-primary/10">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-primary">Duyurular & Bildirimler</h3>
        <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 min-w-5 flex justify-center">
            {announcements.length}
        </Badge>
      </div>
      
      <Accordion 
        type="single" 
        collapsible 
        className="w-full" 
        value={activeItem} 
        onValueChange={async (value) => {
          setActiveItem(value);
          // Mark as read when accordion opens
          if (value && userProfile) {
            try {
              const userName = userProfile.displayName || 
                             `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
                             userProfile.email;
              
              // Check if already read to prevent duplicates
              const announcement = announcements.find(a => a.id === value);
              const isAlreadyRead = announcement?.readBy?.some(r => r.userId === userProfile.uid);

              if (!isAlreadyRead) {
                  
                  await markAnnouncementAsRead(value, userProfile.uid, userName);
                  
              } else {
              }
            } catch (error) {
              console.error('[Announcement Read Tracking] Error marking announcement as read:', error);
            }
          }
        }}
      >
        {announcements.map((item) => (
          <AccordionItem key={item.id} value={item.id} id={item.id} className="border-b-0">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline [&[data-state=open]]:bg-muted/50 transition-colors">
                <div className="flex flex-col items-start text-left gap-1 w-full">
                    <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-sm text-foreground/90">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap font-normal flex items-center gap-1">
                             <CalendarDays className="h-3 w-3" />
                             {item.createdAt?.seconds ? formatDistanceToNow(new Date(item.createdAt.seconds * 1000), { addSuffix: true, locale: tr }) : 'Yeni'}
                        </span>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-3 text-sm text-muted-foreground bg-background/50 border-t border-border/50">
               <div className="overflow-x-auto max-w-full">
                   <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-2 [&_td]:border [&_td]:p-2 [&_img]:max-w-full [&_img]:h-auto"
                      dangerouslySetInnerHTML={{ __html: item.content }} 
                   />
               </div>
               <div className="mt-3 pt-3 flex items-center justify-end border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground">
                        Gönderen: <span className="font-medium text-primary">{item.senderName}</span>
                    </span>
               </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// Wrapper Component with Suspense
export function NotificationFeed() {
    return (
        <Suspense fallback={null}>
            <NotificationFeedContent />
        </Suspense>
    )
}
