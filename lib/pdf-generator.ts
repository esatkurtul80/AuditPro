import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Audit, UserProfile } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function generateAuditPDF(audit: Audit) {
    const doc = new jsPDF();

    // Başlık
    doc.setFontSize(20);
    doc.text("Denetim Raporu", 105, 20, { align: "center" });

    // Denetim bilgileri
    doc.setFontSize(12);
    doc.text(`Denetim Türü: ${audit.auditTypeName}`, 20, 40);
    doc.text(`Mağaza: ${audit.storeName}`, 20, 50);
    // Denetmen ismini veritabanından güncel olarak çekmeye çalış
    let auditorDisplayName = audit.auditorName;
    if (audit.auditorId) {
        try {
            const userDoc = await getDoc(doc(db, "users", audit.auditorId));
            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.firstName && userData.lastName) {
                    auditorDisplayName = `${userData.firstName} ${userData.lastName}`;
                }
            }
        } catch (e) {
            console.error("Error fetching auditor name:", e);
        }
    }

    doc.text(`Denetmen: ${auditorDisplayName}`, 20, 60);
    doc.text(
        `Tarih: ${audit.completedAt?.toDate().toLocaleDateString("tr-TR")}`,
        20,
        70
    );
    doc.text(`Toplam Puan: ${audit.totalScore} / ${audit.maxScore}`, 20, 80);
    doc.text(
        `Başarı Oranı: %${((audit.totalScore / audit.maxScore) * 100).toFixed(1)}`,
        20,
        90
    );

    let yPosition = 100;

    // Her bölüm için
    audit.sections.forEach((section, sectionIndex) => {
        // Yeni sayfa gerekirse
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }

        // Bölüm başlığı
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(
            `${sectionIndex + 1}. ${section.sectionName}`,
            20,
            yPosition
        );
        yPosition += 10;

        // Soru tablosu
        const tableData = section.answers.map((answer, index) => [
            `${index + 1}`,
            answer.questionText,
            answer.answer === "evet"
                ? "Evet"
                : answer.answer === "hayir"
                    ? "Hayır"
                    : "Muaf",
            `${answer.earnedPoints}/${answer.maxPoints}`,
            answer.notes || "-",
        ]);

        autoTable(doc, {
            startY: yPosition,
            head: [["#", "Soru", "Cevap", "Puan", "Not"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [139, 92, 246] },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 80 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 50 },
            },
            styles: { fontSize: 9 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
    });

    // Sonuç özeti
    if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sonuç Özeti", 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    const successRate = (audit.totalScore / audit.maxScore) * 100;
    let resultText = "";
    let resultColor: [number, number, number] = [0, 0, 0];

    if (successRate >= 90) {
        resultText = "Mükemmel";
        resultColor = [34, 197, 94];
    } else if (successRate >= 80) {
        resultText = "İyi";
        resultColor = [59, 130, 246];
    } else if (successRate >= 70) {
        resultText = "Orta";
        resultColor = [251, 191, 36];
    } else {
        resultText = "Geliştirilmeli";
        resultColor = [239, 68, 68];
    }

    doc.setTextColor(...resultColor);
    doc.text(`Genel Değerlendirme: ${resultText}`, 20, yPosition);
    doc.setTextColor(0, 0, 0);

    return doc;
}
