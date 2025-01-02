import urllib
import pathlib

import numpy as np

import cv2

import mediapipe as mp
from mediapipe.framework.formats import landmark_pb2
from mediapipe.tasks.python.core import base_options as base_options_module
from mediapipe.tasks.python import vision

# Constants
MARGIN = 10  # pixels
FONT_SIZE = 2
FONT_THICKNESS = 2
HANDEDNESS_TEXT_COLOR = (88, 205, 54)  # vibrant green

# Path to the model file
model_path = pathlib.Path("hand_landmarker.task")

# Check if the model file exists, if not, download it
if not model_path.exists():
    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
    print()
    print(f"Downloading model from {url}...")
    urllib.request.urlretrieve(url, model_path)
    print(f"Model downloaded and saved as {model_path}")

# Initialize MediaPipe HandLandmarker
base_options = base_options_module.BaseOptions(model_asset_path=model_path)
options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=2)
detector = vision.HandLandmarker.create_from_options(options)


# Function to check if a finger is up
def is_finger_up(hand_landmarks, finger_tip, finger_middle):
    """Check if a finger is up based on its tip and middle joint landmarks."""
    return hand_landmarks[finger_tip].y < hand_landmarks[finger_middle].y

def is_thumb_out(hand_landmarks):
    """Check if the thumb is extended outward."""
    return abs(hand_landmarks[4].x - hand_landmarks[2].x) > 0.05

# Function to draw landmarks on the image
def draw_landmarks_on_image(rgb_image, detection_result):
    hand_landmarks_list = detection_result.hand_landmarks
    handedness_list = detection_result.handedness
    annotated_image = np.copy(rgb_image)

    # Loop through the detected hands to visualize
    for idx in range(len(hand_landmarks_list)):
        hand_landmarks = hand_landmarks_list[idx]
        handedness = handedness_list[idx]
        corrected_handedness = (
            "Right" if handedness[0].category_name == "Left" else "Left"
        )

        # Draw hand landmarks
        hand_landmarks_proto = landmark_pb2.NormalizedLandmarkList()
        hand_landmarks_proto.landmark.extend(
            [
                landmark_pb2.NormalizedLandmark(
                    x=landmark.x, y=landmark.y, z=landmark.z
                )
                for landmark in hand_landmarks
            ]
        )
        # source code here: https://github.com/google-ai-edge/mediapipe/blob/e5067b2134fa28e4c248aa482ef18ac57afb9d58/mediapipe/python/solutions/drawing_utils.py#L119
        mp.solutions.drawing_utils.draw_landmarks(
            annotated_image,
            hand_landmarks_proto,
            mp.solutions.hands.HAND_CONNECTIONS,
            mp.solutions.drawing_styles.get_default_hand_landmarks_style(),
            mp.solutions.drawing_styles.get_default_hand_connections_style(),
        )

        # Get the top left corner of the detected hand's bounding box
        height, width, _ = annotated_image.shape
        x_coordinates = [landmark.x for landmark in hand_landmarks]
        y_coordinates = [landmark.y for landmark in hand_landmarks]
        text_x = int(min(x_coordinates) * width)
        text_y = int(min(y_coordinates) * height) - MARGIN

        # Draw handedness (left or right hand) on the image
        cv2.putText(
            annotated_image,
            f"{corrected_handedness}",
            (text_x, text_y),
            cv2.FONT_HERSHEY_DUPLEX,
            FONT_SIZE,
            HANDEDNESS_TEXT_COLOR,
            FONT_THICKNESS,
            cv2.LINE_AA,
        )

    return annotated_image

# Open webcam video stream
cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    # Flip the frame horizontally
    frame = cv2.flip(frame, 1)

    # Convert the frame to RGB and create MediaPipe Image
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

    # Detect hand landmarks in the frame
    detection_result = detector.detect(mp_image)

    # Annotate frame with detected landmarks
    if detection_result and detection_result.hand_landmarks:
        annotated_frame = draw_landmarks_on_image(frame, detection_result)

        # Process each detected hand
        for idx, hand_landmarks in enumerate(detection_result.hand_landmarks):
            # Finger states
            index_up = is_finger_up(hand_landmarks, 8, 6)
            middle_up = is_finger_up(hand_landmarks, 12, 10)
            ring_up = is_finger_up(hand_landmarks, 16, 14)
            pinky_up = is_finger_up(hand_landmarks, 20, 19)

            if index_up == False:
                print(f"Hand {idx + 1}: Index finger is down!")
            if middle_up == False:
                print(f"Hand {idx + 1}: Middle finger is down!")
            if ring_up == False:
                print(f"Hand {idx + 1}: Ring finger is down!")
            if pinky_up == False:
                print(f"Hand {idx + 1}: Pinky finger is down!")  

            if (pinky_up == False & ring_up == False & middle_up == False & index_up == False): 
                print("All fingers are down!")

            if is_thumb_out(hand_landmarks) == False:
                print("Thumb is in!")

    else:
        annotated_frame = frame

    # Display the annotated frame
    cv2.imshow("Hand Detection", annotated_frame)

    # Exit on pressing 'q'
    if cv2.waitKey(5) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
