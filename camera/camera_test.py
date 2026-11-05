
import cv2

print("================================")
print("          CAMERA TEST")
print("================================")

camera_found = False

for camera_index in range(4):

    print(f"\nTrying camera index {camera_index}...")

    # Use the camera index being tested
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        print(f"Camera {camera_index}: NOT AVAILABLE")
        cap.release()
        continue

    print(f"Camera {camera_index}: OPENED")

    # Try to receive a frame
    ret, frame = cap.read()

    if not ret:
        print(f"Camera {camera_index}: OPENED but NO FRAME received")
        cap.release()
        continue

    print(f"Camera {camera_index}: FRAME RECEIVED")
    print("Press Q to close the camera window.")

    camera_found = True

    while True:

        ret, frame = cap.read()

        if not ret:
            print("Frame read failed.")
            break

        cv2.imshow(f"Camera {camera_index}", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

    print(f"Camera {camera_index} test finished.")
    break

cv2.destroyAllWindows()

if not camera_found:
    print("\nNo working camera found.")
    print("Check camera permissions and close apps using the webcam.")

print("\nCamera test completed.")
