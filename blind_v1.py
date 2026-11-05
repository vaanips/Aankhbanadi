import speech_recognition as sr
import sounddevice as sd
import re

import cv2

import math

import time

import queue

import threading

import torch

from ultralytics import YOLO

import pyttsx3











# ============================================================*

# 1. CONFIGURATION*

# ============================================================*

MODEL_PATH = "yolo26x.pt"



CAMERA_INDEX = 0



DEVICE = 0







IMAGE_SIZE = 640



CONFIDENCE_THRESHOLD = 0.45







# Replace with the measured vertical field of view of your camera.*

VERTICAL_FOV_DEGREES = 45.0







# Voice alert settings*

DISTANCE_WARNING_METERS = 2.0

STEP_LENGTH_METERS = 0.65



ANNOUNCEMENT_INTERVAL = 3.0







# True: announce a nearby object again every interval.*

REPEAT_CLOSE_WARNINGS = True











# ============================================================*

# 2. APPROXIMATE OBJECT HEIGHTS IN METRES*

# ============================================================*

# These are approximate assumed dimensions, NOT measurements*

# of the particular object in your room.*

OBJECT_HEIGHTS = {



    "person": 1.70,



    "bicycle": 1.10,



    "car": 1.50,



    "motorcycle": 1.20,



    "bus": 3.00,



    "truck": 3.00,



    "train": 3.50,







    "bird": 0.25,



    "cat": 0.30,



    "dog": 0.50,



    "horse": 1.50,



    "sheep": 0.80,



    "cow": 1.40,



    "elephant": 2.50,



    "bear": 1.20,



    "zebra": 1.40,



    "giraffe": 4.00,







    "chair": 0.90,



    "couch": 0.90,



    "bed": 0.60,



    "dining table": 0.75,



    "toilet": 0.70,



    "bench": 0.80,







    "tv": 0.60,



    "laptop": 0.25,



    "cell phone": 0.15,



    "remote": 0.18,



    "mouse": 0.04,



    "keyboard": 0.04,







    "bottle": 0.25,



    "wine glass": 0.20,



    "cup": 0.12,



    "fork": 0.18,



    "knife": 0.23,



    "spoon": 0.18,



    "bowl": 0.12,







    "potted plant": 0.70,



    "backpack": 0.50,



    "suitcase": 0.60,



    "handbag": 0.30,



    "umbrella": 0.90,







    "traffic light": 0.80,



    "stop sign": 0.75,



    "fire hydrant": 0.75,



    "parking meter": 1.50,



}











# ============================================================*

# 3. OBJECT GROUPS*

# ============================================================*

VEHICLES = {



    "bicycle", "car", "motorcycle", "bus", "train", "truck"



}







ANIMALS = {



    "bird", "cat", "dog", "horse", "sheep", "cow",



    "elephant", "bear", "zebra", "giraffe"



}







FURNITURE = {



    "chair", "couch", "bed", "dining table",



    "toilet", "bench"



}







ROAD_SIGNALS = {



    "traffic light", "stop sign"



}







ELECTRONICS = {



    "tv", "laptop", "mouse", "remote",



    "keyboard", "cell phone"



}







KITCHEN_ITEMS = {



    "bottle", "wine glass", "cup", "fork",



    "knife", "spoon", "bowl", "microwave",



    "oven", "toaster", "sink", "refrigerator"



}







SPORTS_ITEMS = {



    "sports ball", "baseball bat", "baseball glove",



    "skateboard", "surfboard", "tennis racket",



    "frisbee", "skis", "snowboard"



}







OBSTACLES = {



    "fire hydrant", "parking meter", "potted plant",



    "suitcase", "backpack", "handbag", "umbrella"



}











def get_group(name):



    if name == "person":



        return "Person"



    if name in VEHICLES:



        return "Vehicle"



    if name in ANIMALS:



        return "Animal"



    if name in ROAD_SIGNALS:



        return "Road signal"



    if name in FURNITURE:



        return "Furniture"



    if name in ELECTRONICS:



        return "Electronics"



    if name in KITCHEN_ITEMS:



        return "Kitchen item"



    if name in SPORTS_ITEMS:



        return "Sports equipment"



    if name in OBSTACLES:



        return "Obstacle"







    return "Object"











