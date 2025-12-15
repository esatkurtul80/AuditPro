"use client";

import { Audit, AuditAnswer } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, FileText, Image as ImageIcon } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AuditSummaryProps {
    audit: Audit;
}

// Helper: Check if answer is incomplete (did not receive full points)
function isIncompleteAnswer(answer: AuditAnswer): boolean {
    // Yes/No: "hayir" is incomplete
    if (answer.questionType === 'yes_no' || !answer.questionType) {
        return answer.answer === 'hayir';
    }

    // Rating, Multiple Choice, Checkbox: earnedPoints < maxPoints
    if (answer.questionType === 'rating' ||
        answer.questionType === 'multiple_choice' ||
        answer.questionType === 'checkbox') {
        return answer.earnedPoints < answer.maxPoints;
    }

    return false;
}

// Helper: Check if answer has notes
function hasNotes(answer: AuditAnswer): boolean {
    return !!(answer.notes && answer.notes.length > 0 && answer.notes.some(n => n.trim()));
}

export function AuditSummary({ audit }: AuditSummaryProps) {
    // Helper function to calculate counts for tabs
    const getCount = (type: 'all' | 'incomplete' | 'incomplete-notes') => {
        let count = 0;
        audit.sections.forEach(section => {
            section.answers.forEach(answer => {
                if (type === 'all') count++;
                else if (type === 'incomplete' && isIncompleteAnswer(answer)) count++;
                else if (type === 'incomplete-notes' && (isIncompleteAnswer(answer) || hasNotes(answer))) count++;
            });
        });
        return count;
    };

    const renderAnswer = (answer: AuditAnswer) => {
        // Yes/No Questions
        if (answer.questionType === 'yes_no' || !answer.questionType) {
            return (
                <Badge variant={answer.answer === 'hayir' ? 'destructive' : 'outline'} className={answer.answer === 'evet' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' : ''}>
                    {answer.answer === 'evet' ? 'Evet' : answer.answer === 'hayir' ? 'Hayır' : 'Muaf'}
                </Badge>
            );
        }

        // Rating Questions: Show stars
        if (answer.questionType === 'rating' && answer.ratingMax) {
            const rating = parseInt(answer.answer) || 0;
            return (
                <div className="flex items-center gap-1">
                    <div className="flex">
                        {Array.from({ length: answer.ratingMax }, (_, i) => (
                            <Star
                                key={i}
                                className={`h-4 w-4 ${i < rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                            />
                        ))}
                    </div>
                </div>
            );
        }

        // Multiple Choice: Show selected option
        if (answer.questionType === 'multiple_choice' && answer.options) {
            const selectedOption = answer.options.find(opt => opt.id === answer.answer);
            return selectedOption ? (
                <span className="text-sm font-medium">
                    {selectedOption.text}
                </span>
            ) : <span className="text-muted-foreground">-</span>;
        }

        // Checkbox: Show selected options count or list
        if (answer.questionType === 'checkbox' && answer.options) {
            const selectedIds = answer.selectedOptions || [];
            const uncheckedOpts = answer.options.filter(opt => !selectedIds.includes(opt.id));

            if (uncheckedOpts.length > 0) {
                return (
                    <div className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Eksikler:</span>
                        {uncheckedOpts.map(opt => (
                            <span key={opt.id} className="text-red-500 font-medium whitespace-normal">
                                • {opt.text}
                            </span>
                        ))}
                    </div>
                )
            }
            return <span className="text-green-600 font-medium text-sm">Tam Puan</span>
        }

        return <span className="text-sm">{answer.answer || '-'}</span>;
    };

    const renderSectionGroup = (filterType: 'all' | 'incomplete' | 'incomplete-notes') => {
        const hasAnyQuestions = audit.sections.some(section => {
            const filtered = section.answers.filter(a => {
                if (filterType === 'all') return true;
                if (filterType === 'incomplete') return isIncompleteAnswer(a);
                if (filterType === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
                return false;
            });
            return filtered.length > 0;
        });

        if (!hasAnyQuestions) {
            return (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {filterType === 'all'
                            ? "Soru bulunamadı."
                            : filterType === 'incomplete'
                                ? "Tüm sorularda tam puan alınmış! 🎉"
                                : "Puan alınamayan veya notlu soru bulunamadı."}
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card className="overflow-hidden border-muted-foreground/20">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted hover:bg-muted">
                                <TableHead className="w-[45%] font-bold text-foreground">Soru</TableHead>
                                <TableHead className="w-[30%] font-bold text-foreground">Cevap</TableHead>
                                <TableHead className="w-[15%] text-center font-bold text-foreground">Puan</TableHead>
                                <TableHead className="w-[10%] text-right pr-4 font-bold text-foreground">Detay</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {audit.sections.map((section, idx) => {
                                // Calculate section score
                                let sectionEarned = 0;
                                let sectionMax = 0;
                                section.answers.forEach(answer => {
                                    if (answer.answer && answer.answer.trim() !== "" && answer.answer !== "muaf") {
                                        sectionEarned += answer.earnedPoints;
                                        sectionMax += answer.maxPoints;
                                    }
                                });

                                const sectionScore = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

                                // Filter questions for this section
                                const filteredQuestions = section.answers.filter(a => {
                                    if (filterType === 'all') return true;
                                    if (filterType === 'incomplete') return isIncompleteAnswer(a);
                                    if (filterType === 'incomplete-notes') return isIncompleteAnswer(a) || hasNotes(a);
                                    return false;
                                });

                                if (filteredQuestions.length === 0) return null;

                                return (
                                    <>
                                        {/* Section Header Row */}
                                        <TableRow key={`section-${idx}`} className="bg-muted/30 hover:bg-muted/40 border-t-2 border-muted">
                                            <TableCell colSpan={4} className="py-3 px-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-base text-foreground pl-1">
                                                        {section.sectionName}
                                                    </span>
                                                    <div className="flex items-center justify-center bg-primary/10 rounded-full px-3 py-1">
                                                        <span className="text-sm font-bold text-primary">{sectionScore} Puan</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* Questions Rows */}
                                        {filteredQuestions.map((answer, qIdx) => (
                                            <TableRow key={`q-${idx}-${qIdx}`} className="hover:bg-muted/10">
                                                <TableCell className="align-top py-3 pl-6">
                                                    <span className="font-medium text-sm text-foreground/90 block mb-1">
                                                        {answer.questionText}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="align-top py-3">
                                                    {renderAnswer(answer)}
                                                </TableCell>
                                                <TableCell className="text-center align-top py-3">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-bold ${isIncompleteAnswer(answer) ? 'text-red-500' : 'text-green-600'}`}>
                                                            {answer.earnedPoints}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            / {answer.maxPoints}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right align-top py-3 pr-4">
                                                    <div className="flex justify-end gap-2">
                                                        {hasNotes(answer) && (
                                                            <div className="relative group cursor-help" title={answer.notes?.filter(n => n.trim()).join("\n")}>
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                            </div>
                                                        )}
                                                        {answer.photos && answer.photos.length > 0 && (
                                                            <div className="relative group cursor-help" title={`${answer.photos.length} Fotoğraf`}>
                                                                <ImageIcon className="h-4 w-4 text-purple-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="mt-8 mb-12">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Denetim Özeti</h2>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="all">
                        Tüm Sorular
                        <Badge variant="secondary" className="ml-2 bg-muted-foreground/10 text-muted-foreground">{getCount('all')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="incomplete">
                        Puan Alınamayanlar
                        <Badge variant="destructive" className="ml-2">{getCount('incomplete')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="incomplete-notes">
                        Puan Alınamayan + Notlular
                        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-200">{getCount('incomplete-notes')}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-6 animate-in fade-in-50 duration-300">
                    {renderSectionGroup('all')}
                </TabsContent>

                <TabsContent value="incomplete" className="space-y-6 animate-in fade-in-50 duration-300">
                    {renderSectionGroup('incomplete')}
                </TabsContent>

                <TabsContent value="incomplete-notes" className="space-y-6 animate-in fade-in-50 duration-300">
                    {renderSectionGroup('incomplete-notes')}
                </TabsContent>
            </Tabs>
        </div>
    );
}
