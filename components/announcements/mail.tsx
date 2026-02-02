"use client"

import * as React from "react"
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  PenBox,
  Search,
  Send,
  Trash2,
  Users2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Announcement } from "@/lib/types"
import { MailDisplay } from "@/components/announcements/mail-display"
import { MailList } from "@/components/announcements/mail-list"
import { Nav } from "@/components/announcements/nav" 
import { RecipientOption } from "@/components/announcements/recipient-selector"
import { Button } from "@/components/ui/button"
import { collection, addDoc, Timestamp, deleteDoc, doc, writeBatch, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"

interface MailProps {
  announcements: Announcement[]
  defaultLayout?: number[] | undefined
  defaultCollapsed?: boolean
  navCollapsedSize?: number
  recipientOptions: RecipientOption[] // Pass this down
}

export function Mail({
  announcements,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize = 4,
  recipientOptions
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  
  // Force reset collapsed state when creating
  React.useEffect(() => {
    if (isCreating) {
      setIsCollapsed(true)
    } else {
      setIsCollapsed(defaultCollapsed)
    }
  }, [isCreating, defaultCollapsed])

  // Filtering
  const { userProfile } = useAuth()
  
  const [folder, setFolder] = React.useState<"sent" | "trash" | "archive">("sent")
  const [filter, setFilter] = React.useState<"all" | "unread">("all")
  const [search, setSearch] = React.useState("")
  
  // Local state for actions (mocking backend for now, but persistent in session)
  const [localItems, setLocalItems] = React.useState<Announcement[]>(announcements)

  // Sync props to local state initially
  React.useEffect(() => {
      setLocalItems(announcements)
  }, [announcements])

  // Filter items based on folder and read status
  const filteredItems = React.useMemo(() => {
    let items = localItems

    // Folder filtering
    if (folder === "sent") {
        items = items.filter(i => !i.isDeleted && !i.isArchived)
    } else if (folder === "trash") {
        items = items.filter(i => i.isDeleted)
    } else if (folder === "archive") {
        items = items.filter(i => i.isArchived && !i.isDeleted)
    }

    // Search filtering
    items = items.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                            item.senderName.toLowerCase().includes(search.toLowerCase())
      return matchesSearch
    })

    // Read status filtering (global)
    if (filter === "unread") {
        items = items.filter(i => !i.read)
    }

    return items
  }, [localItems, folder, filter, search])

  const selectedMail = filteredItems.find((item) => item.id === selectedId) || null
  
  // Calculate counts
  const mailCount = localItems.filter(item => !item.read && !item.isDeleted && !item.isArchived).length
  const sentCount = localItems.filter(item => !item.isDeleted && !item.isArchived).length

  const handleSend = async (data: any) => {
      try {
        // 1. Create Announcement Doc
        const docRef = await addDoc(collection(db, "announcements"), {
            title: data.subject,
            content: data.content,
            senderId: userProfile?.uid || "system",
            senderName: userProfile?.displayName || userProfile?.firstName || "Admin",
            recipients: data.recipients,
            targetType: "all", 
            createdAt: Timestamp.now(),
            stats: { total: 0, sent: 0 }
        })

        // 2. Trigger Push Notification (Backend handles user resolution now for performance)
        fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: data.subject,
                message: "Yeni bir duyurunuz var. Okumak için dokunun.",
                recipients: data.recipients, // Pass recipients directly to API
                url: `/?notificationId=${docRef.id}` 
            }),
        }).catch(err => console.error("Push API Error:", err));

        toast.success("Bilgilendirme gönderildi")
        setIsCreating(false)
      } catch (e) {
          console.error(e)
          toast.error("Hata oluştu")
      }
  }

  // Actions
  const handleDelete = async (id: string) => {
      if (folder === "trash") {
          try {
             await deleteDoc(doc(db, "announcements", id))
             setLocalItems(prev => prev.filter(item => item.id !== id))
             toast.success("Bildirim kalıcı olarak silindi")
          } catch (error) {
             console.error(error)
             toast.error("Silinirken hata oluştu")
          }
      } else {
          setLocalItems(prev => prev.map(item => {
              if (item.id === id) {
                  return { ...item, isDeleted: true }
              }
              return item
          }))
          toast.success("Bildirim silinenlere taşındı")
      }
      if (selectedId === id) setSelectedId(null)
  }

  const handleEmptyTrash = async () => {
      try {
          const trashItems = localItems.filter(i => i.isDeleted)
          const batch = writeBatch(db)
          
          trashItems.forEach(item => {
              const ref = doc(db, "announcements", item.id)
              batch.delete(ref)
          })

          await batch.commit()
          setLocalItems(prev => prev.filter(i => !i.isDeleted))
          toast.success("Çöp kutusu boşaltıldı")
          setSelectedId(null)
      } catch (error) {
          console.error(error)
          toast.error("İşlem sırasında hata oluştu")
      }
  }

  const handleArchive = (id: string) => {
      setLocalItems(prev => prev.map(item => {
          if (item.id === id) {
              return { ...item, isArchived: true }
          }
          return item
      }))
      toast.success("Bildirim arşivlendi")
      if (selectedId === id) setSelectedId(null)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-[calc(100vh-64px)] w-full items-stretch overflow-hidden bg-background">
        {/* Static Sidebar - Now truly fixed */}
        <div className="sticky top-0 h-[calc(100vh-64px)] flex w-[240px] flex-col border-r bg-muted/10 shrink-0">
           <div className="sticky top-0 p-2 bg-muted/10">
              <Nav
                isCollapsed={false}
                links={[
                  {
                    title: "Yeni Oluştur",
                    label: "",
                    icon: PenBox,
                    variant: isCreating ? "default" : "ghost",
                    onClick: () => {
                        setIsCreating(true)
                        setSelectedId(null)
                    }
                  },
                  {
                    title: "Gönderilen",
                    label: sentCount > 0 ? sentCount.toString() : "",
                    icon: Send,
                    variant: folder === "sent" && !isCreating ? "default" : "ghost",
                    onClick: () => {
                        setFolder("sent")
                        setIsCreating(false)
                        setSelectedId(null)
                    }
                  },
                  {
                    title: "Arşiv",
                    label: "",
                    icon: Archive,
                    variant: folder === "archive" && !isCreating ? "default" : "ghost",
                    onClick: () => {
                        setFolder("archive")
                        setIsCreating(false)
                        setSelectedId(null)
                    }
                  },
                  {
                    title: "Silinen",
                    label: "",
                    icon: Trash2,
                    variant: folder === "trash" && !isCreating ? "default" : "ghost",
                    onClick: () => {
                        setFolder("trash")
                        setIsCreating(false)
                        setSelectedId(null)
                    }
                  },
                ]}
              />
            </div>
        </div>

        {/* Main Content Area - Takes remaining space */}
        <div className="flex flex-1 min-w-0">
            {isCreating ? (
                // Full Screen Editor Mode
                <MailDisplay
                    mail={null}
                    onSend={handleSend}
                    isCreating={true}
                    onCancelCreate={() => setIsCreating(false)}
                    recipientOptions={recipientOptions}
                />
            ) : (
                // Inbox Split View
                <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
                    <ResizablePanel defaultSize={40} minSize={30} className="overflow-hidden">
                       <div className="flex flex-col h-full">
                         {/* Sticky Header Section */}
                         <div className="sticky top-0 z-10 bg-background border-b">
                           <div className="p-4">
                             {folder === "trash" && (
                                 <div className="mb-3 flex justify-end">
                                     <AlertDialog>
                                       <AlertDialogTrigger asChild>
                                         <Button variant="destructive" size="sm" className="h-7 text-xs">
                                             Silinenleri Boşalt
                                         </Button>
                                       </AlertDialogTrigger>
                                       <AlertDialogContent>
                                         <AlertDialogHeader>
                                           <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                           <AlertDialogDescription>
                                             Bu işlem geri alınamaz. Çöp kutusundaki tüm bildirimler kalıcı olarak silinecektir.
                                           </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                           <AlertDialogCancel>İptal</AlertDialogCancel>
                                           <AlertDialogAction onClick={handleEmptyTrash} className="bg-red-600 hover:bg-red-700">
                                             Evet, sil
                                           </AlertDialogAction>
                                         </AlertDialogFooter>
                                       </AlertDialogContent>
                                     </AlertDialog>
                                 </div>
                             )}
                             <form>
                                 <div className="relative">
                                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                   <Input 
                                     placeholder="Bildirim ara..." 
                                     className="pl-8" 
                                     value={search}
                                     onChange={(e) => setSearch(e.target.value)}
                                   />
                                 </div>
                             </form>
                           </div>
                           {/* Column Headers - Part of sticky section */}
                           <div className="grid grid-cols-12 gap-4 px-7 py-3 text-xs font-semibold text-muted-foreground bg-muted/30 border-t">
                               <div className="col-span-3">Ad Soyad</div>
                               <div className="col-span-6">Konu</div>
                               <div className="col-span-3 text-right">Tarih</div>
                           </div>
                         </div>
                         
                         {/* Scrollable List Content */}
                         <div className="flex-1 overflow-y-auto">
                            <MailList 
                                items={filteredItems} 
                                selectedId={selectedId} 
                                onSelect={setSelectedId} 
                                folder={folder}
                                onDelete={handleDelete}
                                onArchive={handleArchive}
                            />
                         </div>
                       </div>
                    </ResizablePanel>
                    
                    <ResizableHandle withHandle />
                    
                    <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
                        <MailDisplay
                            mail={selectedMail}
                            isCreating={isCreating}
                            onCancelCreate={() => setIsCreating(false)}
                            onSend={handleSend}
                            recipientOptions={recipientOptions}
                         />
                    </ResizablePanel>
                </ResizablePanelGroup>
            )}
        </div>
      </div>
    </TooltipProvider>
  )
}