def get_group_phrase(group):



    phrases = {



        "Person": "person",



        "Vehicle": "vehicle",



        "Animal": "animal",



        "Road signal": "road signal",



        "Furniture": "piece of furniture",



        "Electronics": "electronic device",



        "Kitchen item": "kitchen item",



        "Sports equipment": "sports equipment",



        "Obstacle": "obstacle",



        "Object": "object",



    }







    return phrases.get(group, "object")











# ============================================================*

# 4. POSITION AND DISTANCE ESTIMATION*

# ============================================================*

def get_direction(center_x, frame_width):



    position = center_x / frame_width







    if position < 0.35:



        return "left"



    elif position > 0.65:



        return "right"







    return "ahead"











def estimate_distance(name, box_height, frame_height):



    """



    Rough monocular distance estimate.







    D = focal_length_pixels * assumed_real_height / box_height







    Accuracy depends on camera calibration, actual object size,



    visible bounding-box height, and object orientation.



    """







    real_height = OBJECT_HEIGHTS.get(name)







    if real_height is None or box_height <= 0:



        return None







    focal_length_pixels = frame_height / (



        2.0 * math.tan(



            math.radians(VERTICAL_FOV_DEGREES) / 2.0



        )



    )







    distance = (



        focal_length_pixels * real_height / box_height



    )







    return max(0.1, distance)





def distance_to_steps(distance_m):

    if distance_m is None or distance_m <= 0:

        return None



    steps = round(distance_m / STEP_LENGTH_METERS)

    return max(1, steps)











def parse_step_query(query):
    """Extract optional step range, direction, and requested object class."""
    text = re.sub(r"[^a-z0-9 ]", " ", query.lower())
    text = re.sub(r"\s+", " ", text).strip()
    number_words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
        "fifteen": 15, "sixteen": 16, "seventeen": 17,
        "eighteen": 18, "nineteen": 19, "twenty": 20
    }
    match = re.search(r"\b(\d+)\s*steps?\b", text)
    max_steps = int(match.group(1)) if match else None
    if max_steps is None:
        for word, value in number_words.items():
            if re.search(rf"\b{word}\s+steps?\b", text):
                max_steps = value
                break

    direction = None
    if re.search(r"\b(left|on my left|to my left)\b", text):
        direction = "left"
    elif re.search(r"\b(right|on my right|to my right)\b", text):
        direction = "right"
    elif re.search(r"\b(ahead|in front|front|in front of me|straight ahead)\b", text):
        direction = "ahead"

    # Match known COCO object names and common plural forms.
    known_names = set(OBJECT_HEIGHTS) | set(VEHICLES) | set(ANIMALS) | set(FURNITURE) | set(ELECTRONICS) | set(KITCHEN_ITEMS) | set(SPORTS_ITEMS) | set(OBSTACLES) | {"person"}
    requested_name = None
    for name in sorted(known_names, key=len, reverse=True):
        if re.search(rf"\b{re.escape(name)}s?\b", text):
            requested_name = name
            break
    if re.search(r"\bpeople\b", text):
        requested_name = "person"
    return max_steps, direction, requested_name, text


