import cv2
from ultralytics import YOLO

# ---------------------------------------------------------
# LOAD TRAINED DRISHTI MODEL
# ---------------------------------------------------------

model = YOLO("best.pt")

print("Drishti YOLOv8m model loaded.")
print("Starting camera...")
print("Press Q to quit.")

# ---------------------------------------------------------
# CAMERA
# ---------------------------------------------------------

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open webcam.")
    exit()

# ---------------------------------------------------------
# LIVE DETECTION
# ---------------------------------------------------------

while True:

    ret, frame = cap.read()

    if not ret:
        print("WARNING: Failed to read camera frame.")
        continue

    # YOLO prediction
    results = model.predict(
        source=frame,
        imgsz=640,
        conf=0.35,
        device="cpu",
        verbose=False
    )

    # Draw detections
    annotated_frame = results[0].plot()

    # Display
    cv2.imshow(
        "Drishti - Trained YOLOv8m",
        annotated_frame
    )

    # Press Q to exit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# ---------------------------------------------------------
# CLEANUP
# ---------------------------------------------------------

cap.release()
cv2.destroyAllWindows()

print("Camera stopped.")