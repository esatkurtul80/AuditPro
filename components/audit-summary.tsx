"use client";

// v.1 Rapor

import React from "react";
import { Audit, AuditAnswer } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, FileText, Image as ImageIcon, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditSummaryProps { audit: Audit; }

function isIncompleteAnswer(answer: AuditAnswer): boolean {
  if (answer.questionType === 'yes_no' || !answer.questionType) return answer.answer === 'hayir';
  if (answer.questionType === 'rating' || answer.questionType === 'multiple_choice' || answer.questionType === 'checkbox') return answer.earnedPoints < answer.maxPoints;
  return false;
}

function hasNotes(answer: AuditAnswer): boolean {
  return !!(answer.notes && answer.notes.length > 0 && answer.notes.some(n => n.trim()));
}

// Hafta numarası hesaplama (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Saat formatlama
function formatTime(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Tarih formatlama
function formatDate(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('tr-TR');
}

export function AuditSummary({ audit }: AuditSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'incomplete' | 'incomplete-notes'>('all');
  const [isDownloading, setIsDownloading] = useState(false);
  const [robotoFont, setRobotoFont] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Font yükleme
  useEffect(() => {
    const loadFont = async () => {
      try {
        const response = await fetch('/fonts/Roboto-Regular.ttf');
        const fontBlob = await response.blob();
        const reader = new FileReader();

        reader.onload = function (e) {
          const fontBase64 = (e.target?.result as string)?.split(',')[1];
          if (fontBase64) {
            setRobotoFont(fontBase64);
          }
        };
        reader.readAsDataURL(fontBlob);
      } catch (error) {
        console.error('Font yükleme hatası:', error);
      }
    };
    loadFont();
  }, []);

  // ESC tuşu ile lightbox kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [lightboxImage]);

  const toggleSection = (sectionId: string) => { setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] })); };

  const getCount = (type: 'all' | 'incomplete' | 'incomplete-notes') => {
    let count = 0;
    audit.sections.forEach(section => {
      section.answers.forEach(answer => {
        if (type === 'all') { if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") count++; }
        else if (type === 'incomplete' && isIncompleteAnswer(answer)) count++;
        else if (type === 'incomplete-notes' && (isIncompleteAnswer(answer) || hasNotes(answer))) count++;
      });
    });
    return count;
  };

  const renderAnswer = (answer: AuditAnswer) => {
    if (answer.questionType === 'yes_no' || !answer.questionType) {
      return (
        <Badge variant={answer.answer === 'hayir' ? 'destructive' : 'outline'} className={answer.answer === 'evet' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' : ''}>
          {answer.answer === 'evet' ? 'Evet' : answer.answer === 'hayir' ? 'Hayır' : 'Muaf'}
        </Badge>
      );
    }
    if (answer.questionType === 'rating') {
      const rating = parseInt(answer.answer) || 0;
      const maxRating = 5;
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: maxRating }, (_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          ))}
        </div>
      );
    }
    if (answer.questionType === 'multiple_choice' && answer.options) {
      const selectedOption = answer.options.find(opt => opt.id === answer.answer);
      return selectedOption ? <span className="text-sm font-medium">{selectedOption.text}</span> : <span className="text-muted-foreground">-</span>;
    }
    if (answer.questionType === 'checkbox' && answer.options) {
      const selectedIds = answer.selectedOptions || [];
      const uncheckedOpts = answer.options.filter(opt => !selectedIds.includes(opt.id));
      if (uncheckedOpts.length > 0) {
        return (
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Eksikler:</span>
            {uncheckedOpts.map(opt => (<span key={opt.id} className="text-red-500 font-medium"> {opt.text}</span>))}
          </div>
        );
      }
      return <span className="text-green-600 font-medium text-sm">Tam Puan</span>;
    }
    return <span className="text-sm">{answer.answer || '-'}</span>;
  };

  const renderMobileCard = (answer: AuditAnswer, sectionName: string, idx: number, qIdx: number) => {
    const isIncomplete = isIncompleteAnswer(answer);
    const hasNotesFlag = hasNotes(answer);

    return (
      <Card key={`mobile-q-${idx}-${qIdx}`} className={`mb-4 overflow-hidden border-2 transition-all hover:shadow-lg ${isIncomplete ? 'border-red-300 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900' : 'border-green-300 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-slate-900'}`}>
        <CardContent className="p-0">
          {/* Header with status icon */}
          <div className={`px-4 py-3 flex items-center gap-3 ${isIncomplete ? 'bg-red-100/50 dark:bg-red-900/30' : 'bg-green-100/50 dark:bg-green-900/30'}`}>
            {isIncomplete ? (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{answer.questionText}</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Answer Section */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Cevap</span>
                {renderAnswer(answer)}
              </div>

              {/* Score Badge */}
              <div className={`ml-4 flex flex-col items-center justify-center rounded-xl px-4 py-3 ${isIncomplete ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'}`}>
                <span className={`text-2xl font-bold ${isIncomplete ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {answer.earnedPoints}
                </span>
                <span className="text-xs text-muted-foreground font-medium">/ {answer.maxPoints}</span>
              </div>
            </div>

            {/* Notes Section */}
            {hasNotesFlag && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Notlar</span>
                </div>
                <div className="space-y-2">
                  {answer.notes?.filter(n => n.trim()).map((note, i) => (
                    <p key={i} className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Photos Section */}
            {answer.photos && answer.photos.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/30 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Fotoğraflar</span>
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 ml-auto">
                    {answer.photos.length} adet
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {answer.photos.map((photo, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxImage(photo)}
                    >
                      <img src={photo} alt={`Fotoğraf ${i + 1}`} className="object-cover w-full h-full" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSectionGroup = (filterType: 'all' | 'incomplete' | 'incomplete-notes') => {
    const hasAnyQuestions = audit.sections.some(section => {
      const filtered = section.answers.filter(a => {
        if (filterType === 'all') return a.answer && a.answer.trim() !== "" && a.answer !== "muaf";
        if (filterType === 'incomplete') return isIncompleteAnswer(a);
        if (filterType === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
        return false;
      });
      return filtered.length > 0;
    });

    if (!hasAnyQuestions) {
      return (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-foreground">
                {filterType === 'all' ? "Soru bulunamadı." : filterType === 'incomplete' ? "Tüm sorularda tam puan alınmış!" : "Puan alınamayan veya notlu soru bulunamadı."}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        {/* Desktop Table View */}
        <Card className="overflow-hidden border-2 hidden lg:block shadow-sm">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 dark:border-slate-700">
                  <th className="w-[35%] font-bold text-foreground text-left py-4 px-6">Soru</th>
                  <th className="w-[20%] font-bold text-foreground text-left py-4 px-6">Cevap</th>
                  <th className="w-[15%] text-center font-bold text-foreground py-4 px-6">Puan</th>
                  <th className="w-[30%] font-bold text-foreground text-left py-4 px-6">Notlar</th>
                </tr>
              </thead>
              <tbody>
                {audit.sections.map((section, idx) => {
                  let sectionEarned = 0;
                  let sectionMax = 0;
                  section.answers.forEach(answer => {
                    if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                      sectionEarned += answer.earnedPoints;
                      sectionMax += answer.maxPoints;
                    }
                  });
                  const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                  const filteredQuestions = section.answers.filter(a => {
                    if (filterType === 'all') return a.answer && a.answer.trim() !== "" && a.answer !== "muaf";
                    if (filterType === 'incomplete') return isIncompleteAnswer(a);
                    if (filterType === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
                    return false;
                  });

                  if (filteredQuestions.length === 0) return null;

                  return (
                    <React.Fragment key={`section-${idx}`}>
                      <tr className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border-t-4 border-slate-200 dark:border-slate-700">
                        <td colSpan={4} className="py-4 px-6">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-foreground">{section.sectionName}</span>
                            <Badge className={`px-4 py-2 text-base font-bold ${sectionScore >= 80 ? 'bg-green-500' : sectionScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                              {sectionScore}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                      {filteredQuestions.map((answer, qIdx) => {
                        const isIncomplete = isIncompleteAnswer(answer);
                        const hasPhotos = answer.photos && answer.photos.length > 0;

                        return (
                          <React.Fragment key={`q-${idx}-${qIdx}`}>
                            <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-b dark:border-slate-700 transition-colors ${isIncomplete ? 'bg-red-50/30 dark:bg-red-950/20' : ''}`}>
                              <td className="align-top py-4 px-6">
                                <div className="flex items-start gap-2">
                                  {isIncomplete ? (
                                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                  )}
                                  <span className="font-medium text-sm text-foreground/90 leading-relaxed">{answer.questionText}</span>
                                </div>
                              </td>
                              <td className="align-top py-4 px-6">{renderAnswer(answer)}</td>
                              <td className="text-center align-top py-4 px-6">
                                <div className={`inline-flex items-center justify-center rounded-lg px-3 py-2 ${isIncomplete ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'} whitespace-nowrap`}>
                                  <span className={`text-xl font-bold ${isIncomplete ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {answer.earnedPoints}
                                  </span>
                                  <span className="text-sm text-muted-foreground font-medium ml-1">/ {answer.maxPoints}</span>
                                </div>
                              </td>
                              <td className="align-top py-4 px-6">
                                {hasNotes(answer) && (
                                  <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-2">
                                    <div className="space-y-1.5">
                                      {answer.notes?.filter(n => n.trim()).map((note, i) => (
                                        <p key={i} className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                                          {note}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {!hasNotes(answer) && !hasPhotos && (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                              </td>
                            </tr>
                            {/* Photos Row */}
                            {hasPhotos && (
                              <tr className={`${isIncomplete ? 'bg-red-50/20 dark:bg-red-950/10' : ''} border-b dark:border-slate-700`}>
                                <td colSpan={4} className="py-3 px-6">
                                  <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/30 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-2 mb-2">
                                      <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                      <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Fotoğraflar</span>
                                      <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 ml-2">
                                        {answer.photos!.length} adet
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-6 gap-2">
                                      {answer.photos!.map((photo, i) => (
                                        <div
                                          key={i}
                                          className="relative aspect-square rounded-md overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => setLightboxImage(photo)}
                                        >
                                          <img src={photo} alt={`Fotoğraf ${i + 1}`} className="object-cover w-full h-full" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="space-y-5 lg:hidden">
          {audit.sections.map((section, idx) => {
            let sectionEarned = 0;
            let sectionMax = 0;
            section.answers.forEach(answer => {
              if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                sectionEarned += answer.earnedPoints;
                sectionMax += answer.maxPoints;
              }
            });
            const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

            const filteredQuestions = section.answers.filter(a => {
              if (filterType === 'all') return a.answer && a.answer.trim() !== "" && a.answer !== "muaf";
              if (filterType === 'incomplete') return isIncompleteAnswer(a);
              if (filterType === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
              return false;
            });

            if (filteredQuestions.length === 0) return null;

            return (
              <Collapsible key={`mobile-section-${idx}`} open={expandedSections[`section-${idx}`]} onOpenChange={() => toggleSection(`section-${idx}`)}>
                <Card className={`mb-4 overflow-hidden border-2 cursor-pointer hover:shadow-xl transition-all ${sectionScore >= 80 ? 'border-green-300' : sectionScore >= 50 ? 'border-yellow-300' : 'border-red-300'}`}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {expandedSections[`section-${idx}`] ? (
                            <ChevronUp className="h-6 w-6 text-primary flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-6 w-6 text-primary flex-shrink-0" />
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <CardTitle className="text-base font-bold text-foreground leading-tight">{section.sectionName}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                              {filteredQuestions.length} soru • {sectionEarned}/{sectionMax} puan
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="px-4 py-2 text-lg font-bold ml-3">
                          {sectionScore}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-4 pb-2 px-3">
                      {filteredQuestions.map((answer, qIdx) => renderMobileCard(answer, section.sectionName, idx, qIdx))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </>
    );
  };

  const ensureRoboto = async () => {
    if (robotoFont) return robotoFont;
    const res = await fetch('/fonts/Roboto-Regular.ttf');
    const blob = await res.blob();
    const reader = new FileReader();
    return await new Promise<string>((resolve, reject) => {
      reader.onload = e => {
        const b64 = (e.target?.result as string)?.split(',')[1];
        b64 ? resolve(b64) : reject('font load fail');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    // Firebase Storage URL'leri için doğrudan proxy kullan
    // Bu, konsoldaki CORS hatalarını engeller
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) return '';

        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result && result.startsWith('data:image') ? result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch {
        return '';
      }
    }

    // Diğer URL'ler için normal fetch dene (büyük ihtimalle local URL'ler)
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache', credentials: 'omit' });
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result && result.startsWith('data:image') ? result : '');
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  };

  const handleDownloadPDF = async (type: 'all' | 'incomplete' | 'incomplete-notes') => {
    setIsDownloading(true);
    try {
      const fontBase64 = await ensureRoboto().catch(() => null);

      const filteredData = audit.sections.map(section => {
        const answers = section.answers.filter(a => {
          if (type === 'all') return a.answer && a.answer.trim() !== "" && a.answer !== "muaf";
          if (type === 'incomplete') return isIncompleteAnswer(a);
          if (type === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
          return false;
        });
        return { ...section, answers };
      }).filter(section => section.answers.length > 0);

      // Fotoğrafları önceden yükle
      const photoMap: Record<string, string> = {};
      const allPhotos: string[] = [];
      filteredData.forEach(section => {
        section.answers.forEach(a => {
          if (a.photos && a.photos.length > 0) {
            a.photos.forEach(p => {
              if (p && !allPhotos.includes(p)) {
                allPhotos.push(p);
              }
            });
          }
        });
      });

      console.log(`Loading ${allPhotos.length} photos...`);

      // Paralel yükleme - her fotoğraf için ayrı ayrı dene
      const photoPromises = allPhotos.map(async (url) => {
        try {
          const b64 = await getBase64FromUrl(url);
          if (b64) {
            photoMap[url] = b64;
            console.log('Photo loaded successfully:', url.substring(0, 50) + '...');
          } else {
            console.warn('Photo returned empty:', url.substring(0, 50) + '...');
          }
        } catch (err) {
          // Silently ignore photo load failures
        }
      });

      await Promise.all(photoPromises);
      console.log(`Successfully loaded ${Object.keys(photoMap).length} out of ${allPhotos.length} photos`);

      const doc = new jsPDF('p', 'mm', 'a4');

      if (fontBase64) {
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        (doc as any).addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');
        (doc as any).addFont('Roboto-Regular.ttf', 'Roboto', 'bold', 'Identity-H');
        doc.setFont('Roboto', 'normal');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Sadece mağaza adı - büyük harflerle
      doc.setFontSize(16);
      const storeName = (audit.storeName || 'MAĞAZA').toLocaleUpperCase('tr-TR');
      doc.text(storeName, 14, yPos);
      yPos += 15;

      // Denetim Bilgileri Tablosu
      const weekNum = audit.startedAt ? getWeekNumber(audit.startedAt.toDate()) : '-';
      const scorePercentage = audit.maxScore > 0 ? `${Math.round((audit.totalScore / audit.maxScore) * 100)}%` : '-';

      autoTable(doc, {
        startY: yPos,
        body: [
          ['MAĞAZA ADI', (audit.storeName || '-').toLocaleUpperCase('tr-TR'), 'DENETMEN', (audit.auditorName || '-').toLocaleUpperCase('tr-TR')],
          ['İLGİLİ HAFTA', weekNum !== '-' ? `${weekNum}.HAFTA` : '-', 'PUANI', `${(() => {
            let totalSectionPercentage = 0;
            let sectionCount = 0;

            audit.sections.forEach(section => {
              let sectionEarned = 0;
              let sectionMax = 0;
              let hasValidQuestions = false;

              section.answers.forEach(a => {
                if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
                  sectionEarned += a.earnedPoints;
                  sectionMax += a.maxPoints;
                  hasValidQuestions = true;
                }
              });

              if (hasValidQuestions && sectionMax > 0) {
                const sectionScore = (sectionEarned / sectionMax) * 100;
                totalSectionPercentage += sectionScore;
                sectionCount++;
              }
            });

            // Bölümlerin ortalaması
            const averageScore = sectionCount > 0 ? totalSectionPercentage / sectionCount : 0;

            // Özel yuvarlama: .50 ve üzeri yukarı, altı aşağı
            const decimalPart = averageScore % 1;
            return decimalPart >= 0.50 ? Math.ceil(averageScore) : Math.floor(averageScore);
          })()}`],
          ['DENETİM TARİHİ', formatDate(audit.startedAt), 'BAŞLANGIÇ VE BİTİŞ SAATİ', `${formatTime(audit.startedAt)} - ${formatTime(audit.completedAt)}`]
        ],
        theme: 'grid',
        styles: {
          font: fontBase64 ? 'Roboto' : 'helvetica',
          fontSize: 9,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold', fillColor: [243, 244, 246], textColor: [0, 0, 0] },
          1: { cellWidth: 45, textColor: [0, 0, 0] },
          2: { cellWidth: 50, fontStyle: 'bold', fillColor: [243, 244, 246], textColor: [0, 0, 0] },
          3: { cellWidth: 52, textColor: [0, 0, 0] }
        },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      // Her section için tablo
      for (const section of filteredData) {
        let sectionEarned = 0, sectionMax = 0;
        section.answers.forEach(a => {
          if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
            sectionEarned += a.earnedPoints;
            sectionMax += a.maxPoints;
          }
        });
        const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

        // Zaten çizilen hücreleri takip etmek için
        const drawnPhotoCells = new Set<string>();

        // Yeni sayfa kontrolü
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        // Section başlığı
        const sectionBoxHeight = 12;
        doc.setFillColor(243, 244, 246);
        doc.setDrawColor(180, 180, 180);
        doc.rect(14, yPos, pageWidth - 28, sectionBoxHeight, 'FD');

        doc.setFontSize(13);
        if (fontBase64) doc.setFont('Roboto', 'bold');
        const sectionNameWidth = doc.getTextWidth(section.sectionName);
        const centerX = 14 + (pageWidth - 28) / 2;
        doc.text(section.sectionName, centerX - sectionNameWidth / 2, yPos + (sectionBoxHeight / 2) + 2);

        doc.setFontSize(16);
        const scoreText = `${sectionScore}`;
        const scoreWidth = doc.getTextWidth(scoreText);
        doc.text(scoreText, pageWidth - 16 - scoreWidth, yPos + (sectionBoxHeight / 2) + 2);

        if (fontBase64) doc.setFont('Roboto', 'normal');
        yPos += sectionBoxHeight;

        // Tablo verileri hazırlama
        const tableBody: any[] = [];

        section.answers.forEach(answer => {
          let answerCell: any = '';

          if (answer.questionType === 'yes_no' || !answer.questionType) {
            answerCell = answer.answer === 'evet' ? 'Evet' : answer.answer === 'hayır' ? 'Hayır' : 'Muaf';
          } else if (answer.questionType === 'rating') {
            // Rating için özel obje
            answerCell = {
              content: '',
              styles: { minCellHeight: 10, halign: 'center', valign: 'middle' },
              raw: { type: 'rating', value: parseInt(answer.answer) || 0 }
            };
          } else if (answer.questionType === 'multiple_choice' && answer.options) {
            const selectedOption = answer.options.find(opt => opt.id === answer.answer);
            answerCell = selectedOption ? selectedOption.text : '-';
          } else if (answer.questionType === 'checkbox' && answer.options) {
            const selectedIds = answer.selectedOptions || [];
            const uncheckedOpts = answer.options.filter(opt => !selectedIds.includes(opt.id));
            if (uncheckedOpts.length > 0) {
              answerCell = 'Eksikler: ' + uncheckedOpts.map(opt => opt.text).join(', ');
            } else {
              answerCell = 'Tam Puan';
            }
          } else {
            answerCell = answer.answer || '-';
          }

          const notesText = hasNotes(answer)
            ? answer.notes?.filter(n => n.trim()).map(note => `• ${note}`).join('\n') || '-'
            : '-';

          // Ana soru satırı
          tableBody.push([
            answer.questionText,
            answerCell,
            `${answer.earnedPoints} / ${answer.maxPoints}`,
            notesText
          ]);

          // Fotoğraf satırı (varsa)
          if (answer.photos && answer.photos.length > 0) {
            // Sadece yüklü fotoğrafları ekle
            const loadedPhotos = answer.photos.filter(p => photoMap[p]);
            if (loadedPhotos.length > 0) {
              tableBody.push([{
                content: `FOTO_ROW:${loadedPhotos.join('|')}`,
                colSpan: 4,
                styles: { minCellHeight: 22, fillColor: [255, 255, 255], cellPadding: 0, rowPageBreak: 'avoid' },
                rowSpan: 1
              }]);
            }
          }
        });

        // autoTable ile tablo oluşturma
        autoTable(doc, {
          startY: yPos,
          head: [['Soru', 'Cevap', 'Puan', 'Notlar']],
          showHead: 'firstPage',
          body: tableBody,
          theme: 'grid',
          styles: { font: fontBase64 ? 'Roboto' : 'helvetica', fontStyle: 'normal', fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.5 },
          headStyles: { font: fontBase64 ? 'Roboto' : 'helvetica', fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle', lineColor: [180, 180, 180], lineWidth: 0.5 },
          bodyStyles: { font: fontBase64 ? 'Roboto' : 'helvetica', fontSize: 8, cellPadding: 3, minCellHeight: 10, valign: 'top', lineColor: [180, 180, 180], lineWidth: 0.5 },
          columnStyles: {
            0: { cellWidth: 70, halign: 'left' },
            1: { cellWidth: 35, halign: 'left' },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 52, halign: 'left' }
          },
          didParseCell: function (data) {
            // Fotoğraf satırı kontrolü - metni temizle
            if (data.section === 'body' && data.column.index === 0) {
              const text = data.cell.text[0] || '';
              if (text.startsWith('FOTO_ROW:')) {
                data.cell.text = [''];
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.minCellHeight = 22;
              }
            }

            // Rating hücresi kontrolü
            if (data.section === 'body' && data.column.index === 1) {
              const raw = data.cell.raw as any;
              if (raw && raw.raw && raw.raw.type === 'rating') {
                data.cell.text = [''];
              }
            }

            // Cevap sütunu hizalama (String olanlar için)
            if (data.section === 'body' && data.column.index === 1) {
              const text = data.cell.text[0] || '';
              if (text === 'Evet' || text === 'Hayır' || text === 'Muaf') {
                data.cell.styles.halign = 'center';
                data.cell.styles.valign = 'middle';
              }
            }

            // Puan sütunu renklendirme
            if (data.section === 'body' && data.column.index === 2) {
              data.cell.styles.valign = 'middle';
              const text = data.cell.text[0] || '';
              const [earned, max] = text.split('/').map(s => parseInt(s.trim()));
              if (!isNaN(earned) && !isNaN(max)) {
                if (earned < max) {
                  data.cell.styles.fillColor = [254, 242, 242];
                  data.cell.styles.textColor = [220, 38, 38];
                  data.cell.styles.fontStyle = 'bold';
                } else {
                  data.cell.styles.fillColor = [240, 253, 244];
                  data.cell.styles.textColor = [22, 163, 74];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          },
          didDrawCell: function (data) {
            // Rating yıldızları çiz
            if (data.section === 'body' && data.column.index === 1) {
              const raw = data.cell.raw as any;
              // raw.raw.type kontrolü (çünkü raw, bizim {content, styles, raw} objemiz)
              if (raw && raw.raw && raw.raw.type === 'rating') {
                const rating = raw.raw.value;
                const safe = Math.max(0, Math.min(5, rating));

                const cell = data.cell;
                const fontSize = 10;
                const starWidth = 4;
                const gap = 1;

                const totalWidth = (5 * starWidth) + (4 * gap);
                const startX = cell.x + (cell.width - totalWidth) / 2;
                const startY = cell.y + (cell.height / 2);

                doc.setFont('ZapfDingbats');
                doc.setFontSize(fontSize);

                for (let i = 0; i < 5; i++) {
                  const isFilled = i < safe;
                  if (isFilled) {
                    doc.setTextColor(255, 165, 0);
                  } else {
                    doc.setTextColor(220, 220, 220);
                  }
                  doc.text('H', startX + (i * (starWidth + gap)), startY, { baseline: 'middle' });
                }

                if (fontBase64) {
                  doc.setFont('Roboto', 'normal');
                } else {
                  doc.setFont('helvetica', 'normal');
                }
                doc.setTextColor(0, 0, 0);
              }
            }

            // Fotoğrafları çiz ve linkleri ekle
            if (data.section === 'body' && data.column.index === 0) {
              const raw = data.cell.raw as any;

              // Zaten çizildiyse tekrar çizme (AutoTable bazen hook'u birden fazla çağırabilir)
              // if ((data.cell as any)._drawn) return;

              let content = '';
              if (raw && typeof raw === 'object' && raw.content) {
                content = raw.content;
              } else if (typeof raw === 'string') {
                content = raw;
              }

              if (content.startsWith('FOTO_ROW:')) {
                const cell = data.cell;
                const photoUrls = content.substring(9).split('|');

                // CRITICAL: Check if we're too close to page bottom
                // If so, don't draw photos - this makes the row appear empty
                // AutoTable will detect this and move the row to next page
                const pageHeight = doc.internal.pageSize.getHeight();
                const imgSize = 22;
                const requiredSpace = 25; // Minimal threshold - just photo size + small buffer

                if (cell.y + requiredSpace > pageHeight - 20) {
                  // Too close to bottom - skip drawing to force page break
                  console.log('Skipping photo draw at page bottom, y:', cell.y);
                  return;
                }

                // Fotoğraf URL'lerine göre unique key oluştur
                const photoKey = photoUrls.sort().join('||');

                // Zaten bu fotoğraflar çizildiyse tekrar çizme
                if (drawnPhotoCells.has(photoKey)) {
                  return;
                }

                // Çizildi olarak işaretle
                drawnPhotoCells.add(photoKey);

                const gap = 0;

                // Fotoğrafları hücrenin tam köşesine yerleştir (padding yok)
                const startX = cell.x; // Padding yok
                const startY = cell.y; // Padding yok - satır ile yapışık

                let x = startX;
                let y = startY;

                photoUrls.forEach((url: string) => {
                  const b64 = photoMap[url];
                  if (b64 && b64.startsWith('data:image')) {
                    try {
                      let format: 'PNG' | 'JPEG' = 'JPEG';
                      if (b64.includes('data:image/png')) {
                        format = 'PNG';
                      } else if (b64.includes('data:image/jpg') || b64.includes('data:image/jpeg')) {
                        format = 'JPEG';
                      }

                      // Sayfa genişliğini kontrol et (overflow korumasi)
                      if (x + imgSize > doc.internal.pageSize.getWidth() - 14) {
                        return;
                      }

                      doc.addImage(b64, format, x, y, imgSize, imgSize, undefined, 'FAST');

                      // Açık gri kenarlık
                      doc.setDrawColor(200, 200, 200);
                      doc.setLineWidth(0.5);
                      doc.rect(x, y, imgSize, imgSize);

                      doc.link(x, y, imgSize, imgSize, { url: url });

                      x += imgSize + gap;
                    } catch (e) {
                      console.error("PDF image drawing error for:", url.substring(0, 50), e);
                    }
                  }
                });
              }
            }
          },
          margin: { left: 14, right: 14 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 3;
      }

      // PDF'i indir
      const storeNameForFile = audit.storeName ? audit.storeName.replace(/\s+/g, '_') : 'Mağaza';
      const timestamp = new Date().getTime();
      const fileName = `Denetim_Raporu_${storeNameForFile}_${type}_${timestamp}.pdf`;
      doc.save(fileName);

      console.log('PDF download completed successfully');

    } catch (error) {
      console.error('PDF download error:', error);
      alert('PDF oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Denetim Bilgileri Kartı */}
      <Card className="border-2 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 py-6">
          <CardTitle className="text-2xl font-bold text-white text-center">📋 Denetim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Mağaza Adı */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mağaza Adı</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{audit.storeName || '-'}</p>
            </div>

            {/* Denetmen */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Denetmen</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{audit.auditorName || '-'}</p>
            </div>

            {/* İlgili Hafta */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">İlgili Hafta</p>
              <p className="text-base font-bold text-blue-900 dark:text-blue-100">
                {audit.startedAt ? `${getWeekNumber(audit.startedAt.toDate())}.HAFTA` : '-'}
              </p>
            </div>

            {/* Denetim Puanı */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">Denetim Puanı</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {(() => {
                  let totalSectionPercentage = 0;
                  let sectionCount = 0;

                  audit.sections.forEach(section => {
                    let sectionEarned = 0;
                    let sectionMax = 0;
                    let hasValidQuestions = false;

                    section.answers.forEach(a => {
                      if (a.answer && a.answer.trim() !== "" && a.answer !== "muaf") {
                        sectionEarned += a.earnedPoints;
                        sectionMax += a.maxPoints;
                        hasValidQuestions = true;
                      }
                    });

                    if (hasValidQuestions && sectionMax > 0) {
                      const sectionScore = (sectionEarned / sectionMax) * 100;
                      totalSectionPercentage += sectionScore;
                      sectionCount++;
                    }
                  });

                  // Bölümlerin ortalaması
                  const averageScore = sectionCount > 0 ? totalSectionPercentage / sectionCount : 0;

                  // Özel yuvarlama: .50 ve üzeri yukarı, altı aşağı
                  const decimalPart = averageScore % 1;
                  const finalScore = decimalPart >= 0.50 ? Math.ceil(averageScore) : Math.floor(averageScore);

                  return finalScore;
                })()}
              </p>
            </div>

            {/* Denetim Tarihi */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Denetim Tarihi</p>
              <p className="text-base font-bold text-purple-900 dark:text-purple-100">{formatDate(audit.startedAt)}</p>
            </div>

            {/* Denetim Saatleri */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-3">Denetim Saatleri</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-700 dark:text-orange-300">Başlama</span>
                  <span className="text-base font-bold text-orange-900 dark:text-orange-100">{formatTime(audit.startedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-700 dark:text-orange-300">Bitiş</span>
                  <span className="text-base font-bold text-orange-900 dark:text-orange-100">{formatTime(audit.completedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <TabsList className="grid grid-cols-3 h-auto p-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex-1 min-w-[280px]">
            <TabsTrigger
              value="all"
              className="flex flex-col sm:flex-row items-center gap-1.5 py-3 px-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Tüm Sorular</span>
              <Badge variant="secondary" className="ml-1 font-bold">{getCount('all')}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="incomplete"
              className="flex flex-col sm:flex-row items-center gap-1.5 py-3 px-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white"
            >
              <XCircle className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Eksikler</span>
              <Badge variant="destructive" className="ml-1 font-bold">{getCount('incomplete')}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="incomplete-notes"
              className="flex flex-col sm:flex-row items-center gap-1.5 py-3 px-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold text-xs sm:text-sm">Notlular</span>
              <Badge variant="outline" className="ml-1 font-bold">{getCount('incomplete-notes')}</Badge>
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={() => handleDownloadPDF(activeTab)}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700 whitespace-nowrap"
            size="lg"
          >
            <Download className={`h-4 w-4 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isDownloading ? 'Hazırlanıyor...' : 'PDF İndir'}</span>
            <span className="sm:hidden">{isDownloading ? '...' : 'PDF'}</span>
          </Button>
        </div>

        <TabsContent value="all" className="mt-0">{renderSectionGroup('all')}</TabsContent>
        <TabsContent value="incomplete" className="mt-0">{renderSectionGroup('incomplete')}</TabsContent>
        <TabsContent value="incomplete-notes" className="mt-0">{renderSectionGroup('incomplete-notes')}</TabsContent>
      </Tabs>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            aria-label="Kapat"
          >
            <XCircle className="h-8 w-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Tam boyut fotoğraf"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
