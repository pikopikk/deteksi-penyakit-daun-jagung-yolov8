// static/js/app.js
// CLDD — Corn Leaf Disease Detector
// Real YOLOv8 inference via Flask /detect endpoint

'use strict';

// ── State ─────────────────────────────────────────────────────
let uploadedFile    = null;   // raw File object
let uploadedDataUrl = null;   // base64 preview for the upload zone
let detectionResult = null;   // full JSON response from /detect
let isDetecting     = false;

// ── Mobile menu ───────────────────────────────────────────────
function toggleMobileMenu() {
    const menu      = document.getElementById('mobileMenu');
    const hamburger = document.getElementById('hamburger');
    if (!menu) return;
    const isHidden = menu.classList.toggle('hidden');
    hamburger.textContent = isHidden ? '☰' : '✕';
}

// ── Upload / preview ──────────────────────────────────────────
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        CLDD.error('Ukuran file maksimal 5 MB!');
        return;
    }

    uploadedFile = file;
    detectionResult = null;

    const reader = new FileReader();
    reader.onload = (ev) => {
        uploadedDataUrl = ev.target.result;
        renderUploadPreview();

        CLDD.success('Gambar siap dideteksi');
    };
    reader.readAsDataURL(file);
}

function renderUploadPreview() {
    const container = document.getElementById('previewContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="relative w-full h-full flex items-center justify-center">
            <img src="${uploadedDataUrl}"
                 class="max-h-64 w-full object-contain rounded-2xl shadow-md fade-in"
                 alt="Preview">
            <button onclick="removeImage(event)"
                    class="absolute top-4 right-3 text-white w-8 h-8 rounded-full flex items-center justify-center shadow leading-none">
                <i class="ri-close-circle-fill text-3xl text-red-500 hover:text-red-600"></i>
            </button>
        </div>
    `;
}

async function removeImage(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const confirmed = await CLDD.confirm({
        title: 'Hapus Gambar',
        message: 'Apakah Anda yakin ingin menghapus gambar yang sudah diunggah?',
        type: 'warning',
        okText: 'Ya, Hapus',
        cancelText: 'Batal',
    });

    if (!confirmed) return; // user batal

    // lanjut hapus
    uploadedFile    = null;
    uploadedDataUrl = null;
    detectionResult = null;

    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';

    const container = document.getElementById('previewContainer');
    if (container) {
        container.innerHTML = `
            <div class="text-6xl mb-4"><i class="ri-image-upload-line"></i></div>
            <p class="font-medium text-slate-700">Tarik & lepas gambar di sini</p>
            <p class="text-slate-400 text-sm mt-1">atau klik untuk memilih file</p>
            <p class="text-xs text-slate-400 mt-6">JPG, PNG • Maksimal 5 MB</p>
        `;
    }

    resetResultArea();

    // optional feedback
    CLDD.info('Gambar berhasil dihapus');
}

function resetResultArea() {
    const area = document.getElementById('resultArea');
    if (!area) return;
    area.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full py-16 text-center">
            <div class="text-8xl mb-8 opacity-20"><i class="ri-bar-chart-grouped-line"></i></div>
            <h3 class="text-2xl font-medium text-slate-400">Hasil deteksi akan muncul di sini</h3>
            <p class="text-slate-400 mt-3 max-w-xs">Setelah gambar diunggah dan tombol deteksi ditekan.</p>
        </div>
    `;
}

// ── Drag & drop ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('uploadZone');
    if (zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('border-emerald-400', 'bg-emerald-50');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('border-emerald-400', 'bg-emerald-50');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('border-emerald-400', 'bg-emerald-50');
            const file = e.dataTransfer.files[0];
            if (file) {
                const fakeEvent = { target: { files: [file] } };
                handleImageUpload(fakeEvent);
            }
        });
    }

    console.log('%c✅ CLDD app.js loaded', 'color:#10b981;font-weight:600');
});

