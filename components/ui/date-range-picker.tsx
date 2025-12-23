"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangeFilter } from "@/lib/types";

interface DateRangePickerProps {
    value: DateRangeFilter;
    onChange: (range: DateRangeFilter) => void;
    className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
    const [fromOpen, setFromOpen] = React.useState(false);
    const [toOpen, setToOpen] = React.useState(false);

    return (
        <div className={cn("flex gap-2", className)}>
            {/* Start Date */}
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !value.from && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {value.from ? (
                            format(value.from, "dd MMM yyyy", { locale: tr })
                        ) : (
                            <span>Başlangıç</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value.from}
                        onSelect={(date) => {
                            onChange({ ...value, from: date });
                            setFromOpen(false);
                        }}
                        initialFocus
                        locale={tr}
                    />
                </PopoverContent>
            </Popover>

            <span className="flex items-center text-muted-foreground">-</span>

            {/* End Date */}
            <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !value.to && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {value.to ? (
                            format(value.to, "dd MMM yyyy", { locale: tr })
                        ) : (
                            <span>Bitiş</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value.to}
                        onSelect={(date) => {
                            onChange({ ...value, to: date });
                            setToOpen(false);
                        }}
                        initialFocus
                        locale={tr}
                        disabled={(date) => value.from ? date < value.from : false}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
