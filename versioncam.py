
import cv2
import time

print("OpenCV version:", cv2.__version__, flush=True)

for index in range(5):
    print(f"\nChecking camera index {index}...", flush=True)

    camera = cv2.VideoCapture(index, cv2.CAP_DSHOW)

    if not camera.isOpened():
        print("Camera did not open.", flush=True)
        camera.release()
        continue

    print("Camera opened. Reading frame...", flush=True)

    success, frame = camera.read()

    if success:
        print("SUCCESS! Camera index:", index, flush=True)
        print("Frame size:", frame.shape, flush=True)

        cv2.imshow("Camera Test", frame)
        cv2.waitKey(1500)
        cv2.destroyAllWindows()

        camera.release()
        break
    else:
        print("Opened, but failed to read a frame.", flush=True)

    camera.release()

else:
    print("\nNo working camera found in indices 0-4.", flush=True)

cv2.destroyAllWindows()
print("Test finished.", flush=True)
