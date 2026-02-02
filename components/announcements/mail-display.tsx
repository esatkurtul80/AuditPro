import Image from "next/image"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Trash2, Send, Reply } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

import { Announcement } from "@/lib/types"
import { RecipientSelector, RecipientOption } from "@/components/announcements/recipient-selector"

import { useState } from "react"
import { Loader2 } from "lucide-react"

// Updated to use new Shadcn Editor X
import { Editor } from "@/components/blocks/editor-x/editor"
import { ReadStatus } from "@/components/announcements/read-status"

interface MailDisplayProps {
  mail: Announcement | null
  isCreating: boolean
  onCancelCreate: () => void
  onSend: (data: any) => Promise<void>
  recipientOptions: RecipientOption[]
}

export function MailDisplay({ mail, isCreating, onCancelCreate, onSend, recipientOptions }: MailDisplayProps) {
    const [subject, setSubject] = useState("")
    const [content, setContent] = useState("") 
    const [recipients, setRecipients] = useState<RecipientOption[]>([])
    const [isSending, setIsSending] = useState(false)

    const handleSendClick = async () => {
        if (recipients.length === 0) return
        setIsSending(true)
        await onSend({ subject, content, recipients })
        setIsSending(false)
        setSubject("")
        setContent("")
        setRecipients([])
    }

  // Create form - always mounted, CSS hidden when not creating
  const createForm = (
      <div className={`flex h-full flex-col overflow-hidden ${isCreating ? '' : 'hidden'}`}>
           {/* Sticky Header with Send Button */}
           <div className="sticky top-0 z-10 flex h-[52px] items-center px-4 border-b bg-background shrink-0">
             <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={onCancelCreate} >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">İptal</span>
                 </Button>
             </div>
             <div className="ml-auto flex items-center gap-2">
                 <Button onClick={handleSendClick} disabled={isSending || recipients.length === 0} size="sm">
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Gönder
                 </Button>
             </div>
           </div>
           
           {/* Scrollable Content */}
           <div className="flex-1 overflow-y-auto min-h-0">
               <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Kime</Label>
                        <RecipientSelector 
                            options={recipientOptions}
                            selected={recipients}
                            onChange={setRecipients}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Konu</Label>
                        <Input 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)} 
                            placeholder="Bildirim başlığı..."
                        />
                    </div>
                    <div className="space-y-2 flex flex-1 min-w-0 flex-col">
                        <Label>İçerik</Label>
                        <div className="flex-1 min-h-0 h-[750px]">
                             <Editor 
                                onChangeHtml={(html) => {
                                    setContent(html) 
                                }}
                             />
                        </div>
                    </div>
               </div>
           </div>
      </div>
  )

  // Mail view
  const mailView = mail ? (
    <div className={`flex h-full flex-col ${isCreating ? 'hidden' : ''}`}>
        <div className="sticky top-0 z-10 flex items-start p-4 bg-background border-b h-[85px] items-center shrink-0">
          <div className="flex items-start gap-4 text-sm">
            <Avatar>
              <AvatarImage alt={mail.senderName} />
              <AvatarFallback>
                {mail.senderName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <div className="font-semibold">{mail.senderName}</div>
              <div className="line-clamp-1 text-xs">{mail.title}</div>
              <div className="line-clamp-1 text-xs">
                <span className="font-medium">Tarih:</span>{" "}
                {mail.createdAt && format(mail.createdAt.toDate(), "PPpp", { locale: tr })}
              </div>
            </div>
          </div>
        </div>
       <div className="flex flex-1 flex-col overflow-y-auto">
        <Separator />
        <div className="flex-1 p-4 text-sm bg-background">
            {/* Display announcement content as HTML */}
            <div dangerouslySetInnerHTML={{ __html: mail.content }} className="prose prose-sm dark:prose-invert max-w-none" />
            
            {/* Read Status - only show if mail has recipients */}
            {mail.recipients && mail.recipients.length > 0 && (
                <ReadStatus 
                    announcementId={mail.id} 
                    recipients={mail.recipients}
                />
            )}
        </div>
      </div>
    </div>
  ) : null

  // Empty state
  const emptyState = !mail && !isCreating ? (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full bg-background overflow-hidden relative">
      <span className="text-lg font-medium mb-6 z-10 relative">Listeden bir bildirim seçin veya yeni oluşturun.</span>
      <Image 
        src="/login-assets-new/logo.png" 
        alt="AuditPro Logo" 
        width={550} 
        height={550} 
        className="opacity-20 pointer-events-none select-none grayscale absolute"
      />
    </div>
  ) : null

  return (
    <>
      {createForm}
      {mailView}
      {emptyState}
    </>
  )
}
