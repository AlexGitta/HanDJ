const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

// Hide the video element
videoElement.style.display = 'none';

// Create filters for player 1
const lowPassFilter1 = new Tone.Filter(20000, "lowpass").toDestination();
const midPassFilter1 = new Tone.Filter(1000, "bandpass").toDestination();
const highPassFilter1 = new Tone.Filter(20000, "highpass").toDestination();

// Create filters for player 2
const lowPassFilter2 = new Tone.Filter(20000, "lowpass").toDestination();
const midPassFilter2 = new Tone.Filter(1000, "bandpass").toDestination();
const highPassFilter2 = new Tone.Filter(20000, "highpass").toDestination();

// Create volume nodes for each player
const volumeNode1 = new Tone.Volume(0).toDestination();
const volumeNode2 = new Tone.Volume(0).toDestination();

// Create reverb effects for each player
const reverb1 = new Tone.Reverb({decay: 20, wet: 0.9}).toDestination();
const reverb2 = new Tone.Reverb({decay: 20, wet: 0.9}).toDestination();
reverb1.name = "reverb1"
reverb2.name = "reverb2"
let reverb1Enabled = false;
let reverb2Enabled = false;

const tracks1 = ["tracksUKMIX/Footsie-HitIt.mp3", "tracksUKMIX/JoyOrbison-flightfm.mp3", "tracksUKMIX/Kahn-Dread(GorgonSoundVersion).mp3"];
const tracks2 = ["tracksUKMIX/Slimzee-MileEnd(ZeroRemix).mp3", "tracksUKMIX/TheProdigy-Omen.mp3", "tracksUKMIX/Hamdi-Skanka(NikkiNairRemix).mp3"];
let currentTrackIndex1 = 0;
let currentTrackIndex2 = 0;

const player1 = new Tone.Player({
    url: tracks1[currentTrackIndex1],
    onload: () => {
      console.log("Player 1 loaded");
      updateTrackName(1, tracks1[currentTrackIndex1]);
    },
    onerror: (error) => {
      console.error("Error loading Player 1:", error);
    },
    onstop: () => {
      
    }
  }).connect(reverb1).connect(lowPassFilter1).connect(midPassFilter1).connect(highPassFilter1).connect(volumeNode1);
  
  const player2 = new Tone.Player({
    url: tracks2[currentTrackIndex2],
    onload: () => {
      console.log("Player 2 loaded");
      updateTrackName(2, tracks2[currentTrackIndex2]);
    },
    onerror: (error) => {
      console.error("Error loading Player 2:", error);
    },
    onstop: () => {
      
    }
  }).connect(reverb2).connect(lowPassFilter2).connect(midPassFilter2).connect(highPassFilter2).connect(volumeNode2);

let isPlayer1Playing = false;
let isPlayer2Playing = false;
let wasHand1Closed = false;
let wasHand2Closed = false;
let wasThumbIn1 = false;
let wasThumbIn2 = false;

function changeTrack(player, tracks, currentTrackIndex, handLabel) {
    currentTrackIndex = (currentTrackIndex + 1)
    if (currentTrackIndex >= tracks.length) {currentTrackIndex-=tracks.length}
    player.load(tracks[currentTrackIndex]);
   // console.log(`${handLabel} changed to track: ${tracks[currentTrackIndex]}`);
    
    return currentTrackIndex;
  }

function updateTrackName(playerNumber, trackName) {
    const trackNameElement = document.getElementById(`trackName${playerNumber}`);
    trackNameElement.textContent = `Current Track ${playerNumber}: ${trackName}`;
  }

// Smoothing filter for landmark positions
const smoothingFactor = 0.2;
let previousLandmarks = {
  'Left': [],
  'Right': []
};

function smoothLandmarks(currentLandmarks, handLabel) {
  if (previousLandmarks[handLabel].length === 0) {
    previousLandmarks[handLabel] = currentLandmarks;
    return currentLandmarks;
  }

  const smoothedLandmarks = currentLandmarks.map((landmark, index) => {
    return {
      x: smoothingFactor * previousLandmarks[handLabel][index].x + (1 - smoothingFactor) * landmark.x,
      y: smoothingFactor * previousLandmarks[handLabel][index].y + (1 - smoothingFactor) * landmark.y,
      z: smoothingFactor * previousLandmarks[handLabel][index].z + (1 - smoothingFactor) * landmark.z,
    };
  });

  previousLandmarks[handLabel] = smoothedLandmarks;
  return smoothedLandmarks;
}


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

function applyFilters(lowPassFilter, midPassFilter, highPassFilter, poses) {
  lowPassFilter.frequency.value = !poses.indexFingerUp ? 0 : 20000;
  midPassFilter.frequency.value = !poses.middleFingerUp ? 0 : 1000;
  highPassFilter.frequency.value = !poses.ringFingerUp ? 20000 : 0;
}

