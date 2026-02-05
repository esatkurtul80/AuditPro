import { Column } from "@tanstack/react-table"
import { ArrowUpDown, EyeOff, ListFilter } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"

interface DataTableColumnHeaderProps<TData, TValue>
    extends React.HTMLAttributes<HTMLDivElement> {
    column: Column<TData, TValue>
    title: string
    showFilter?: boolean
}

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
    showFilter = true,
}: DataTableColumnHeaderProps<TData, TValue>) {
    // Generate unique options from the column data for the faceted filter
    // Priority: 1. Manual options from column meta 2. Auto-generated from data
    
    // Safety check: Only calculate if showFilter is true to verify facets
    // Also handling potential errors if column doesn't support faceting
    let options: { label: string; value: string }[] = [];
    
    if (showFilter) {
        try {
            const facilities = column.getFacetedUniqueValues();
            const metaOptions = (column.columnDef.meta as any)?.filterOptions;
    
            options = metaOptions || (facilities ? Array.from(facilities.keys())
                .filter((key: any) => key !== undefined && key !== null && key !== "")
                .sort()
                .map((key: any) => ({
                    label: String(key),
                    value: String(key),
                })) : []);
        } catch (e) {
            console.warn("Failed to get faceted unique values", e);
            options = [];
        }
    }

    if (!column.getCanSort()) {
        return <div className={cn(className)}>{title}</div>
    }

    return (
        <div className={cn("flex items-center space-x-2", className)}>
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                <span>{title}</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            {showFilter && (
                <div className="flex items-center">
                    <DataTableFacetedFilter
                        column={column}
                        title={title}
                        options={options}
                    />
                </div>
            )}
        </div>
    )
}
