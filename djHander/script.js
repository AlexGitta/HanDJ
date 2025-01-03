const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

// Hide the video element
videoElement.style.display = 'none';

// Create filters for player 1
const lowPassFilter1 = new Tone.Filter(200, "lowpass").toDestination();
const midPassFilter1 = new Tone.Filter(1000, "bandpass").toDestination();
const highPassFilter1 = new Tone.Filter(5000, "highpass").toDestination();

// Create filters for player 2
const lowPassFilter2 = new Tone.Filter(200, "lowpass").toDestination();
const midPassFilter2 = new Tone.Filter(1000, "bandpass").toDestination();
const highPassFilter2 = new Tone.Filter(5000, "highpass").toDestination();

const player1 = new Tone.Player("tracks/flimAphexTwin.mp3", () => {
  console.log("Player 1 loaded");
}).toDestination();

const player2 = new Tone.Player("tracks/yourLoveProdigy.mp3", () => {
  console.log("Player 2 loaded");
}).toDestination();


let isPlayer1Playing = false;
let isPlayer2Playing = false;
let wasHand1Closed = false;
let wasHand2Closed = false;

function isFingerUp(landmarks, fingerIndices) {
    const [base, mcp, pip, dip, tip] = fingerIndices;
    return landmarks[tip].y < landmarks[mcp].y && landmarks[tip].y < landmarks[base].y;
  }

  function isThumbOut(landmarks) {  // slightly more complex logic as thumb is dependant on left or right hand
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];

    const averageX = (indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 4;

    return Math.abs(thumbTip.x - averageX) > 0.1; 
}

  
  function detectFingerPoses(landmarks) {
    const thumb = [0, 1, 2, 3, 4];
    const indexFinger = [0, 5, 6, 7, 8];
    const middleFinger = [0, 9, 10, 11, 12];
    const ringFinger = [0, 13, 14, 15, 16];
    const pinkyFinger = [0, 17, 18, 19, 20];

    const thumbOut = isThumbOut(landmarks);
    const indexFingerUp = isFingerUp(landmarks, indexFinger);
    const middleFingerUp = isFingerUp(landmarks, middleFinger);
    const ringFingerUp = isFingerUp(landmarks, ringFinger);
    const pinkyFingerUp = isFingerUp(landmarks, pinkyFinger);
  
    return {
      thumbOut,
      indexFingerUp,
      middleFingerUp,
      ringFingerUp,
      pinkyFingerUp
    };
  }
  

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
   // canvasCtx.drawImage(      // uncomment to see video
    //    results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.scale(-1, 1); // Flip the canvas horizontally
    canvasCtx.translate(-canvasElement.width, 0); // Move the canvas back to the original position
    if (results.multiHandLandmarks && results.multiHandedness) {
        const handsData = results.multiHandLandmarks.map((landmarks, index) => ({
            landmarks,
            label: results.multiHandedness[index].label
        }));

        handsData.forEach((handData, handIndex) => {
            const handLabel = handData.label === 'Left' ? 'Hand 1 (Right)' : 'Hand 2 (Left)';
            const landmarks = handData.landmarks;

            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});

            const poses = detectFingerPoses(landmarks);
            if (!poses.thumbOut) {
                console.log(`${handLabel} thumb is in`);
            }
            if (!poses.indexFingerUp) {
                console.log(`${handLabel} index finger is down`);
            }
            if (!poses.middleFingerUp) {
                console.log(`${handLabel} middle finger is down`);
            }
            if (!poses.ringFingerUp) {
                console.log(`${handLabel} ring finger is down`);
            }
            if (!poses.pinkyFingerUp) {
                console.log(`${handLabel} pinky finger is down`);
            }
            if (!poses.indexFingerUp && !poses.middleFingerUp && !poses.ringFingerUp && !poses.pinkyFingerUp) { 
              console.log(`${handLabel} all fingers down`);
              if (handData.label === 'Left') {
                if (!wasHand2Closed) {
                  if (isPlayer2Playing) {
                    player2.stop();
                    isPlayer2Playing = false;
                  } else {
                    player2.start();
                    isPlayer2Playing = true;
                  }
                  wasHand2Closed = true;
                }
              } else {
                if (!wasHand1Closed) {
                  if (isPlayer1Playing) {
                    player1.stop();
                    isPlayer1Playing = false;
                  } else {
                    player1.start();
                    isPlayer1Playing = true;
                  }
                  wasHand1Closed = true;
                }
              }
            } else {
              if (handData.label === 'Left') {
                wasHand2Closed = false;
              } else {
                wasHand1Closed = false;
              }
            }
        });
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});
camera.start();