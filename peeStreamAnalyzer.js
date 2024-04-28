let audioContext;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let audioStream;
const MAX_RECORDING_TIME = 510000;
const MEDIAN_MALE_FLOW_RATE = 15;
let recordingTimeout;

const recordButton = document.getElementById("recordButton");
const resultDiv = document.getElementById("result");
const canvas = document.getElementById("audioCanvas");
const recordingAnimation = document.getElementById("recordingAnimation");
const durationTable = document.getElementById("durationTable");
const durationDataInfo = document.getElementById("durationData");
const landing = document.getElementsByClassName("landing")[0];
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;

async function startRecording(as) {
  canvas.style.display = "none";
  durationDataInfo.style.display = "none";

  // If microphone access was successful, clear any existing error messages
  updateErrorMessage("");
  audioContext = new AudioContext();
  mediaRecorder = new MediaRecorder(as);

  mediaRecorder.ondataavailable = function (e) {
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async function () {
    const audioBlob = new Blob(audioChunks, { type: "audio/aac" });
    audioChunks = []; // Clear the chunks for the next recording
    const arrayBuffer = await audioBlob.arrayBuffer();

    audioContext.decodeAudioData(arrayBuffer, function (buffer) {
      const audioBuffer = buffer.getChannelData(0);
      const threshold = 0.006; // Set threshold here

      visualizeAudio(audioBuffer); // Visualize the audio data
      const longestDuration = analyzeAndLogLongestStream(
        audioBuffer,
        audioContext.sampleRate,
        threshold
      );

      // Call createAudioElement with the audio blob and the message
      const message = `The longest continuous pee stream is <span class="duration">${longestDuration.toFixed(
        2
      )}</span> seconds long. You produced approximately <span class="volume">${calculateUrineVolume(
        longestDuration
      ).toFixed(
        0
      )}</span> milliliters of liquid or <span style="font-weight: bold">${bottlesOfHeineken(
        calculateUrineVolume(longestDuration)
      )} </span> of <img src="assets/images/heineken.png" class="heineken" alt="heineken"/>`;
      createAudioElement(audioBlob, message);
      canvas.style.display = "block";
    });

    as.getTracks().forEach((track) => track.stop()); // Stop the media tracks
  };

  mediaRecorder.start();

  // Schedule the stopRecording to be called after MAX_RECORDING_TIME
  recordingTimeout = setTimeout(() => {
    if (isRecording) {
      stopRecording();
    }
  }, MAX_RECORDING_TIME);

  recordButton.textContent = "Stop";
  recordButton.style.backgroundColor = "black";
  isRecording = true;
}

function updateErrorMessage(message) {
  const errorMessageDiv = document.getElementById("errorMessage"); // Make sure to add this element to your HTML
  errorMessageDiv.textContent = message;
  errorMessageDiv.style.display = message ? "block" : "none";
}

function stopRecording() {
  // Clear the timeout to prevent it from stopping recording if the user has already done so
  clearTimeout(recordingTimeout);
  mediaRecorder.stop();
  recordButton.textContent = "Calculating...";
  recordButton.disabled = true;
  isRecording = false;
  recordingAnimation.style.display = "none"; // Hide recording animation
}

async function toggleRecording() {
  if (!isRecording) {
    try {
      // Attempt to get audio input from the user's microphone
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Log the error to the console
      console.error("An error occurred: ", err);

      // Display an error message to the user using HTML
      updateErrorMessage(
        "Error: Please ensure your microphone is connected and not disabled."
      );
      return; // Early return to stop further execution
    }
    startRecording(audioStream);
    landing.style.display = "none";
    recordingAnimation.style.display = "block"; // Show recording animation
  } else {
    stopRecording();
    recordingAnimation.style.display = "none"; // Hide recording animation
  }
}

function visualizeAudio(data) {
  ctx.clearRect(0, 0, width, height); // Clear the canvas first
  ctx.beginPath();
  ctx.moveTo(0, height / 2);

  // Downsample the data by picking one in every 'n' samples
  const step = Math.ceil(data.length / width);
  for (let i = 0; i < width; i++) {
    const dataPoint = data[i * step];
    const x = i;
    const y = (dataPoint * height) / 4 + height / 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function analyzeAndLogLongestStream(data, sampleRate, threshold) {
  let longestStream = 0;
  let currentStream = 0;
  let isNoise = false;
  let toleranceCounter = 0;
  const tolerance = sampleRate * 0.2;

  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) {
      if (!isNoise) isNoise = true;
      currentStream++;
      toleranceCounter = tolerance;
    } else {
      if (isNoise && toleranceCounter > 0) {
        currentStream++;
        toleranceCounter--;
      } else {
        longestStream = Math.max(longestStream, currentStream);
        isNoise = false;
        currentStream = 0;
      }
    }
  }
  longestStream = Math.max(longestStream, currentStream); // Ensure the last segment is considered
  const longestDuration = longestStream / sampleRate;

  // Store the duration along with date and time in local storage
  const dateTime = new Date().toISOString();
  const durationData = JSON.parse(localStorage.getItem("durations")) || [];
  durationData.push({ dateTime, duration: longestDuration });
  localStorage.setItem("durations", JSON.stringify(durationData));

  recordButton.textContent = "Record Again";
  recordButton.style.backgroundColor = "red";
  recordButton.disabled = false;
  return longestDuration;
}

function createAudioElement(blob, message) {
  // Clear any existing content in resultDiv
  resultDiv.innerHTML = "";

  // Create the audio element and set its source to the blob URL
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.src = url;
  audio.controls = true;
  audio.playsInline = true; // Add playsInline for iOS devices

  // Append only if new Audio was created
  if (!audio.id) {
    audio.id = "audioPlayer";
    resultDiv.appendChild(audio);
  }

  // Check if a message was provided, and if so, create and append a text element for it
  if (message) {
    const textElement = document.createElement("p");
    textElement.innerHTML = message;
    resultDiv.appendChild(textElement); // Append the message after the audio controls
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const sortTimeButton = document.getElementById("sortTimeButton");
  const sortDurationButton = document.getElementById("sortDurationButton");
  const canvasDuration = document.getElementById("durationGraph");

  if (!localStorage.getItem("durations")) {
    loadTableButton.style.display = "none";
  }

  // Parse and sort data by duration initially
  let durationData = JSON.parse(localStorage.getItem("durations")) || [];
  let sortedByDuration = true; // Initial state is sorted by duration

  function sortDurationData() {
    durationData.sort((a, b) => b.duration - a.duration);
    sortedByDuration = true;
    canvasDuration.style.display = "none";
    renderTable();
  }

  function sortTimeData() {
    durationData.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    sortedByDuration = false;
    renderTable();
  }

  function renderTable() {
    // Reference to the table's tbody
    const tableBody = durationTable.getElementsByTagName("tbody")[0];
    tableBody.innerHTML = ""; // Clear the table body

    // Iterate over sorted durationData to create and append table rows and cells
    durationData.forEach((item, index) => {
      const row = document.createElement("tr");
      const durationCell = document.createElement("td");
      durationCell.textContent = item.duration.toFixed(2);
      const dateCell = document.createElement("td");
      const date = new Date(item.dateTime);
      dateCell.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

      row.appendChild(durationCell);
      row.appendChild(dateCell);
      tableBody.appendChild(row);

      // Highlight the top duration
      if (sortedByDuration && index === 0) {
        row.classList.add("highlight");
      }
    });
    if (!sortedByDuration) {
      drawGraph(durationData); // Update the graph if necessary
    }
  }

  loadTableButton.addEventListener("click", function () {
    sortDurationData(); // Default sort by duration
    sortTimeButton.style.display = "inline-block";
    sortDurationButton.style.display = "inline-block";
    durationTable.style.display = "table";
    loadTableButton.style.display = "none";

    durationDataInfo.style.display = "block";
  });

  sortTimeButton.addEventListener("click", sortTimeData);
  sortDurationButton.addEventListener("click", sortDurationData);
});

function drawGraph(data) {
  const canvas = document.getElementById("durationGraph");
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");

  const margin = 50; // Margin around the graph for labels
  const graphWidth = canvas.width - 2 * margin;
  const graphHeight = canvas.height - 2 * margin;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw axes
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, canvas.height - margin);
  ctx.lineTo(canvas.width - margin, canvas.height - margin);
  ctx.strokeStyle = "black"; // Stroke color for the axes
  ctx.stroke();

  // Draw data as line segments
  ctx.beginPath();
  ctx.moveTo(margin, canvas.height - margin);
  const maxDuration = Math.max(...data.map((item) => item.duration));

  data.forEach((item, index) => {
    const x = margin + (index / data.length) * graphWidth;
    const y =
      canvas.height - margin - (item.duration / maxDuration) * graphHeight;
    ctx.lineTo(x, y);
  });

  ctx.lineTo(margin + graphWidth, canvas.height - margin);
  ctx.fillStyle = "#fff"; // Graph fill color
  ctx.fill();
  ctx.strokeStyle = "#000"; // Graph line color
  ctx.stroke();

  // Draw red dots at data points on top of the line
  data.forEach((item, index) => {
    const x = margin + (index / data.length) * graphWidth;
    const y =
      canvas.height - margin - (item.duration / maxDuration) * graphHeight;

    ctx.fillStyle = "gold"; // Set fill color for the dot
    ctx.beginPath(); // Begin a new path for the dot
    ctx.arc(x, y, 6, 0, Math.PI * 2); // Draw a circle for the dot
    ctx.fill(); // Fill the dot with red color
  });

  // Reset styles before drawing text
  ctx.fillStyle = "black"; // Text color for the labels
  ctx.font = "12px Arial"; // Set the font size for the labels

  // Labels for Y axis (Duration)
  ctx.textAlign = "right"; // Align text to the right for Y axis labels
  ctx.textBaseline = "middle"; // Center text vertically
  for (let i = 0; i <= maxDuration; i += maxDuration / 10) {
    const y = canvas.height - margin - (i / maxDuration) * graphHeight;
    ctx.fillText(`${i.toFixed(2)}s`, margin - 10, y);
  }

  // Labels for X axis (Date)
  ctx.textAlign = "center"; // Center text horizontally for X axis labels
  ctx.textBaseline = "top"; // Align text to the top for X axis labels
  const labelFrequency = Math.ceil(data.length / 10); // Adjust to show more or fewer labels
  data.forEach((item, index) => {
    if (index % labelFrequency === 0) {
      const x = margin + (index / data.length) * graphWidth;
      const date = new Date(item.dateTime);
      ctx.fillText(date.toLocaleDateString(), x, canvas.height - margin + 10);
    }
  });
}

