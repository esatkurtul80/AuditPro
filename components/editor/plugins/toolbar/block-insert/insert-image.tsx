import { ImagePlusIcon } from "lucide-react"

import { useToolbarContext } from "@/components/editor/context/toolbar-context"
import { InsertImageDialog } from "@/components/editor/plugins/images-plugin"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function InsertImage() {
  const { activeEditor, showModal } = useToolbarContext()

  return (
    <DropdownMenuItem
      onSelect={() => {
        showModal("Insert Image", (onClose) => (
          <InsertImageDialog activeEditor={activeEditor} onClose={onClose} />
        ))
      }}
      className=""
    >
      <div className="flex items-center gap-1">
        <ImagePlusIcon className="size-4" />
        <span>Image</span>
      </div>
    </DropdownMenuItem>
  )
}