def listen_for_voice_query(detections):
    """Listen to one push-to-talk command; keep automatic TTS quiet while recording."""
    recognizer = sr.Recognizer()
    voice_query_active.set()
    # Clear queued automatic messages before recording.
    while True:
        try:
            speech_queue.get_nowait()
        except queue.Empty:
            break
    try:
        sample_rate = 16000
        print("Listening...", flush=True)
        recording = sd.rec(int(7 * sample_rate), samplerate=sample_rate,
                           channels=1, dtype="int16")
        sd.wait()
        audio = sr.AudioData(recording.tobytes(), sample_rate, 2)
        query = recognizer.recognize_google(audio).strip()
        print("Recognized query:", query, flush=True)
        text = re.sub(r"[^a-z ]", " ", query.lower())
        words = text.split()

        if words and all(w in {"start", "announcements", "resume", "please"} for w in words) and "start" in words or words == ["resume", "announcements"]:
            auto_announcements_enabled.set()
            response = "Automatic announcements started."
        elif words and all(w in {"stop", "announcements", "pause", "please"} for w in words) and "stop" in words or words == ["pause", "announcements"]:
            auto_announcements_enabled.clear()
            response = "Automatic announcements stopped."
        else:
            max_steps, direction, requested_name, clean_text = parse_step_query(query)
            is_yes_no = bool(re.match(r"^(is there|are there|do you see|can you see|is a|are any)\b", clean_text))
            matches = []
            for item in detections:
                name = item.get("name", "").lower()
                if requested_name and name != requested_name:
                    continue
                if direction and item.get("direction") != direction:
                    continue
                distance = item.get("distance")
                steps = distance_to_steps(distance) if distance is not None else None
                if max_steps is not None and (steps is None or steps > max_steps):
                    continue
                matches.append((steps, item))

            if is_yes_no:
                subject = requested_name or "object"
                if not matches:
                    response = f"No, I don't detect a {subject}"
                    response += f" {direction}." if direction else " nearby."
                else:
                    counts = {}
                    for _, item in matches:
                        counts[item["direction"]] = counts.get(item["direction"], 0) + 1
                    count = len(matches)
                    noun = "person" if subject == "person" and count == 1 else ("people" if subject == "person" else subject + ("s" if count != 1 else ""))
                    where = direction or matches[0][1]["direction"]
                    response = f"Yes, there {'is' if count == 1 else 'are'} {count if count > 1 else 'a'} {noun} {where}."
            elif not matches:
                scope = f" {direction}" if direction else " around you"
                response = f"I don't detect any matching objects{scope}."
                if max_steps is not None:
                    response = f"I don't detect any objects within {max_steps} steps{scope}."
            else:
                grouped = {}
                for steps, item in matches:
                    key = (item.get("name", "object"), item.get("direction"), steps)
                    grouped[key] = grouped.get(key, 0) + 1
                parts = []
                for (name, where, steps), count in sorted(grouped.items(), key=lambda x: (x[0][2] or 999, x[0][0])):
                    noun = ("person" if name == "person" and count == 1 else "people" if name == "person" else name if count == 1 else name + "s")
                    distance_phrase = f" approximately {steps} steps" if steps is not None else ""
                    parts.append(f"{count} {noun}" + (f"{distance_phrase} {where}"))
                response = "Yes. I detect " + "; and ".join(parts[:6]) + "."
            # Queue the answer while voice_query_active is set; worker waits until it clears.
        announce(response, priority=True)
    except sr.UnknownValueError:
        announce("Sorry, I could not understand. Please try again.", priority=True)
    except sr.RequestError as error:
        print("Speech recognition service error:", error, flush=True)
        announce("Speech recognition is unavailable. Please check your internet connection.", priority=True)
    except Exception as error:
        print("Microphone recording error:", error, flush=True)
        announce("Microphone unavailable. Please check microphone access.", priority=True)
    finally:
        voice_query_active.clear()
# 5. TEXT-TO-SPEECH*

# ============================================================*

speech_queue = queue.Queue(maxsize=2)



stop_speech = threading.Event()
auto_announcements_enabled = threading.Event()
auto_announcements_enabled.set()  # Preserve current startup behaviour
voice_query_active = threading.Event()











# def speech_worker():*

#     engine = None*

#     try:*

#         engine = pyttsx3.init()*

#         engine.setProperty("rate", 175)*

#         engine.setProperty("volume", 1.0)*

#         print("TTS initialized successfully.", flush=True)*

#         while not stop_speech.is_set():*

#             try:*

#                 message = speech_queue.get(timeout=0.2)*

#             except queue.Empty:*

#                 continue*

#             if message is None:*

#                 break*

#             print("Speaking:", message, flush=True)*

#             try:*

#                 engine.say(message)*

#                 engine.runAndWait()*

#             except Exception as error:*

#                 print("TTS playback error:", error, flush=True)*

#     except Exception as error:*

#         print("TTS initialization failed:", error, flush=True)*

#     finally:*

#         if engine is not None:*

#             engine.stop()*

