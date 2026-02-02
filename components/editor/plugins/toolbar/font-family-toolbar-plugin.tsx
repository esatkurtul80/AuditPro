"use client"

import { useCallback, useState } from "react"
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
} from "@lexical/selection"
import { $getSelection, $isRangeSelection, BaseSelection } from "lexical"
import { TypeIcon } from "lucide-react"

import { useToolbarContext } from "@/components/editor/context/toolbar-context"
import { useUpdateToolbarHandler } from "@/components/editor/editor-hooks/use-update-toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const FONT_FAMILY_OPTIONS = [
  "Arial",
  "Verdana",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Trebuchet MS",
]

export function FontFamilyToolbarPlugin() {
  const style = "font-family"
  const [fontFamily, setFontFamily] = useState("Arial")

  const { activeEditor } = useToolbarContext()

  const $updateToolbar = (selection: BaseSelection) => {
    if ($isRangeSelection(selection)) {
      setFontFamily(
        $getSelectionStyleValueForProperty(selection, "font-family", "Arial")
      )
    }
  }

  useUpdateToolbarHandler($updateToolbar)

  const handleClick = useCallback(
    (option: string) => {
      activeEditor.update(() => {
        const selection = $getSelection()
        if (selection !== null) {
          $patchStyleText(selection, {
            [style]: option,
          })
        }
      })
    },
    [activeEditor, style]
  )

  const buttonAriaLabel = "Formatting options for font family"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild aria-label={buttonAriaLabel}>
         <Button variant="ghost" className="h-8 w-min gap-1 px-2">
            <TypeIcon className="size-4" />
            <span style={{ fontFamily }}>{fontFamily}</span>
         </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {FONT_FAMILY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => {
              setFontFamily(option)
              handleClick(option)
            }}
            style={{ fontFamily: option }}
          >
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
