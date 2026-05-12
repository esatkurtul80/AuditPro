import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * ─── MERKEZİ PUAN KURALI (iç yardımcı) ──────────────────────────────
 * calcAuditScore tarafından içten kullanılır — dışarıdan çağırma.
 * Kural: 99 < ham_puan < 100  → 99
 *        Diğer → Math.round
 */
function _applyRule(raw: number): number {
    if (raw > 99 && raw < 100) return 99;
    return Math.round(raw);
}

/**
 * ─── ALGORİTMA B — TEK KAYNAK PUAN HESAPLAYICI ───────────────────────
 *
 * Tek doğru yer burası. Hem hesaplama formülü (Algoritma B) hem de
 * gösterim kuralı (99 < puan < 100 → 99) bu fonksiyonun içindedir.
 *
 * Formülü veya kuralı değiştirmek istersen YALNIZCA buraya dokun.
 * Başka hiçbir dosyada yuvarlama veya hesaplama mantığı bulunmamalıdır.
 *
 * ── Algoritma B ──────────────────────────────────────────────────────
 *   Her bölüm için: (kazanılan / maksimum) × 100  → bölüm yüzdesi
 *   Final puan    : bölüm yüzdelerinin aritmetik ortalaması
 *   Muaf / boş cevaplar hesaba KATILMAZ.
 *
 * ── Gösterim Kuralı ──────────────────────────────────────────────────
 *   99 < ham_puan < 100  → 99 göster   (hiç tam 100 yapmadan)
 *   Diğer tüm değerler   → Math.round
 *
 * @param sections - Audit["sections"] dizisi (null/undefined → fallback)
 * @param fallback - sections yoksa kullanılacak Firestore puanı
 * @returns Gösterilecek tam sayı puan (0 – 100)
 */
export function calcAuditScore(
    sections: Array<{
        answers?: Array<{
            answer?: string;
            earnedPoints?: number;
            maxPoints?: number;
        }>;
    }> | null | undefined,
    fallback?: number | null
): number {
    // sections yoksa Firestore'daki değeri kural üzerinden döndür
    if (!sections || sections.length === 0) {
        return _applyRule(fallback ?? 0);
    }

    // Her bölümün % puanını hesapla (muaf/boş sorular hariç)
    const sectionScores: number[] = [];
    sections.forEach(sec => {
        let earned = 0, max = 0;
        sec.answers?.forEach(a => {
            if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
                earned += (a.earnedPoints ?? 0);
                max    += (a.maxPoints    ?? 0);
            }
        });
        if (max > 0) sectionScores.push((earned / max) * 100);
    });

    // Geçerli bölüm yoksa yine fallback
    if (sectionScores.length === 0) return _applyRule(fallback ?? 0);

    // Bölüm ortalması → kural → tam sayı
    const avg = sectionScores.reduce((s, v) => s + v, 0) / sectionScores.length;
    return _applyRule(avg);
}

/**
 * @deprecated Yeni kodlarda doğrudan calcAuditScore kullan.
 * Geriye dönük uyumluluk için korunmaktadır.
 */
export function applyScoreRule(raw: number): number {
    return _applyRule(raw);
}


/**
 * Robustly parses a date from various formats including Firestore Timestamps, JS Dates, and serialized objects.
 */
export function parseDate(dateVal: any): Date | null {
    if (!dateVal) return null;
    let d: Date;
    if (dateVal instanceof Date) {
        d = dateVal;
    } else if (typeof dateVal?.toDate === 'function') {
        d = dateVal.toDate();
    } else if (typeof dateVal === 'object' && ('seconds' in dateVal || '_seconds' in dateVal)) {
        const secs = dateVal.seconds ?? dateVal._seconds ?? 0;
        d = new Date(secs * 1000);
    } else {
        d = new Date(dateVal);
    }
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Safely parses and formats a date to a string. Returns fallback string if invalid.
 */
export function formatDateSafe(dateVal: any, formatStr: string, options?: any, fallback: string = "-"): string {
    const d = parseDate(dateVal);
    if (!d) return fallback;
    return format(d, formatStr, options);
}

/**
 * Calculates the number of calendar days between two dates.
 * @param startDate The start date (exclusive)
 * @param endDate The end date (inclusive)
 * @returns Number of calendar days
 */
export const getWorkingDaysPassed = (startDate: Date, endDate: Date) => {
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // If start is after end, return 0
    if (current >= end) return 0;

    const diffMs = end.getTime() - current.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculates the deadline date by adding 3 calendar days.
 * @param startDate The starting date
 * @returns The deadline date
 */
export const calculateDeadlineDate = (startDate: Date) => {
    let date = new Date(startDate);
    date.setDate(date.getDate() + 3);
    return date;
};