def speech_worker():



    print("Speech worker ready.", flush=True)







    while not stop_speech.is_set():



        try:



            message = speech_queue.get(timeout=0.2)



        except queue.Empty:



            continue







        if message is None:



            break



        if voice_query_active.is_set():
            continue



        engine = None







        try:



            print("Speaking:", message, flush=True)







            # Create a fresh SAPI5 engine for every announcement*

            engine = pyttsx3.init("sapi5")



            engine.setProperty("rate", 160)



            engine.setProperty("volume", 1.0)







            engine.say(message)



            engine.runAndWait()







            print("Speech completed.", flush=True)







        except Exception as error:



            print("Speech playback error:", error, flush=True)







        finally:



            if engine is not None:



                try:



                    engine.stop()



                except Exception as error:



                    print("TTS cleanup error:", error, flush=True)



















def announce(message, priority=False):



    """



    Queue voice messages.







    Priority warnings replace an older pending message if needed.



    """







    try:



        speech_queue.put_nowait(message)



        print("Queued speech:", message, flush=True)



        return







    except queue.Full:



        pass







    if priority:



        try:



            speech_queue.get_nowait()



        except queue.Empty:



            pass







        try:



            speech_queue.put_nowait(message)



            print("Queued priority warning:", message, flush=True)



        except queue.Full:



            pass











# ============================================================*

# 6. MAIN APPLICATION*

# ============================================================*