function calculateUrineVolume(duration) {
  return duration * MEDIAN_MALE_FLOW_RATE;
}

function bottlesOfHeineken(volumeMl) {
  // Calculate number of bottles
  let numBottles = volumeMl / 250;

  // Format the result in layman's terms
  if (numBottles < 0.1) {
    return "barely a sip";
  } else if (numBottles < 0.5) {
    return "less than half a bottle";
  } else if (numBottles < 0.75) {
    return "about half a bottle";
  } else if (numBottles < 1) {
    return "almost a full bottle";
  } else if (numBottles >= 1 && numBottles < 1.25) {
    return "just over a bottle";
  } else if (numBottles < 1.5) {
    return "about a bottle and a half";
  } else if (numBottles < 1.75) {
    return "nearly two bottles";
  } else if (numBottles < 2) {
    return "almost two bottles";
  } else if (numBottles >= 2 && numBottles < 2.5) {
    return "about two bottles";
  } else {
    // Round to the nearest whole number for larger amounts
    let bottlesRounded = Math.round(numBottles);
    return `about ${bottlesRounded} bottles`;
  }
}

let deferredPrompt;
const installPopup = document.getElementById("installPopup");
const btnAdd = document.getElementById("btnAdd");
const btnClose = document.getElementById("btnClose");