// ── Detection ─────────────────────────────────────────────────
function simulateDetection() {
    // "simulateDetection" name kept so index.html button onclick doesn't break
    if (!uploadedFile) {
        CLDD.alert({
            title:  'Gambar Belum Diunggah',
            message:'Silakan unggah foto daun jagung terlebih dahulu sebelum memulai deteksi.',
            type:   'warning',
            okText: 'Mengerti',
        });
        return;
    }
    if (isDetecting) return;

    isDetecting = true;

    // Button → loading state
    const btn = document.getElementById('detectBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <span class="inline-block w-5 h-5 border-2 border-white border-t-transparent
                         rounded-full animate-spin mr-3"></span>
            Sedang Mendeteksi...
        `;
    }

    // Right panel → animated loading
    const area = document.getElementById('resultArea');
    if (area) {
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="relative">
                    <div class="w-20 h-20 border-8 border-emerald-100 border-t-emerald-600
                                rounded-full animate-spin"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-3xl"><i class="ri-leaf-fill text-emerald-500"></i></div>
                </div>
                <p class="mt-8 text-emerald-700 font-semibold text-lg">
                    YOLOv8 sedang menganalisis gambar…
                </p>
                <p class="text-slate-500 text-sm mt-2">Mohon tunggu sebentar</p>
                <div class="w-64 h-1.5 bg-slate-200 rounded-full mt-8 overflow-hidden">
                    <div id="progressBar"
                         class="h-full bg-emerald-500 rounded-full"
                         style="width:0%;transition:width 2.5s ease-out;"></div>
                </div>
            </div>
        `;
        // Animate progress bar
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const bar = document.getElementById('progressBar');
                if (bar) bar.style.width = '90%';
            });
        });
    }

    // Build FormData and POST to /detect
    const formData = new FormData();
    formData.append('image', uploadedFile);

    fetch('/detect', { method: 'POST', body: formData })
        .then((res) => {
            if (!res.ok) return res.json().then(d => Promise.reject(d));
            return res.json();
        })
        .then((data) => {
            detectionResult = data;
            renderResults(data);

            CLDD.success('Deteksi berhasil!');
        })
        .catch((err) => {
            const msg = err?.message || 'Terjadi kesalahan saat mendeteksi.';
            CLDD.error(msg);
            resetResultArea();
        })
        .finally(() => {
            isDetecting = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ri-search-line"></i> Deteksi';
            }
        });
}

