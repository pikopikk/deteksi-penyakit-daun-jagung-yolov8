import os
import uuid
import base64
from io import BytesIO

from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from ultralytics import YOLO
from PIL import Image
import cv2
import numpy as np

# ── App Setup ────────────────────────────────────────────────
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024   # 16 MB

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ── Load YOLOv8 Model (once at startup) ──────────────────────
MODEL_PATH = 'best.pt'
model = YOLO(MODEL_PATH)
print(f'[CLDD] ✅ Model loaded from {MODEL_PATH}')

# ── Class metadata ───────────────────────────────────────────
# Maps class name → (description, list of recommendations)
CLASS_INFO = {
    'gray leaf spot': {
        'label':  'Bercak Daun (Gray Leaf Spot)',
        'desc':   (
            'Bercak Daun atau Gray Leaf Spot disebabkan oleh jamur '
            'Cercospora zeae-maydis. Gejalanya berupa bercak persegi panjang '
            'berwarna abu-abu atau coklat yang sejajar dengan tulang daun, '
            'seringkali dikelilingi tepi kuning. Penyakit ini berkembang pesat '
            'pada kondisi lembap dan hangat.'
        ),
        'solutions': [
            'Gunakan fungisida berbasis Azoxystrobin atau Propiconazole',
            'Rotasi tanaman dengan kedelai atau kacang-kacangan setiap musim',
            'Pilih varietas jagung yang tahan terhadap Bercak Daun',
            'Atur jarak tanam agar sirkulasi udara baik dan kelembapan berkurang',
            'Bajak sisa-sisa tanaman jagung setelah panen untuk mengurangi inokulum',
        ],
    },
    'healthy': {
        'label':  'Daun Sehat',
        'desc':   (
            'Daun jagung terdeteksi dalam kondisi sehat. Tidak ditemukan '
            'indikasi penyakit jamur, bakteri, maupun virus. Warna, tekstur, '
            'dan pola permukaan daun berada dalam rentang normal. '
            'Pertahankan praktik budidaya yang baik untuk menjaga kesehatan tanaman.'
        ),
        'solutions': [
            'Lanjutkan jadwal pemupukan sesuai kebutuhan tanaman',
            'Pertahankan sistem irigasi yang teratur dan terkontrol',
            'Pantau tanaman secara berkala untuk deteksi dini penyakit',
            'Jaga kebersihan lahan dari gulma yang dapat menjadi inang hama',
        ],
    },
    'blight': {
        'label':  'Hawar Daun (Leaf Blight)',
        'desc':   (
            'Hawar Daun atau Northern Leaf Blight (NLB) disebabkan oleh jamur '
            'Exserohilum turcicum. Ditandai dengan lesi panjang berbentuk cerutu '
            'berwarna abu-abu kehijauan hingga coklat, berukuran 2,5–15 cm. '
            'Penyakit ini dapat menyebabkan kehilangan hasil hingga 50% jika '
            'menyerang sebelum fase pembungaan.'
        ),
        'solutions': [
            'Aplikasikan fungisida berbasis Mancozeb atau Chlorothalonil segera',
            'Gunakan varietas jagung hibrida yang membawa gen ketahanan Ht1 atau Ht2',
            'Hindari irigasi dari atas (overhead) untuk mengurangi kelembapan daun',
            'Buang dan musnahkan daun yang terinfeksi untuk mencegah penyebaran spora',
            'Lakukan rotasi tanaman minimal 1–2 musim dengan tanaman non-serealia',
        ],
    },
    'common rust': {
        'label':  'Karat Daun (Common Rust)',
        'desc':   (
            'Karat Daun atau Common Rust disebabkan oleh jamur Puccinia sorghi. '
            'Ditandai dengan pustul kecil berwarna coklat kemerahan hingga oranye '
            'yang tersebar di kedua permukaan daun. Pada infeksi berat, pustul '
            'dapat berubah menjadi hitam (teliospore). Menyebar cepat melalui '
            'angin terutama di suhu 15–25°C dengan kelembapan tinggi.'
        ),
        'solutions': [
            'Semprot fungisida berbasis Trifloxystrobin atau Tebuconazole',
            'Tanam varietas jagung tahan karat yang direkomendasikan BISI atau Pioneer',
            'Lakukan penanaman lebih awal agar tanaman melewati fase rentan sebelum musim hujan',
            'Monitor intensitas serangan setiap minggu dan catat perkembangannya',
            'Kurangi kepadatan tanaman untuk memperbaiki aerasi dan mengurangi kelembapan',
        ],
    },
}

FALLBACK_CLASS_INFO = {
    'label': 'Deteksi Tidak Diketahui',
    'desc': 'Kelas yang terdeteksi tidak dikenali dalam basis data. Harap konsultasikan dengan ahli pertanian.',
    'solutions': ['Konsultasikan dengan penyuluh pertanian setempat.'],
}

