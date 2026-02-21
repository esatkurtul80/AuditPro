import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type LogLevel = "info" | "warn" | "error";
export type LogCategory = "auth" | "audit" | "system" | "action" | "admin";

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  userRole?: string;
  metadata?: Record<string, any>;
  timestamp?: any;
  userAgent?: string;
  path?: string;
}

// Recursively removes all `undefined` values from an object before writing to Firestore.
// Firestore rejects documents with any `undefined` — even in nested objects.
function deepStripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        v !== null && typeof v === "object" && !Array.isArray(v) && typeof (v as any).toMillis !== "function"
          ? deepStripUndefined(v as Record<string, unknown>)
          : v,
      ])
  );
}

class Logger {
  private static async log(entry: LogEntry) {
    try {
      if (process.env.NODE_ENV === "development") {
        const color = entry.level === "error" ? "\x1b[31m" : entry.level === "warn" ? "\x1b[33m" : "\x1b[36m";
        console.log(
          `${color}[${entry.category.toUpperCase()}] ${entry.message}\x1b[0m`, 
          entry.metadata || ""
        );
      }

      const rawLogData: Record<string, unknown> = {
        ...entry,
        timestamp: serverTimestamp(),
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        path: typeof window !== "undefined" ? window.location.pathname : "server",
        env: process.env.NODE_ENV
      };

      const logData = deepStripUndefined(rawLogData);

      await addDoc(collection(db, "system_logs"), logData);
    } catch (error: any) {
      // Handle "Document already exists" error which can happen during offline sync
      // or if the client generates an ID that collides (extremely rare)
      if (error?.message?.includes("Document already exists") || error?.code === "already-exists") {
        try {
            const rawRetryData: Record<string, unknown> = {
                ...entry,
                timestamp: serverTimestamp(),
                userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
                path: typeof window !== "undefined" ? window.location.pathname : "server",
                env: process.env.NODE_ENV,
                retry: true
            };
            await addDoc(collection(db, "system_logs"), deepStripUndefined(rawRetryData));
        } catch (retryError) {
             console.error("Failed to write log (retry):", retryError);
        }
      } else {
        console.error("Failed to write log:", error);
      }
    }
  }

  static info(category: LogCategory, message: string, metadata?: Record<string, any>, user?: { uid: string; role?: string }) {
    this.log({
      level: "info",
      category,
      message,
      metadata,
      userId: user?.uid,
      userRole: user?.role
    });
  }

  static warn(category: LogCategory, message: string, metadata?: Record<string, any>, user?: { uid: string; role?: string }) {
    this.log({
      level: "warn",
      category,
      message,
      metadata,
      userId: user?.uid,
      userRole: user?.role
    });
  }

  static error(category: LogCategory, message: string, error?: any, user?: { uid: string; role?: string }) {
    this.log({
      level: "error",
      category,
      message,
      metadata: { error: error?.message || error, stack: error?.stack },
      userId: user?.uid,
      userRole: user?.role
    });
  }

  /**
   * Performans ölçümü için zamanlayıcı başlatır.
   * Dönen `stop()` fonksiyonu çağrıldığında geçen süreyi ms olarak hesaplar
   * ve otomatik olarak log yazar.
   * 
   * Kullanım:
   *   const timer = Logger.startTimer("audit", "Audit completed", { auditId }, user);
   *   // ... işlem ...
   *   timer.stop(); // otomatik olarak duration metadata'sıyla loglar
   */
  static startTimer(
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
    user?: { uid: string; role?: string }
  ) {
    const start = performance.now();
    return {
      stop: (extraMetadata?: Record<string, any>) => {
        const duration = Math.round(performance.now() - start);
        this.info(category, message, {
          ...metadata,
          ...extraMetadata,
          duration
        }, user);
      },
      stopWarn: (extraMetadata?: Record<string, any>) => {
        const duration = Math.round(performance.now() - start);
        this.warn(category, message, {
          ...metadata,
          ...extraMetadata,
          duration
        }, user);
      },
      stopError: (err?: any, extraMetadata?: Record<string, any>) => {
        const duration = Math.round(performance.now() - start);
        this.error(category, `${message} (failed)`, {
          error: err?.message || err,
          stack: err?.stack,
          ...metadata,
          ...extraMetadata,
          duration
        } as any, user);
      }
    };
  }
}

export default Logger;
