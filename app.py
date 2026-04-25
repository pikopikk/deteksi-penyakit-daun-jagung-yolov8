from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
import os

app = Flask(__name__)

# Load model
model = YOLO("best.pt")

UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No file uploaded"})

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"})

    # Save uploaded image
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    # YOLO prediction
    results = model(filepath)

    detections = []

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            name = model.names[cls_id]

            detections.append({
                "class": name,
                "confidence": round(conf, 3)
            })

    # Save result image (with bounding box)
    result_img_path = os.path.join(UPLOAD_FOLDER, "result_" + file.filename)
    results[0].save(filename=result_img_path)

    # 🔍 DEBUG
    print("Saved to:", result_img_path)
    print("Exists:", os.path.exists(result_img_path))

    return jsonify({
        "image": f"/static/uploads/result_{file.filename}",
        "detections": detections
    })


if __name__ == '__main__':
    app.run(debug=True)