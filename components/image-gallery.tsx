"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Edit, Loader2, Upload, Save, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { savePendingImage, generateId, getPendingImages } from "@/lib/offline-storage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface ImageGalleryProps {
    images: string[];
    onImagesChange: (images: string[]) => void;
    auditId: string;
    sectionIndex: number;
    answerIndex: number;
    questionText: string;
    disabled?: boolean;
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
    syncingImages?: string[]; // URLs being synced
    uploadedImages?: string[]; // Recently uploaded URLs
}

export default function ImageGallery({
    images,
    onImagesChange,
    auditId,
    sectionIndex,
    answerIndex,
    questionText,
    disabled = false,
    onUploadStart,
    onUploadEnd,
    syncingImages = [],
    uploadedImages = [],
}: ImageGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [localBlobUrls, setLocalBlobUrls] = useState<Map<string, string>>(new Map());
    const [recentlyUploaded, setRecentlyUploaded] = useState<Set<string>>(new Set());
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
    const isOnline = useOnlineStatus();

    // Show "uploaded" badge for 2 seconds
    useEffect(() => {
        if (uploadedImages && uploadedImages.length > 0) {
            const newUploaded = new Set(uploadedImages);
            setRecentlyUploaded(newUploaded);

            const timer = setTimeout(() => {
                setRecentlyUploaded(new Set());
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [uploadedImages]);

    // Load blob URLs for local images on mount only
    useEffect(() => {
        const loadLocalImages = async () => {
            const pendingImages = await getPendingImages(auditId);
            const blobUrlMap = new Map<string, string>();

            pendingImages.forEach(img => {
                const blobUrl = URL.createObjectURL(img.blob);
                blobUrlMap.set(`local://${img.id}`, blobUrl);
            });

            setLocalBlobUrls(blobUrlMap);
        };

        if (auditId) {
            loadLocalImages();
        }

        // Cleanup blob URLs on unmount
        return () => {
            localBlobUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [auditId]); // Removed images dependency

    // Helper to get displayable URL (convert local:// to blob URL)
    const getDisplayUrl = (url: string): string => {
        if (url.startsWith('local://')) {
            return localBlobUrls.get(url) || '';
        }
        return url;
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadProgress(0);
        onUploadStart?.();

        try {
            if (!isOnline) {
                // OFFLINE MODE: Save to IndexedDB
                const localUrls: string[] = [];

                for (const file of Array.from(files)) {
                    // Compress if needed
                    const fileSizeMB = file.size / 1024 / 1024;
                    let fileToStore = file;

                    if (fileSizeMB > 0.5) {
                        const options = {
                            maxSizeMB: 0.5,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                            initialQuality: 0.85,
                        };
                        fileToStore = await imageCompression(file, options);
                    }

                    // Convert to blob
                    const arrayBuffer = await fileToStore.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: fileToStore.type });

                    const id = generateId();
                    await savePendingImage({
                        id,
                        auditId,
                        sectionIndex,
                        answerIndex,
                        questionText,
                        blob,
                        fileName: file.name,
                        timestamp: Date.now(),
                        uploaded: false,
                    });

                    // Create local preview URL and add to blob map
                    const localUrl = `local://${id}`;
                    const blobUrl = URL.createObjectURL(blob);
                    setLocalBlobUrls(prev => new Map(prev).set(localUrl, blobUrl));
                    localUrls.push(localUrl);
                }

                onImagesChange([...images, ...localUrls]);
                // Removed toast - user already sees offline banner
            } else {
                // ONLINE MODE: Upload directly to Firebase
                const totalFiles = files.length;
                let completedFiles = 0;

                const uploadPromises = Array.from(files).map(async (file) => {
                    // Compress if needed
                    const fileSizeMB = file.size / 1024 / 1024;
                    let fileToUpload = file;

                    if (fileSizeMB > 0.5) {
                        const options = {
                            maxSizeMB: 0.5,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                            initialQuality: 0.85,
                        };
                        fileToUpload = await imageCompression(file, options);
                    }

                    const filename = `audits/${auditId}/${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, filename);

                    return new Promise<string>((resolve, reject) => {
                        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

                        uploadTask.on(
                            'state_changed',
                            (snapshot: any) => {
                                const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                const overallProgress = ((completedFiles + (fileProgress / 100)) / totalFiles) * 100;
                                setUploadProgress(Math.round(overallProgress));
                            },
                            (error: any) => {
                                console.error('Upload error:', error);
                                reject(error);
                            },
                            async () => {
                                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                completedFiles++;
                                resolve(downloadURL);
                            }
                        );
                    });
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                onImagesChange([...images, ...uploadedUrls]);
                toast.success(`${uploadedUrls.length} fotoğraf yüklendi`);
            }
        } catch (error) {
            console.error("Error handling photos:", error);
            toast.error("Fotoğraf işlenirken hata oluştu");
        } finally {
            setUploading(false);
            setUploadProgress(0);
            onUploadEnd?.();
            e.target.value = "";
        }
    };

    const handleRemoveImage = async (index: number) => {
        try {
            const imageUrl = images[index];

            // Delete from Firebase Storage
            if (imageUrl.includes('firebase')) {
                try {
                    // Parse URL to extract storage path
                    const url = new URL(imageUrl);
                    const pathMatch = url.pathname.match(/\/o\/(.+)/);

                    if (pathMatch && pathMatch[1]) {
                        // Decode the URL-encoded path
                        const filePath = decodeURIComponent(pathMatch[1]);
                        const storageRef = ref(storage, filePath);
                        await deleteObject(storageRef);
                        console.log('Successfully deleted from storage:', filePath);
                    }
                } catch (storageError: any) {
                    // Only log if it's not a "file doesn't exist" error
                    if (storageError?.code !== 'storage/object-not-found') {
                        console.error("Storage delete error:", storageError);
                        toast.error("Storage'dan silinemedi");
                    }
                    // Silently ignore if file doesn't exist
                }
            }

            // Remove from state regardless of storage result
            const newImages = images.filter((_, i) => i !== index);
            onImagesChange(newImages);
            toast.success("Fotoğraf kaldırıldı");
        } catch (error) {
            console.error("Error removing image:", error);
            toast.error("Fotoğraf kaldırılırken hata oluştu");
        }
    };

    const confirmDelete = async () => {
        if (deleteConfirmIndex !== null) {
            await handleRemoveImage(deleteConfirmIndex);
            setDeleteConfirmIndex(null);
        }
    };

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {images.map((imageUrl, index) => {
                    const displayUrl = getDisplayUrl(imageUrl);
                    // Skip rendering if no valid URL (avoid empty src error)
                    if (!displayUrl) return null;

                    const isPending = imageUrl.startsWith('local://');
                    const isSyncing = syncingImages?.includes(imageUrl);
                    const isUploaded = recentlyUploaded.has(imageUrl);

                    return (
                        <div key={index} className="relative group">
                            <div className="relative">
                                <img
                                    src={displayUrl}
                                    alt={`Fotoğraf ${index + 1}`}
                                    className={`h-24 w-24 object-cover rounded-lg border cursor-pointer transition-all hover:scale-105 ${isPending ? 'opacity-50' : 'opacity-100'}`}
                                    onClick={() => setSelectedImage(imageUrl)}
                                />

                                {/* Syncing Spinner Overlay */}
                                {isSyncing && (
                                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                                    </div>
                                )}

                                {/* Uploaded Badge */}
                                {isUploaded && (
                                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                                        <div className="bg-green-500 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            Yüklendi
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!disabled && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmIndex(index);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {!disabled && (
                    <label className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={uploading || disabled}
                        />
                        {uploading ? (
                            <div className="flex flex-col items-center gap-1">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">{uploadProgress}%</span>
                            </div>
                        ) : (
                            <Upload className="h-6 w-6 text-muted-foreground" />
                        )}
                    </label>
                )}
            </div>

            {/* Silme Onay Dialog'u */}
            {deleteConfirmIndex !== null && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
                            <h3 className="text-lg font-semibold mb-2">Silmek istediğinizden emin misiniz?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Bu fotoğraf kalıcı olarak silinecektir.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setDeleteConfirmIndex(null)}
                                >
                                    İptal
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={confirmDelete}
                                >
                                    Evet, Sil
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Fullscreen Image Lightbox */}
            {selectedImage && getDisplayUrl(selectedImage) && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={getDisplayUrl(selectedImage)}
                        alt="Önizleme"
                        className="max-w-[95vw] max-h-[95vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
