"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_VARIABLE }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
    [k in string]: {
        label?: React.ReactNode
        icon?: React.ComponentType
    } & (
        | { color?: string; theme?: never }
        | { color?: never; theme: Record<keyof typeof THEMES, string> }
    )
}

type ChartContextProps = {
    config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
    const context = React.useContext(ChartContext)

    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />")
    }

    return context
}

// Simple responsive container without Recharts
const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        config: ChartConfig
        children: React.ReactNode
    }
>(({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                ref={ref}
                className={cn(
                    "flex aspect-video justify-center text-xs w-full h-full",
                    className
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <div className="w-full h-full">
                    {children}
                </div>
            </div>
        </ChartContext.Provider>
    )
})
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
    const colorConfig = Object.entries(config).filter(
        ([_, config]) => config.theme || config.color
    )

    if (!colorConfig.length) {
        return null
    }

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(THEMES)
                    .map(
                        ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
                                .map(([key, item]) => {
                                    const color =
                                        item.theme?.[theme as keyof typeof item.theme] ||
                                        item.color
                                    return color ? `  --color-${key}: ${color};` : null
                                })
                                .join("\n")}
}
`
                    )
                    .join("\n"),
            }}
        />
    )
}

// Placeholder tooltip components - charts are disabled
const ChartTooltip = ({ children }: { children?: React.ReactNode; cursor?: boolean; content?: React.ReactNode }) => {
    return <>{children}</>
}

const ChartTooltipContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        hideLabel?: boolean
        hideIndicator?: boolean
        indicator?: "line" | "dot" | "dashed"
        nameKey?: string
        labelKey?: string
    }
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "rounded-lg border bg-background p-2 shadow-md",
                className
            )}
            {...props}
        />
    )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

// Placeholder legend components
const ChartLegend = ({ children }: { children?: React.ReactNode }) => {
    return <>{children}</>
}

const ChartLegendContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        hideIcon?: boolean
        nameKey?: string
        payload?: Array<{ value: string; dataKey?: string; color?: string }>
        verticalAlign?: "top" | "bottom"
    }
>(({ className, payload, ...props }, ref) => {
    const { config } = useChart()

    if (!payload?.length) {
        return null
    }

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-center justify-center gap-4 text-xs",
                className
            )}
            {...props}
        >
            {payload.map((item, index) => {
                const key = item.dataKey || item.value
                const itemConfig = config[key as keyof typeof config]
                const color = item.color || (itemConfig as { color?: string })?.color

                return (
                    <div key={index} className="flex items-center gap-1.5">
                        <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-muted-foreground">
                            {itemConfig?.label || item.value}
                        </span>
                    </div>
                )
            })}
        </div>
    )
})
ChartLegendContent.displayName = "ChartLegendContent"

export {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    ChartStyle,
}
