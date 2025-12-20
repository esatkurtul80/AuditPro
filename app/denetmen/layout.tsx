import { FloatingActionButton } from "@/components/floating-action-button";

export default function DenetmenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <FloatingActionButton />
        </>
    );
}
