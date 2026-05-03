// static/js/app.js

let uploadedImage = null;
let detectionResult = null;
let isDetecting = false;

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const hamburger = document.getElementById('hamburger');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        hamburger.textContent = '✕';
    } else {
        menu.classList.add('hidden');
        hamburger.textContent = '☰';
    }
}

// Handle Upload Gambar + Preview
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('❌ Ukuran file maksimal 5MB!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
        uploadedImage = ev.target.result;
        showImagePreview();
    };
    reader.readAsDataURL(file);
}

// Tampilkan preview gambar dengan animasi
function showImagePreview() {
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;

    previewContainer.innerHTML = `
        <div class="relative">
            <img src="${uploadedImage}" 
                 id="previewImg"
                 class="max-h-64 w-full object-contain rounded-2xl shadow-md mx-auto fade-in">
            <button onclick="removeImage()" 
                    class="absolute top-3 right-3 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xl shadow hover:bg-red-600">
                ×
            </button>
        </div>
        <p class="text-emerald-600 text-sm font-medium mt-4">Gambar siap dideteksi</p>
    `;
}

// Hapus gambar preview
function removeImage() {
    uploadedImage = null;
    detectionResult = null;
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = `
            <div class="text-6xl mb-6">🌾</div>
            <p class="font-medium text-slate-700">Tarik & lepas gambar di sini</p>
            <p class="text-slate-400 text-sm mt-1">atau klik untuk memilih file</p>
            <p class="text-xs text-slate-400 mt-8">JPG, PNG • Maksimal 5MB</p>
        `;
    }
    // Reset hasil juga
    resetResultArea();
}

// Reset area hasil
function resetResultArea() {
    const resultArea = document.getElementById('resultArea');
    if (resultArea) {
        resultArea.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
                <div class="text-8xl mb-8 opacity-20">📊</div>
                <h3 class="text-2xl font-medium text-slate-400">Hasil deteksi akan muncul di sini</h3>
                <p class="text-slate-400 mt-3 max-w-xs">Setelah gambar diunggah dan tombol deteksi ditekan.</p>
            </div>
        `;
    }
}

// Simulasi Deteksi dengan Animasi Loading yang Lebih Baik
function simulateDetection() {
    if (!uploadedImage) {
        alert('❌ Silakan unggah gambar daun padi terlebih dahulu!');
        return;
    }
    if (isDetecting) return;

    isDetecting = true;
    const detectButton = document.querySelector('button[onclick="simulateDetection()"]');
    if (detectButton) {
        detectButton.innerHTML = `
            <span class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></span>
            Sedang Mendeteksi...
        `;
        detectButton.disabled = true;
    }

    const resultArea = document.getElementById('resultArea');
    if (resultArea) {
        resultArea.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="relative">
                    <div class="w-20 h-20 border-8 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-4xl">🌾</div>
                </div>
                <p class="mt-8 text-emerald-700 font-semibold text-lg">YOLOv8 sedang menganalisis gambar...</p>
                <p class="text-slate-500 text-sm mt-2">Mohon tunggu sebentar • Estimasi 2 detik</p>
                
                <!-- Progress bar simulasi -->
                <div class="w-64 h-1.5 bg-slate-200 rounded-full mt-8 overflow-hidden">
                    <div id="progressBar" class="h-full bg-emerald-500 w-0 transition-all duration-2000"></div>
                </div>
            </div>
        `;

        // Animasi progress bar
        setTimeout(() => {
            const progress = document.getElementById('progressBar');
            if (progress) progress.style.width = '100%';
        }, 100);
    }

    // Simulasi proses AI
    setTimeout(() => {
        const diseases = [
            {
                name: "Leaf Blast",
                confidence: 94,
                desc: "Penyakit Blast (Pyricularia oryzae) terdeteksi pada daun. Ciri khas: bercak berbentuk belah ketupat berwarna putih kecoklatan.",
                solution: [
                    "Semprot fungisida berbasis Tricyclazole atau Isoprothiolane",
                    "Jaga kelembaban sawah tetap rendah",
                    "Gunakan varietas padi tahan blast seperti Inpari 32",
                    "Hindari pemupukan nitrogen berlebih"
                ]
            },
            {
                name: "Brown Spot",
                confidence: 87,
                desc: "Brown Spot (Bipolaris oryzae) terdeteksi. Bercak kecil berbentuk bulat kecoklatan dengan tepi kuning.",
                solution: [
                    "Aplikasikan fungisida berbasis Mancozeb",
                    "Perbaiki drainase sawah",
                    "Rotasi tanaman dengan palawija",
                    "Gunakan benih sehat bersertifikat"
                ]
            }
        ];
        
        detectionResult = diseases[Math.floor(Math.random() * diseases.length)];
        isDetecting = false;
        
        // Kembalikan tombol ke normal
        if (detectButton) {
            detectButton.innerHTML = `🔍 Mulai Deteksi dengan YOLOv8`;
            detectButton.disabled = false;
        }
        
        renderBeranda();
    }, 2200);
}

