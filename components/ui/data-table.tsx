"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    searchPlaceholder?: string
    onRowClick?: (row: TData) => void
    toolbar?: React.ReactNode
    actionElement?: React.ReactNode
    mobileHiddenColumns?: string[]
    initialColumnVisibility?: VisibilityState
    initialSorting?: SortingState
    rowClassName?: string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    searchPlaceholder = "Filter...",
    onRowClick,
    toolbar,
    actionElement,
    mobileHiddenColumns = [],
    initialColumnVisibility = {},
    initialSorting = [],
    rowClassName,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(initialColumnVisibility)
    const [rowSelection, setRowSelection] = React.useState({})

    // Hide specified columns on mobile by default
    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768 && mobileHiddenColumns.length > 0) { // Mobile breakpoint
                setColumnVisibility((prev) => {
                    const newVisibility = { ...prev };
                    mobileHiddenColumns.forEach(col => {
                        newVisibility[col] = false;
                    });
                    return newVisibility;
                });
            }
        };

        // Run on mount
        handleResize();
    }, [mobileHiddenColumns]);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row items-stretch md:items-center py-4 gap-4">
                {searchKey && (
                    <Input
                        placeholder={searchPlaceholder}
                        value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn(searchKey)?.setFilterValue(event.target.value)
                        }
                        className="w-full md:max-w-sm"
                    />
                )}
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                    {toolbar}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full md:w-auto md:ml-auto">
                            Sütunlar <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                const header = column.columnDef.header;
                                const label = (column.columnDef.meta as any)?.title || (typeof header === "string" ? header : column.id);
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {label}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
                {actionElement}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={() => onRowClick?.(row.original)}
                                    className={cn(onRowClick ? "cursor-pointer hover:bg-muted/50" : "", rowClassName)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Sonuç bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between py-4 gap-4">
                <div className="flex-1 text-sm text-muted-foreground text-center md:text-left">
                    Toplam {table.getFilteredRowModel().rows.length} kayıt
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 lg:gap-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Sayfa başına satır</p>
                        <select
                            value={table.getState().pagination.pageSize}
                            onChange={(e) => {
                                table.setPageSize(Number(e.target.value))
                            }}
                            className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm"
                        >
                            {[10, 20, 30, 40, 50].map((pageSize) => (
                                <option key={pageSize} value={pageSize}>
                                    {pageSize}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">İlk sayfaya git</span>
                            {"<<"}
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Önceki sayfaya git</span>
                            {"<"}
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Sonraki sayfaya git</span>
                            {">"}
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Son sayfaya git</span>
                            {">>"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
