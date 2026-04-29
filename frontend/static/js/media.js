// Media upload and recording functionality for Farmer Assistant Chat
// Global variables for media functionality
let mediaRecorder;
let recordedChunks = [];
let recordingTimer;
let recordingSeconds = 0;
let cameraStream;
let selectedImages = []; // Store selected images with their data
let selectedDocuments = []; // Store selected documents with their data
let lastAnalyzedDocuments = []; // Store last analyzed documents for follow-up questions

// ==========================================
// IMAGE UPLOAD FUNCTIONALITY
// ==========================================

function initializeImageUpload() {
  document.getElementById('imageButton').addEventListener('click', function() {
    if (!window.userState || !window.userState.isLoggedIn) {
      alert('Please login to upload images!');
      window.location.href = "/login";
      return;
    }
    document.getElementById('imageInput').click();
  });
  
  document.getElementById('imageInput').addEventListener('change', function(e) {
    const files = e.target.files;
    if (files.length > 0) {
      // Add all selected images to the preview area
      for (let file of files) {
        if (file.type.startsWith('image/')) {
          addImageToPreview(file);
        }
      }
    }
    // Clear input so same file can be selected again
    e.target.value = '';
  });
}

function addImageToPreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageData = {
      file: file,
      dataUrl: e.target.result,
      name: file.name,
      id: Date.now() + Math.random() // Unique ID for each image
    };
    
    selectedImages.push(imageData);
    updateImagePreviewArea();
  };
  reader.readAsDataURL(file);
}

