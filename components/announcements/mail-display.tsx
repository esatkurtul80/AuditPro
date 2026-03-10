"use client"

import Image from "next/image"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Trash2, Send, Bold, Italic, Strikethrough, List, ListOrdered,
  Link2, Palette, Underline as UnderlineIcon, Undo2, Redo2, AlignLeft,
  AlignCenter, AlignRight, Minus, Quote, Image as ImageIcon
} from "lucide-react"
import { useState, useCallback } from "react"
import { Loader2 } from "lucide-react"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { Link } from "@tiptap/extension-link"
import { Underline as UnderlineExt } from "@tiptap/extension-underline"
import { TextAlign } from "@tiptap/extension-text-align"
import { Image as ImageExt } from "@tiptap/extension-image"

import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { Announcement } from "@/lib/types"
import { RecipientSelector, RecipientOption } from "@/components/announcements/recipient-selector"
import { ReadStatus } from "@/components/announcements/read-status"
import { cn } from "@/lib/utils"

interface MailDisplayProps {
  mail: Announcement | null
  isCreating: boolean
  onCancelCreate: () => void
  onSend: (data: any) => Promise<void>
  recipientOptions: RecipientOption[]
}

// ── Toolbar button helper ──
function ToolbarBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClick() }}
          disabled={disabled}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
            "hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
            active ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  )
}

const TEXT_COLORS = [
  "#000000", "#374151", "#6B7280", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
]

// ── Main component ──
export function MailDisplay({ mail, isCreating, onCancelCreate, onSend, recipientOptions }: MailDisplayProps) {
  const [subject, setSubject] = useState("")
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [isSending, setIsSending] = useState(false)

  // Modals state
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")

  const [isImageOpen, setIsImageOpen] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline cursor-pointer" } }),
      // Image extension is needed for images
      ImageExt.configure({
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      })
    ],
    immediatelyRender: false,
    content: "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[400px] p-4 prose prose-sm dark:prose-invert max-w-none text-foreground",
      },
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run()
    }
    setIsLinkOpen(false)
    setLinkUrl("")
  }, [editor, linkUrl])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && editor) {
      const file = e.target.files[0]
      setIsUploadingImage(true)
      try {
        // Safe string for subject (removing special chars, spaces to underscores)
        const safeSubject = subject
          ? subject.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
          : 'bildirim_resmi'
        const dateStr = format(new Date(), "yyyyMMdd_HHmmss")
        const uniqueId = Math.random().toString(36).substring(2, 8)
        const fileExt = file.name.split('.').pop()

        const fileName = `${safeSubject}_${dateStr}_${uniqueId}.${fileExt}`
        const storageRef = ref(storage, `announcements/${fileName}`)

        await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(storageRef)

        editor.chain().focus().setImage({ src: downloadUrl }).run()
        setIsImageOpen(false)
      } catch (error) {
        console.error("Resim yükleme hatası:", error)
        alert("Resim yüklenirken bir hata oluştu.")
      } finally {
        setIsUploadingImage(false)
      }
    }
  }

  const handleSendClick = async () => {
    if (recipients.length === 0 || !editor) return
    setIsSending(true)
    const htmlContent = editor.getHTML()
    await onSend({ subject, content: htmlContent, recipients })
    setIsSending(false)
    setSubject("")
    setRecipients([])
    editor.commands.clearContent()
  }

  // ── Toolbar ──
  const toolbar = editor ? (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 shrink-0">
      {/* Undo / redo */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Geri Al" disabled={!editor.can().undo()}>
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="İleri Al" disabled={!editor.can().redo()}>
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Heading select */}
      <select
        className="h-7 text-xs rounded border border-input bg-background px-1.5 text-muted-foreground focus:outline-none"
        onChange={(e) => {
          const v = e.target.value
          if (v === "p") editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run()
        }}
        value={
          editor.isActive("heading", { level: 1 }) ? "1"
            : editor.isActive("heading", { level: 2 }) ? "2"
              : editor.isActive("heading", { level: 3 }) ? "3"
                : "p"
        }
      >
        <option value="p">Normal</option>
        <option value="1">Başlık 1</option>
        <option value="2">Başlık 2</option>
        <option value="3">Başlık 3</option>
      </select>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Formatting */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Kalın (Ctrl+B)">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="İtalik (Ctrl+I)">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Altı Çizgili (Ctrl+U)">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Üstü Çizgili">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Alıntı">
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Alignment */}
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Sola Hizala">
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Ortala">
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Sağa Hizala">
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Madde İşaretli Liste">
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numaralı Liste">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Yatay Çizgi">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Link Popover */}
      <Popover open={isLinkOpen} onOpenChange={(open) => {
        setIsLinkOpen(open);
        if (open) setLinkUrl(editor.getAttributes("link").href || "");
      }}>
        <PopoverTrigger asChild>
          <div className="inline-block">
            <ToolbarBtn onClick={() => { }} active={editor.isActive("link")} title="Bağlantı Ekle">
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="flex flex-col gap-2">
            <h4 className="font-medium leading-none text-sm">Bağlantı Ekle</h4>
            <div className="flex gap-2 items-center mt-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setLink();
                  }
                }}
              />
              <Button size="sm" onClick={setLink} className="h-8 px-3">Ekle</Button>
            </div>
            {editor.isActive("link") && (
              <Button variant="ghost" size="sm" onClick={() => { setLinkUrl(""); setLink(); }} className="h-7 text-xs text-red-500 mt-1">
                Bağlantıyı Kaldır
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Image Popover */}
      <Popover open={isImageOpen} onOpenChange={setIsImageOpen}>
        <PopoverTrigger asChild>
          <div className="inline-block">
            <ToolbarBtn onClick={() => { }} active={editor.isActive("image")} title="Resim Ekle">
              <ImageIcon className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="flex flex-col gap-3">
            <h4 className="font-medium leading-none text-sm">Bilgisayardan Resim Yükle</h4>

            <div className="grid gap-2">
              <Label htmlFor="image-upload" className="text-xs text-muted-foreground">Desteklenen formatlar: JPG, PNG, WEBP, GIF</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
                className="h-8 text-xs file:h-8 file:border-0 file:bg-transparent file:text-xs file:font-medium"
              />
              {isUploadingImage && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-1 bg-muted/50 py-1.5 rounded">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Resim yükleniyor...
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Text Color */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 w-7 flex flex-col items-center justify-center rounded text-sm transition-colors hover:bg-muted text-muted-foreground relative ml-0.5"
            title="Metin Rengi"
          >
            <Palette className="h-3.5 w-3.5" />
            <span
              className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded-full"
              style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000" }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
                className="h-6 w-6 rounded-full border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Rengi Temizle
          </button>
        </PopoverContent>
      </Popover>
    </div>
  ) : null

  // Create form - always mounted, CSS hidden when not creating
  const createForm = (
    <div className={`flex h-full w-full flex-1 flex-col overflow-hidden ${isCreating ? "" : "hidden"}`}>
      {/* Sticky Header with Send Button */}
      <div className="sticky top-0 z-10 flex h-[52px] items-center px-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onCancelCreate}>
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
            <div className="flex-1 min-h-[480px] border rounded-md overflow-hidden bg-background flex flex-col">
              {toolbar}
              <div className="flex-1 overflow-y-auto">
                <EditorContent editor={editor} className="h-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Mail view
  const mailView = mail ? (
    <div className={`flex h-full w-full flex-1 flex-col ${isCreating ? "hidden" : ""}`}>
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
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full w-full flex-1 bg-background overflow-hidden relative">
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