# ── Helpers ──────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    return (
        '.' in filename
        and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def draw_boxes(image_bgr: np.ndarray, boxes, class_names: list) -> np.ndarray:
    """
    Draw YOLOv8 bounding boxes on a BGR image.
    Returns the annotated image (BGR).
    """
    # Colour palette per class (BGR)
    palette = [
        (52,  211, 153),   # emerald  – class 0
        (56,  189, 248),   # sky      – class 1
        (251, 146, 60),    # orange   – class 2
        (167, 139, 250),   # violet   – class 3
    ]

    img = image_bgr.copy()
    h, w = img.shape[:2]
    font_scale = max(0.5, min(w, h) / 800)
    thickness  = max(2, int(min(w, h) / 300))

    for box in boxes:
        cls_id   = int(box.cls[0])
        conf     = float(box.conf[0])
        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]

        color    = palette[cls_id % len(palette)]
        cls_name = class_names[cls_id] if cls_id < len(class_names) else str(cls_id)
        label    = f'{cls_name}  {conf:.0%}'

        # Box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)

        # Label background
        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
        )
        ly = max(y1, th + baseline + 6)
        cv2.rectangle(img, (x1, ly - th - baseline - 6), (x1 + tw + 8, ly), color, -1)

        # Label text
        cv2.putText(
            img, label,
            (x1 + 4, ly - baseline - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale, (255, 255, 255), thickness,
            lineType=cv2.LINE_AA
        )

    return img


def image_to_base64(image_bgr: np.ndarray) -> str:
    """Encode a BGR numpy array to a base64 PNG data-URI string."""
    success, buf = cv2.imencode('.jpg', image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise RuntimeError('Failed to encode result image')
    b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
    return f'data:image/jpeg;base64,{b64}'


# ── Routes ───────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/cara-deteksi')
def cara_deteksi():
    return render_template('cara_deteksi.html')


@app.route('/tentang')
def tentang():
    return render_template('tentang.html')


@app.route('/kontak')
def kontak():
    return render_template('kontak.html')


@app.route('/detect', methods=['POST'])
def detect():
    """
    POST /detect
    Body : multipart/form-data  →  field: 'image'

    Response JSON:
    {
        "status": "success",
        "result_image": "<base64 data-URI>",
        "detections": [
            {
                "class_name": "KaratDaun",
                "label":      "Karat Daun (Common Rust)",
                "confidence": 0.92,
                "bbox":       { "x1":10, "y1":20, "x2":150, "y2":200 }
            }, ...
        ],
        "dominant": {           ← highest-confidence detection
            "class_name": "...",
            "label":      "...",
            "confidence": 0.92,
            "desc":       "...",
            "solutions":  [...]
        },
        "total": 2
    }
    """
    # 1. Validate file
    if 'image' not in request.files:
        return jsonify({'status': 'error', 'message': 'Tidak ada file yang diunggah.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'File kosong.'}), 400
    if not allowed_file(file.filename):
        return jsonify({'status': 'error', 'message': 'Format file tidak didukung. Gunakan JPG atau PNG.'}), 400

    # 2. Save to disk
    ext      = file.filename.rsplit('.', 1)[1].lower()
    filename = f'{uuid.uuid4().hex}.{ext}'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        # 3. Run YOLOv8 inference
        results      = model.predict(source=filepath, conf=0.25, verbose=False)[0]
        class_names  = results.names   # dict: {0: 'BercakDaun', ...}

        # 4. Draw boxes on image
        img_bgr      = cv2.imread(filepath)
        annotated    = draw_boxes(img_bgr, results.boxes or [], class_names)
        result_b64   = image_to_base64(annotated)

        # 5. Build detection list
        detections = []
        for box in (results.boxes or []):
            cls_id   = int(box.cls[0])
            cls_name = class_names.get(cls_id, f'class_{cls_id}')
            conf_val = round(float(box.conf[0]), 4)
            x1, y1, x2, y2 = [round(v, 1) for v in box.xyxy[0].tolist()]
            info = CLASS_INFO.get(cls_name, FALLBACK_CLASS_INFO)
            detections.append({
                'class_name': cls_name,
                'label':      info['label'],
                'confidence': conf_val,
                'bbox':       {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
            })

        # Sort by confidence descending
        detections.sort(key=lambda d: d['confidence'], reverse=True)

        # 6. Dominant (highest-confidence) detection for the result panel
        if detections:
            dom_name = detections[0]['class_name']
            dom_info = CLASS_INFO.get(dom_name, FALLBACK_CLASS_INFO)
            dominant = {
                'class_name': dom_name,
                'label':      dom_info['label'],
                'confidence': detections[0]['confidence'],
                'desc':       dom_info['desc'],
                'solutions':  dom_info['solutions'],
            }
        else:
            dominant = None

        return jsonify({
            'status':       'success',
            'result_image': result_b64,
            'detections':   detections,
            'dominant':     dominant,
            'total':        len(detections),
        })

    except Exception as e:
        print(f'[CLDD] ❌ Inference error: {e}')
        return jsonify({'status': 'error', 'message': f'Terjadi kesalahan saat deteksi: {str(e)}'}), 500

    finally:
        # Clean up uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)


# ── Entry point ──────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True)