function updateImagePreviewArea() {
  let previewContainer = document.getElementById('imagePreviewContainer');
  
  // Create preview container if it doesn't exist
  if (!previewContainer) {
    const chatForm = document.getElementById('chatForm');
    previewContainer = document.createElement('div');
    previewContainer.id = 'imagePreviewContainer';
    previewContainer.className = 'hidden';
    chatForm.parentNode.insertBefore(previewContainer, chatForm);
  }
  
  if (selectedImages.length === 0) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
    return;
  }
  
  // Show preview container with images
  previewContainer.classList.remove('hidden');
  previewContainer.className = 'mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 shadow-sm';
  
  let html = '<div class="flex items-center justify-between mb-2">';
  html += '<span class="text-sm font-semibold text-green-800">' + selectedImages.length + ' image(s) ready to analyze</span>';
  html += '<button type="button" onclick="clearAllImages()" class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors">Clear all</button>';
  html += '</div>';
  html += '<div class="flex gap-2 flex-wrap">';
  
  selectedImages.forEach((img, index) => {
    html += `
      <div class="relative group">
        <img src="${img.dataUrl}" alt="${img.name}" class="w-24 h-24 object-cover rounded-lg border-2 border-green-300 shadow-md hover:shadow-lg transition-shadow">
        <button 
          type="button" 
          onclick="removeImage(${index})"
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg font-bold">
          ×
        </button>
        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate opacity-0 group-hover:opacity-100 transition-opacity">
          ${img.name}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add helpful hint for users
  html += '<div class="mt-2 text-xs text-green-700 italic">Tip: Images stay selected for follow-up questions. Clear them when done!</div>';
  
  previewContainer.innerHTML = html;
}

// Make these functions global so they can be called from inline onclick handlers
window.removeImage = function(index) {
  selectedImages.splice(index, 1);
  updateImagePreviewArea();
};

window.clearAllImages = function() {
  selectedImages = [];
  updateImagePreviewArea();
};

// ==========================================
// CAMERA FUNCTIONALITY
// ==========================================

function initializeCameraFunctionality() {
  document.getElementById('cameraButton').addEventListener('click', function() {
    if (!window.userState || !window.userState.isLoggedIn) {
      alert('Please login to use camera!');
      window.location.href = "/login";
      return;
    }
    openCamera();
  });
  
  document.getElementById('closeCameraModal').addEventListener('click', function() {
    closeCameraModal();
  });
  
  document.getElementById('capturePhoto').addEventListener('click', function() {
    capturePhoto();
  });
  
  document.getElementById('retakePhoto').addEventListener('click', function() {
    retakePhoto();
  });
  
  document.getElementById('usePhoto').addEventListener('click', function() {
    usePhoto();
  });
  
  // Close modal when clicking outside
  document.getElementById('cameraModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeCameraModal();
    }
  });
}

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('cameraStream');
    video.srcObject = cameraStream;
    document.getElementById('cameraModal').classList.remove('hidden');
  } catch (error) {
    alert('Camera access denied or not available: ' + error.message);
  }
}

function capturePhoto() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('photoCanvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Hide video, show canvas
  video.style.display = 'none';
  canvas.style.display = 'block';
  
  // Update buttons
  document.getElementById('capturePhoto').style.display = 'none';
  document.getElementById('retakePhoto').style.display = 'inline-block';
  document.getElementById('usePhoto').style.display = 'inline-block';
}

function retakePhoto() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('photoCanvas');
  
  // Show video, hide canvas
  video.style.display = 'block';
  canvas.style.display = 'none';
  
  // Update buttons
  document.getElementById('capturePhoto').style.display = 'inline-block';
  document.getElementById('retakePhoto').style.display = 'none';
  document.getElementById('usePhoto').style.display = 'none';
}

function usePhoto() {
  const canvas = document.getElementById('photoCanvas');
  canvas.toBlob(function(blob) {
    const fileName = `photo_${new Date().getTime()}.png`;
    
    // Create a File object from the blob
    const file = new File([blob], fileName, { type: 'image/png' });
    
    // Add to preview area just like uploaded images
    addImageToPreview(file);
    
    closeCameraModal();
  }, 'image/png');
}

function closeCameraModal() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('cameraModal').classList.add('hidden');
  
  // Reset camera modal state
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('photoCanvas');
  video.style.display = 'block';
  canvas.style.display = 'none';
  document.getElementById('capturePhoto').style.display = 'inline-block';
  document.getElementById('retakePhoto').style.display = 'none';
  document.getElementById('usePhoto').style.display = 'none';
}

// ==========================================
// DOCUMENT UPLOAD FUNCTIONALITY
// ==========================================

function initializeDocumentUpload() {
  document.getElementById('documentButton').addEventListener('click', function() {
    if (!window.userState || !window.userState.isLoggedIn) {
      alert('Please login to upload documents!');
      window.location.href = "/login";
      return;
    }
    document.getElementById('documentInput').click();
  });
  
  document.getElementById('documentInput').addEventListener('change', function(e) {
    const files = e.target.files;
    if (files.length > 0) {
      // Add all selected documents to the preview area
      for (let file of files) {
        if (allowed_file(file.name)) {
          addDocumentToPreview(file);
        } else {
          alert(`File type not supported: ${file.name}`);
        }
      }
    }
    // Clear input so same file can be selected again
    e.target.value = '';
  });
}

function allowed_file(filename) {
  const allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'csv', 'xlsx', 'pptx'];
  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}

function addDocumentToPreview(file) {
  const documentData = {
    file: file,
    name: file.name,
    size: file.size,
    type: file.type,
    id: Date.now() + Math.random() // Unique ID for each document
  };
  
  selectedDocuments.push(documentData);
  updateDocumentPreviewArea();
}

function updateDocumentPreviewArea() {
  let previewContainer = document.getElementById('documentPreviewContainer');
  
  // Create preview container if it doesn't exist
  if (!previewContainer) {
    const chatForm = document.getElementById('chatForm');
    previewContainer = document.createElement('div');
    previewContainer.id = 'documentPreviewContainer';
    previewContainer.className = 'hidden';
    chatForm.parentNode.insertBefore(previewContainer, chatForm);
  }
  
  if (selectedDocuments.length === 0) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
    return;
  }
  
  // Show preview container with documents
  previewContainer.classList.remove('hidden');
  previewContainer.className = 'mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-sm';
  
  let html = '<div class="flex items-center justify-between mb-2">';
  html += '<span class="text-sm font-semibold text-blue-800">' + selectedDocuments.length + ' document(s) ready to analyze</span>';
  html += '<button type="button" onclick="clearAllDocuments()" class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors">Clear all</button>';
  html += '</div>';
  html += '<div class="flex gap-2 flex-wrap">';
  
  selectedDocuments.forEach((doc, index) => {
    const fileSizeKB = (doc.size / 1024).toFixed(1);
    const fileExtension = doc.name.split('.').pop().toUpperCase();
    const iconColors = {
      'PDF': 'bg-red-100 text-red-600',
      'DOCX': 'bg-blue-100 text-blue-600',
      'DOC': 'bg-blue-100 text-blue-600',
      'TXT': 'bg-gray-100 text-gray-600',
      'XLSX': 'bg-green-100 text-green-600',
      'CSV': 'bg-green-100 text-green-600',
      'PPTX': 'bg-orange-100 text-orange-600'
    };
    const colorClass = iconColors[fileExtension] || 'bg-purple-100 text-purple-600';
    
    html += `
      <div class="relative group ${colorClass} p-3 rounded-lg border-2 border-blue-300 shadow-md hover:shadow-lg transition-shadow max-w-xs">
        <button 
          type="button" 
          onclick="removeDocument(${index})"
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg font-bold">
          ×
        </button>
        <div class="flex items-center gap-2">
          <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm truncate" title="${doc.name}">${doc.name}</p>
            <p class="text-xs opacity-75">${fileExtension} • ${fileSizeKB} KB</p>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add helpful hint for users
  html += '<div class="mt-2 text-xs text-blue-700 italic">Tip: Documents stay selected for follow-up questions. Add optional text to ask specific questions!</div>';
  
  previewContainer.innerHTML = html;
}

// Make these functions global
window.removeDocument = function(index) {
  selectedDocuments.splice(index, 1);
  updateDocumentPreviewArea();
};

window.clearAllDocuments = function() {
  selectedDocuments = [];
  updateDocumentPreviewArea();
  // Clear document context
  delete window.currentDocumentText;
  delete window.currentDocumentName;
  lastAnalyzedDocuments = [];
};
// ==========================================
// VOICE RECORDING FUNCTIONALITY
// ==========================================
// VOICE RECORDING FUNCTIONALITY
// ==========================================

function initializeVoiceRecording() {
  document.getElementById('voiceButton').addEventListener('click', function() {
    if (!window.userState || !window.userState.isLoggedIn) {
      alert('Please login to use voice chat!');
      window.location.href = "/login";
      return;
    }
    openVoiceModal();
  });
  
  document.getElementById('closeVoiceModal').addEventListener('click', function() {
    closeVoiceModal();
  });
  
  document.getElementById('startRecording').addEventListener('click', function() {
    startVoiceRecording();
  });
  
  document.getElementById('stopRecording').addEventListener('click', function() {
    stopVoiceRecording();
  });
  
  document.getElementById('sendVoice').addEventListener('click', function() {
    sendVoiceMessage();
  });
  
  // Close modal when clicking outside
  document.getElementById('voiceModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeVoiceModal();
    }
  });
}