btnClose.addEventListener("click", () => {
  installPopup.style.display = "none"; // Hide the popup
});

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt

  e.preventDefault();
  deferredPrompt = e;

  // Check if we've already shown the prompt
  if (!localStorage.getItem("installPromptShown")) {
    showInstallPrompt(); // Implement this function to update the UI
  }
});

function showInstallPrompt() {
  installPopup.style.display = "block";
  // Show the install prompt to the user
  btnAdd.style.display = "block";

  btnAdd.addEventListener("click", () => {
    installPopup.style.display = "none";
    btnAdd.style.display = "none";
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt");
      } else {
        console.log("User dismissed the A2HS prompt");
      }
      deferredPrompt = null;
    });

    // Mark that we've shown the prompt
    localStorage.setItem("installPromptShown", true);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isSafari || isIOS) {
    if (!localStorage.getItem("installPromptShown")) {
      var installPopup = document.getElementById("installPopup");
      var btnAdd = document.getElementById("btnAdd");

      btnAdd.addEventListener("click", function () {
        // Hide the default install button
        installPopup.style.display = "none";

        // Provide instructions for Safari users
        // Check if we've already shown the prompt

        showSafariInstallInstructions();
      });

      // Show the popup since Safari does not support `beforeinstallprompt`
      installPopup.style.display = "block";
      btnAdd.innerText = "See How";
    }
  }
});

function showSafariInstallInstructions() {
  var message = document.createElement("div");
  message.classList.add("ios-popup");
  document.body.appendChild(message);
  localStorage.setItem("installPromptShown", true);
  // Add a close button at the top-right corner of the popup
  var closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.classList.add("close-button");
  closeButton.onclick = function () {
    document.body.removeChild(message);
  };
  message.appendChild(closeButton);

  // Create and append the header
  var header = document.createElement("h2");
  header.textContent = "Add to Home Screen";
  message.appendChild(header);

  // Create and append the instruction paragraph
  var paragraph = document.createElement("p");
  paragraph.innerHTML =
    "To install this app on your iOS device, tap the Share icon <br> and then 'Add to Home Screen'.";
  message.appendChild(paragraph);

  // Scroll the message into view smoothly
  message.scrollIntoView({
    behavior: "smooth", // Animates the scroll
    block: "start", // Aligns the message at the top of the view
    inline: "nearest", // Centers it horizontally
  });
}