// ── Render result panel ───────────────────────────────────────
function renderResults(data) {
    const area = document.getElementById('resultArea');
    if (!area) return;

    // No detections
    if (!data.dominant) {
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full py-16 text-center fade-in">
                <h3 class="text-2xl font-semibold text-slate-700">Tidak ada penyakit terdeteksi</h3>
                <p class="text-slate-500 mt-3 max-w-xs">
                    Model YOLOv8 tidak menemukan indikasi penyakit. Coba dengan foto yang
                    lebih jelas atau dari jarak lebih dekat.
                </p>
                ${data.result_image ? `
                <div class="mt-8 w-full">
                    <img src="${data.result_image}"
                         class="rounded-2xl shadow-md w-full object-contain max-h-64"
                         alt="Hasil deteksi">
                </div>` : ''}
            </div>
        `;
        return;
    }

    const d    = data.dominant;
    const pct  = Math.round(d.confidence * 100);
    const isHealthy = d.class_name === 'DaunSehat';

    // Badge colour
    const badgeClass = isHealthy
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700';

    // All-detections pills (if multiple boxes)
    let pillsHtml = '';
    if (data.detections.length > 1) {
        pillsHtml = `
            <div class="flex flex-wrap gap-2 mt-4">
                ${data.detections.map(det => `
                    <span class="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                        ${det.label} — ${Math.round(det.confidence * 100)}%
                    </span>
                `).join('')}
            </div>
        `;
    }

    area.innerHTML = `
        <div class="fade-in flex flex-col gap-6">

            <!-- Annotated result image -->
            ${data.result_image ? `
            <div class="rounded-2xl overflow-hidden shadow-md">
                <img src="${data.result_image}"
                     id="resultImg"
                     class="w-full object-contain max-h-64 bg-slate-900"
                     alt="Hasil deteksi YOLOv8">
            </div>` : ''}

            <!-- Header -->
            <div>
                <span class="px-4 py-1.5 ${badgeClass} rounded-3xl text-sm font-medium">
                    ${pct}% Keyakinan
                </span>
                <h3 class="text-2xl font-semibold mt-3">${d.label}</h3>
                ${pillsHtml}
            </div>

            <!-- Description -->
            <p class="text-slate-600 leading-relaxed text-sm">${d.desc}</p>

            <!-- Solutions -->
            ${!isHealthy ? `
            <div>
                <h4 class="font-semibold mb-3 flex items-center gap-2">
                    💡 Rekomendasi Penanganan
                </h4>
                <ul class="space-y-3">
                    ${d.solutions.map(s => `
                        <li class="flex gap-3 text-sm">
                            <span class="text-emerald-500 text-base mt-0.5 shrink-0">•</span>
                            <span class="text-slate-700">${s}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>` : ''}

            <!-- PDF download button -->
            <button onclick="downloadPDF()"
                    class="w-full py-4 border-2 border-emerald-600 hover:bg-emerald-50
                           text-emerald-700 font-semibold rounded-3xl flex items-center
                           justify-center gap-3 text-sm transition-colors">
                <i class="ri-file-pdf-line text-lg"></i> Unduh PDF
            </button>
        </div>
    `;
}

// ── PDF download ──────────────────────────────────────────────
function downloadPDF() {
    if (!detectionResult || !detectionResult.dominant) {
        CLDD.alert({
            title:  'Belum Ada Hasil',
            message:'Lakukan deteksi terlebih dahulu sebelum mengunduh PDF.',
            type:   'info',
            okText: 'OK',
        });
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const d   = detectionResult.dominant;
    const pct = Math.round(d.confidence * 100);
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;

    // ── Header bar ──────────────────────────────────────────
    doc.setFillColor(5, 150, 105);          // emerald-600
    doc.rect(0, 0, pageW, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CLDD — Corn Leaf Disease Detector', margin, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Hasil Deteksi Penyakit Daun Jagung menggunakan YOLOv8', margin, 22);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, margin, 28);

    let y = 44;

    // ── Result image ─────────────────────────────────────────
    const imgSrc = detectionResult.result_image;
    if (imgSrc) {
        try {
            // Calculate image dimensions to fit within page width
            const imgH = 80;   // mm
            doc.addImage(imgSrc, 'JPEG', margin, y, contentW, imgH);
            // Thin border around image
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(margin, y, contentW, imgH);
            y += imgH + 8;
        } catch (err) {
            console.warn('PDF image embed failed:', err);
            y += 4;
        }
    }

    // ── Detection result box ─────────────────────────────────
    const isHealthy = d.class_name === 'DaunSehat';
    const boxColor  = isHealthy ? [209, 250, 229] : [254, 243, 199];   // green / amber tint
    doc.setFillColor(...boxColor);
    doc.setDrawColor(isHealthy ? 16 : 245, isHealthy ? 185 : 158, isHealthy ? 129 : 11);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, 26, 3, 3, 'FD');

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(d.label, margin + 5, y + 10);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Tingkat keyakinan model: ${pct}%`, margin + 5, y + 18);

    // Confidence progress bar
    const barX = margin + 5, barY = y + 21, barW = contentW - 10, barH = 3;
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
    const fillColor = pct >= 80 ? [16, 185, 129] : pct >= 60 ? [245, 158, 11] : [239, 68, 68];
    doc.setFillColor(...fillColor);
    doc.roundedRect(barX, barY, barW * (pct / 100), barH, 1, 1, 'F');

    y += 34;

    // ── Description ──────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Deskripsi Penyakit', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(d.desc, contentW);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 8;

    // ── Solutions ─────────────────────────────────────────────
    if (!isHealthy && d.solutions && d.solutions.length) {
        // Check if we need a new page
        if (y > 240) { doc.addPage(); y = 20; }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Rekomendasi Penanganan', margin, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);

        d.solutions.forEach((sol, i) => {
            if (y > 270) { doc.addPage(); y = 20; }
            const bullet = `${i + 1}.  ${sol}`;
            const lines  = doc.splitTextToSize(bullet, contentW - 5);
            doc.text(lines, margin + 3, y);
            y += lines.length * 5.2 + 3;
        });
    }

    // ── All detections table ──────────────────────────────────
    if (detectionResult.detections.length > 1) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Semua Deteksi Ditemukan', margin, y);
        y += 7;

        // Table header
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Kelas', margin + 2, y + 5);
        doc.text('Keyakinan', margin + contentW - 30, y + 5);
        y += 8;

        detectionResult.detections.forEach((det, i) => {
            if (y > 270) { doc.addPage(); y = 20; }
            if (i % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, y, contentW, 7, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(40, 40, 40);
            doc.text(det.label, margin + 2, y + 5);
            doc.text(`${Math.round(det.confidence * 100)}%`, margin + contentW - 25, y + 5);
            y += 7;
        });
        y += 4;
    }

    // ── Footer ────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(15, 23, 42);      // slate-900
        doc.rect(0, 285, pageW, 12, 'F');
        doc.setTextColor(148, 163, 184);   // slate-400
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(
            '© 2026 CLDD — Corn Leaf Disease Detector | Skripsi YOLOv8',
            margin, 291
        );
        doc.text(`Halaman ${i} / ${pageCount}`, pageW - margin, 291, { align: 'right' });
    }

    // ── Save ──────────────────────────────────────────────────
    const safeName = d.class_name.replace(/\s+/g, '_');
    doc.save(`CLDD_Hasil_${safeName}_${Date.now()}.pdf`);
    CLDD.success('PDF berhasil diunduh');
}

// ── Kept for kontak.html ──────────────────────────────────────
function fakeSocialClick(e,platform) {
    e.preventDefault();
    
    const messages = {
        email:    {
            title:   'Buka Email',
            message: 'Apakah Anda ingin mengirim email ke jagungsehat_id@gmail.com?',
            okText:  'Buka Email',
        },
        location: {
            title:   'Buka Lokasi',
            message: 'Apakah Anda ingin membuka lokasi di Google Maps?',
            okText:  'Buka Maps',
        },
    };

    const opts = messages[platform];
    if (!opts) return;

    CLDD.confirm({ ...opts, type: 'info', cancelText: 'Batal' }).then((confirmed) => {
        if (!confirmed) return;
        if (platform === 'email') {
            window.location.href =
                'mailto:jagungsehat_id@gmail.com?subject=Kontak dari Website&body=Halo, saya ingin bertanya...';
        } else if (platform === 'location') {
            window.open('https://www.google.com/maps?q=Tangerang,Indonesia&z=15', '_blank');
        }
    });
}