function openVoiceModal() {
  document.getElementById('voiceModal').classList.remove('hidden');
  resetVoiceModal();
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    
    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = function() {
      const blob = new Blob(recordedChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = document.getElementById('recordedAudio');
      audio.src = audioUrl;
      audio.style.display = 'block';
      
      document.getElementById('sendVoice').style.display = 'inline-block';
    };
    
    mediaRecorder.start();
    
    // Update UI
    document.getElementById('startRecording').style.display = 'none';
    document.getElementById('stopRecording').style.display = 'inline-block';
    document.getElementById('recordingIndicator').style.display = 'flex';
    
    // Start timer
    recordingSeconds = 0;
    recordingTimer = setInterval(updateRecordingTime, 1000);
    
  } catch (error) {
    alert('Microphone access denied or not available: ' + error.message);
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  // Update UI
  document.getElementById('startRecording').style.display = 'inline-block';
  document.getElementById('stopRecording').style.display = 'none';
  document.getElementById('recordingIndicator').style.display = 'none';
  
  // Stop timer
  clearInterval(recordingTimer);
}

function updateRecordingTime() {
  recordingSeconds++;
  const minutes = Math.floor(recordingSeconds / 60);
  const seconds = recordingSeconds % 60;
  document.getElementById('recordingTime').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function sendVoiceMessage() {
  const audio = document.getElementById('recordedAudio');
  const duration = document.getElementById('recordingTime').textContent;
  
  addVoiceToChat(audio.src, duration);
  closeVoiceModal();
}

function addVoiceToChat(audioUrl, duration) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'self-end bg-accent text-white rounded-xl shadow p-3 max-w-md';
  
  messageDiv.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path>
      </svg>
      <div>
        <p class="font-medium">Voice Message</p>
        <p class="text-sm opacity-90">${duration}</p>
      </div>
    </div>
    <audio controls class="w-full mt-2" style="filter: invert(1);">
      <source src="${audioUrl}" type="audio/wav">
    </audio>
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Simulate AI response
  setTimeout(() => {
    addMessageToChat('I received your voice message! I\'m processing it and will respond shortly.', 'assistant');
  }, 1000);
}

function resetVoiceModal() {
  document.getElementById('startRecording').style.display = 'inline-block';
  document.getElementById('stopRecording').style.display = 'none';
  document.getElementById('sendVoice').style.display = 'none';
  document.getElementById('recordingIndicator').style.display = 'none';
  document.getElementById('recordedAudio').style.display = 'none';
  document.getElementById('recordingTime').textContent = '00:00';
  recordingSeconds = 0;
}

function closeVoiceModal() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopVoiceRecording();
  }
  document.getElementById('voiceModal').classList.add('hidden');
  resetVoiceModal();
}

// Initialize all media functionality
function initializeMediaFunctionality() {
  initializeImageUpload();
  initializeCameraFunctionality();
  initializeDocumentUpload();
  initializeVoiceRecording();
}