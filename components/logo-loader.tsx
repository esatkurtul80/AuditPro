import Image from "next/image";

export function LogoLoader() {
    return (
        <div className="flex flex-col items-center justify-center p-8 w-full h-full">
            <div className="relative w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] md:w-64 md:h-64 animate-pulse">
                <Image
                    src="/login-assets-new/logo.png"
                    alt="Yükleniyor..."
                    fill
                    className="object-contain"
                    priority
                />
            </div>
        </div>
    );
}