function downloadPDF() {
    if (!detectionResult) {
        alert('Belum ada hasil deteksi untuk diunduh.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Laporan Deteksi Penyakit Daun Padi", 20, 25);
    doc.setFontSize(12);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 20, 40);
    doc.text(`Model: YOLOv8`, 20, 48);
    
    doc.setFontSize(16);
    doc.text(`Penyakit Terdeteksi: ${detectionResult.name}`, 20, 65);
    doc.text(`Tingkat Keyakinan: ${detectionResult.confidence}%`, 20, 75);

    let y = 90;
    const descLines = doc.splitTextToSize(detectionResult.desc, 160);
    doc.text(descLines, 20, y);
    y += descLines.length * 7 + 15;

    doc.setFontSize(14);
    doc.text("Rekomendasi Solusi:", 20, y);
    y += 10;

    doc.setFontSize(12);
    detectionResult.solution.forEach((sol, i) => {
        const lines = doc.splitTextToSize(`${i+1}. ${sol}`, 160);
        doc.text(lines, 20, y);
        y += lines.length * 7 + 5;
    });

    doc.setFontSize(10);
    doc.text("© PadiGuard - Deteksi Penyakit Daun Padi dengan YOLOv8", 20, 280);
    
    doc.save(`PadiGuard_Hasil_${detectionResult.name.replace(/\s+/g, '_')}.pdf`);
}

function fakeSocialClick(platform) {
    const msg = {
        Instagram: "📸 Membuka Instagram PadiGuard (Demo)",
        WhatsApp: "💬 Membuka WhatsApp +62 812-3456-7890 (Demo)"
    };
    alert(msg[platform] || "Membuka " + platform + " (Demo)");
}

// Render hasil deteksi
function renderBeranda() {
    const resultArea = document.getElementById('resultArea');
    if (!resultArea || !detectionResult) return;

    resultArea.innerHTML = `
        <div class="fade-in">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <span class="px-5 py-1.5 bg-emerald-100 text-emerald-700 rounded-3xl text-sm font-medium">${detectionResult.confidence}% Keyakinan</span>
                    <h3 class="text-3xl font-semibold mt-4">${detectionResult.name}</h3>
                </div>
                <div class="text-7xl">🌾</div>
            </div>
            
            <p class="text-slate-600 leading-relaxed">${detectionResult.desc}</p>
            
            <div class="mt-10">
                <h4 class="font-semibold mb-5 flex items-center gap-x-2 text-lg">
                    💡 Solusi yang Direkomendasikan
                </h4>
                <ul class="space-y-4">
                    ${detectionResult.solution.map(s => `
                        <li class="flex gap-x-3">
                            <span class="text-emerald-500 text-xl leading-none mt-0.5">•</span>
                            <span class="text-slate-700">${s}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <button onclick="downloadPDF()" 
                    class="mt-12 w-full py-5 border-2 border-emerald-600 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-3xl flex items-center justify-center gap-x-3 text-lg">
                📄 Unduh Laporan PDF
            </button>
        </div>
    `;
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c✅ PadiGuard JS dengan preview & loading animation berhasil dimuat!', 'color:#10b981; font-weight:600');
});

function detectReal() {
    const fileInput = document.querySelector('input[type="file"]');

    if (!fileInput.files[0]) {
        alert("Upload gambar dulu!");
        return;
    }

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    fetch("/predict", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);

        const resultArea = document.getElementById("resultArea");

        let detectionsHTML = "";

        if (data.detections.length === 0) {
            detectionsHTML = `<p class="text-red-500">Tidak ada objek terdeteksi</p>`;
        } else {
            data.detections.forEach(d => {
                detectionsHTML += `
                    <div class="flex justify-between border-b py-2">
                        <span class="font-medium text-slate-700">${d.class}</span>
                        <span class="text-emerald-600">${(d.confidence * 100).toFixed(1)}%</span>
                    </div>
                `;
            });
        }

        resultArea.innerHTML = `
            <div class="fade-in">
                
                <!-- Gambar hasil -->
                <img src="${data.image}" 
                     class="rounded-2xl shadow-md w-full mb-6">

                <!-- Judul -->
                <h3 class="text-xl font-semibold mb-4 text-slate-800">
                    Hasil Deteksi
                </h3>

                <!-- List hasil -->
                <div class="bg-slate-50 rounded-xl p-4 space-y-2">
                    ${detectionsHTML}
                </div>

            </div>
        `;
    })
    .catch(err => {
        console.error(err);
        alert("Terjadi error saat deteksi");
    });
}                                               