def main():



    print("Checking CUDA...", flush=True)







    if not torch.cuda.is_available():



        print(



            "CUDA unavailable. Activate the environment with "



            "CUDA-enabled PyTorch before running this program.",



            flush=True



        )



        return







    print("GPU:", torch.cuda.get_device_name(DEVICE), flush=True)







    # Load model and move it to the NVIDIA GPU.*

    print("Loading YOLO26l...", flush=True)







    try:



        model = YOLO(MODEL_PATH)



        model.to(f"cuda:{DEVICE}")



        print("Model loaded successfully.", flush=True)







    except Exception as error:



        print("Model loading failed:", error, flush=True)



        return







    # Start the speech thread before the camera.*

    stop_speech.clear()







    tts_thread = threading.Thread(



        target=speech_worker,



        daemon=True



    )



    tts_thread.start()







    time.sleep(0.5)







    announce("Drishti started.")







    # Open webcam.*

    print(f"Opening camera index {CAMERA_INDEX}...", flush=True)







    camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)







    if not camera.isOpened():



        camera.release()



        print("Camera could not be opened.", flush=True)



        stop_speech.set()



        return







    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)



    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)



    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)







    print("Camera opened. Reading frame...", flush=True)







    success, frame = camera.read()







    if not success or frame is None:



        camera.release()



        print("Camera did not return a frame.", flush=True)



        stop_speech.set()



        return







    print("Camera ready. Detection started.", flush=True)







    last_announcement_time = 0.0



    last_message = ""



    previous_frame_time = time.time()



    fps = 0.0







    try:



        while True:



            success, frame = camera.read()







            if not success or frame is None:



                print("Failed to read camera frame.", flush=True)



                break







            frame_height, frame_width = frame.shape[:2]







            # Run YOLO inference on CUDA.*

            try:



                with torch.inference_mode():



                    results = model.predict(



                        source=frame,



                        imgsz=IMAGE_SIZE,



                        conf=CONFIDENCE_THRESHOLD,



                        device=DEVICE,



                        verbose=False



                    )







            except torch.cuda.OutOfMemoryError:



                print(



                    "GPU memory exhausted. Stop and try "



                    "IMAGE_SIZE = 512.",



                    flush=True



                )



                break







            detections = []







            for result in results:



                for box in result.boxes:



                    class_id = int(box.cls[0].item())



                    confidence = float(box.conf[0].item())



                    name = model.names[class_id]







                    x1, y1, x2, y2 = map(



                        int, box.xyxy[0].tolist()



                    )







                    box_height = y2 - y1



                    center_x = (x1 + x2) / 2.0







                    group = get_group(name)



                    direction = get_direction(



                        center_x, frame_width



                    )







                    distance = estimate_distance(



                        name, box_height, frame_height



                    )







                    detections.append({



                        "name": name,



                        "group": group,



                        "confidence": confidence,



                        "direction": direction,



                        "distance": distance,



                        "box": (x1, y1, x2, y2)



                    })







            # Draw detections.*

            for item in detections:



                x1, y1, x2, y2 = item["box"]



                distance = item["distance"]







                if distance is not None:



                    label = (



                        f"{item['group']} "



                        f"~{distance:.1f}m "



                        f"{item['confidence']:.2f}"



                    )



                else:



                    label = (



                        f"{item['group']} "



                        f"{item['confidence']:.2f}"



                    )







                cv2.rectangle(



                    frame,



                    (x1, y1),



                    (x2, y2),



                    (0, 255, 0),



                    2



                )







                cv2.putText(



                    frame,



                    label,



                    (x1, max(25, y1 - 10)),



                    cv2.FONT_HERSHEY_SIMPLEX,



                    0.55,



                    (0, 255, 0),



                    2



                )







            # ================================================*

            # CLOSE-OBJECT VOICE ALERTS*

            # ================================================*

            candidates = [item for item in detections if item["distance"] is not None]
            candidates.sort(key=lambda item: item["distance"])
            current_time = time.time()

            # Do not generate automatic speech while the user is recording a question.
            if candidates and auto_announcements_enabled.is_set() and not voice_query_active.is_set():
                nearest = candidates[0]
                nearest_distance = nearest["distance"]
                nearest_steps = distance_to_steps(nearest_distance)

                # A close safety warning takes priority over grouped scene narration.
                if nearest_distance <= DISTANCE_WARNING_METERS:
                    phrase = get_group_phrase(nearest["group"])
                    message = (f"Warning! There is a {phrase} approximately "
                               f"{nearest_steps} steps away, {nearest['direction']}. Please be careful.")
                    if current_time - last_announcement_time >= ANNOUNCEMENT_INTERVAL:
                        announce(message, priority=True)
                        last_announcement_time = current_time
                        last_message = message
                else:
                    # Group same object classes in the same direction and similar step range.
                    grouped = {}
                    for item in detections:
                        if item.get("distance") is None:
                            continue
                        steps = distance_to_steps(item["distance"])
                        key = (item["name"], item["direction"], steps)
                        grouped[key] = grouped.get(key, 0) + 1
                    parts = []
                    for (name, direction_name, steps), count in sorted(
                        grouped.items(), key=lambda entry: (entry[0][2] or 999, entry[0][0])
                    )[:4]:
                        if name == "person":
                            noun = "person" if count == 1 else "people"
                        else:
                            noun = name if count == 1 else name + "s"
                        step_word = "step" if steps == 1 else "steps"
                        parts.append(f"{count} {noun} {direction_name}, approximately {steps} {step_word} away")
                    message = "I detect " + "; and ".join(parts) + "." if parts else ""
                    if message and current_time - last_announcement_time >= ANNOUNCEMENT_INTERVAL and message != last_message:
                        announce(message)
                        last_announcement_time = current_time
                        last_message = message

            # Display FPS.*

            now = time.time()



            elapsed = now - previous_frame_time







            if elapsed > 0:



                instant_fps = 1.0 / elapsed







                if fps == 0:



                    fps = instant_fps



                else:



                    fps = 0.9 * fps + 0.1 * instant_fps







            previous_frame_time = now







            cv2.putText(



                frame,



                f"YOLO26l | GPU | FPS: {fps:.1f}",



                (10, 25),



                cv2.FONT_HERSHEY_SIMPLEX,



                0.65,



                (0, 255, 255),



                2



            )







            cv2.imshow("Drishti - Blind Assist", frame)







            # Press M to ask a question or say start/stop to control announcements.*

            # Press Q to quit.*

            key = cv2.waitKey(1) & 0xFF

            if key == ord("m"):

                listen_for_voice_query(detections)

            elif key == ord("q"):

                break







    except KeyboardInterrupt:



        print("Stopping Drishti...", flush=True)







    finally:



        camera.release()



        cv2.destroyAllWindows()







        stop_speech.set()







        try:



            speech_queue.put_nowait(None)



        except queue.Full:



            pass







        tts_thread.join(timeout=2.0)







        print("Drishti stopped.", flush=True)











if __name__ == "__main__":



    main()