function adjustVolume(volumeNode, landmarks) {
  const wristY = landmarks[0].y; // Get the wrist's y-position
  const normalizedY = Math.min(Math.max(wristY, 0), 1); // Clamp value between 0 and 1

  // Map the y-position to volume (-60 dB at the bottom, 0 dB at the top)
  const volume = -60 + (1 - normalizedY) * 60;

  volumeNode.volume.value = volume;

  //console.log(`Volume adjusted: ${volume.toFixed(2)} dB`);
}

function calculateHorizontalMovement(currentLandmark, previousLandmark) {
 // console.log(Math.abs(currentLandmark.x - previousLandmark.x));
  return Math.abs(currentLandmark.x - previousLandmark.x);
}

function adjustReverbDecay(reverb, movement) {
  const maxDecay = 20;
  const minDecay = 0.001;
  const decayRate = 0.1; // Rate at which reverb decay decreases
  let decay = reverb.decay;

  if (movement > 0.005) {
    decay = Math.min(maxDecay, decay + movement * 100); // Increase decay with movement
  } else {
    decay = Math.max(minDecay, decay - decayRate); // Decrease decay gradually
  }

  reverb.decay = decay;
  adjustReverbLabel(reverb, decay.toFixed(2));
  //console.log(`Reverb decay adjusted: ${decay.toFixed(2)}`);
}

function adjustReverbLabel(reverb, reverbamt) {
  const reverbElement = document.getElementById(`${reverb.name}`);
  reverbElement.textContent = `Current ${reverb}: ${reverbamt}`;
}

let frameCount = 0;
let previousWristPosition = {
  'Left': null,
  'Right': null
};
  
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.scale(-1, 1); // Flip the canvas horizontally
  canvasCtx.translate(-canvasElement.width, 0); // Move the canvas back to the original position
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  if (results.multiHandLandmarks && results.multiHandedness) {
    const handsData = results.multiHandLandmarks.map((landmarks, index) => ({
      landmarks: smoothLandmarks(landmarks, results.multiHandedness[index].label),
      label: results.multiHandedness[index].label
    }));

      handsData.forEach((handData, handIndex) => {
        const handLabel = handData.label === 'Left' ? 'Hand 1 (Right)' : 'Hand 2 (Left)';
        const landmarks = handData.landmarks;

        if (landmarks.length >= 18)
        {
          const handColour = (handData.label === 'Left' && isPlayer2Playing) || (handData.label === 'Right' && isPlayer1Playing) ? '#00FF00' : '#FF0000';
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: handColour, lineWidth: 5 });
          drawLandmarks(canvasCtx, landmarks, { color: handColour, lineWidth: 2 });

          const poses = detectFingerPoses(landmarks);

          if (!poses.indexFingerUp) {
            //console.log(`${handLabel} index finger is down`);
          }
          if (!poses.middleFingerUp) {
            //console.log(`${handLabel} middle finger is down`);
          }
          if (!poses.ringFingerUp) {
            //console.log(`${handLabel} ring finger is down`);
          }
          if (!poses.pinkyFingerUp) {
            //console.log(`${handLabel} pinky finger is down`);
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
            if (!poses.thumbOut) {
              console.log(`${handLabel} thumb is in`);
              if (handData.label === 'Left') {
                if (!wasThumbIn2) {
                  currentTrackIndex2 = changeTrack(player2, tracks2, currentTrackIndex2, handLabel);
                  wasThumbIn2 = true;
                }
              } else {
                if (!wasThumbIn1) {
                  currentTrackIndex1 = changeTrack(player1, tracks1, currentTrackIndex1, handLabel);
                  wasThumbIn1 = true;
                }
              }
            } else {
              if (handData.label === 'Left') {
                wasThumbIn2 = false;
              } else {
                wasThumbIn1 = false;
              }
            }
          }
          if (handData.label === 'Left') {
            adjustVolume(volumeNode2, landmarks);
            applyFilters(lowPassFilter2, midPassFilter2, highPassFilter2, poses);
            if (frameCount % 3 === 0) {
              previousWristPosition['Left'] = landmarks[0];
            }
            if (previousWristPosition['Left']) {
              const movement = calculateHorizontalMovement(landmarks[0], previousWristPosition['Left']);
              adjustReverbDecay(reverb2, movement);
            }
            previousLandmarks['Left'] = landmarks;
          } else {
            adjustVolume(volumeNode1, landmarks);
            applyFilters(lowPassFilter1, midPassFilter1, highPassFilter1, poses);
            if (frameCount % 3 === 0) {
              previousWristPosition['Right'] = landmarks[0];
            }
            if (previousWristPosition['Right']) {
              const movement = calculateHorizontalMovement(landmarks[0], previousWristPosition['Right']);
              adjustReverbDecay(reverb1, movement);
            }
            previousLandmarks['Right'] = landmarks;
          }
        }
    });
  
  }
  frameCount++;
  canvasCtx.restore();
}


const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
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
