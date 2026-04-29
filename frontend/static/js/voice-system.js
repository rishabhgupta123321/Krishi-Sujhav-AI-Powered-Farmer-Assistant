/**
 * Voice Interaction System for Krishi Sujhav
 * Features: Voice input, real-time transcription, streaming responses, TTS output
 */

class VoiceInteractionSystem {
    constructor() {
        this.isListening = false;
        this.isProcessing = false;
        this.isSpeaking = false;
        this.currentLanguage = localStorage.getItem('language') || 'en';
        this.recognition = null;
        this.synthesis = null;
        this.currentStream = null;
        this.voiceSession = null;
        
        this.initializeVoiceSystem();
        this.initializeUI();
        this.loadTTSConfig();
    }

    initializeVoiceSystem() {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            
            this.setupRecognitionEvents();
        } else {
            console.warn('Speech Recognition not supported in this browser');
        }

        // Initialize Text-to-Speech
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        } else {
            console.warn('Text-to-Speech not supported in this browser');
        }
    }

    setupRecognitionEvents() {
        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.updateVoiceUI('listening');
        };

        this.recognition.onresult = (event) => {
            let transcript = '';
            let confidence = 0;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript = event.results[i][0].transcript;
                    confidence = event.results[i][0].confidence;
                    this.handleTranscript(transcript, confidence);
                } else {
                    // Show interim results
                    const interimTranscript = event.results[i][0].transcript;
                    this.updateTranscriptUI(interimTranscript, false);
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.updateVoiceUI('error');
            this.isListening = false;
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isListening = false;
            this.updateVoiceUI('idle');
        };
    }

    initializeUI() {
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;

        // Create voice control panel
        const voicePanel = document.createElement('div');
        voicePanel.className = 'voice-panel fixed bottom-4 right-4 bg-white rounded-xl shadow-lg p-4 border-2 border-green-200 z-50';
        voicePanel.innerHTML = `
            <div class="voice-controls flex items-center space-x-3">
                <button id="voiceToggle" class="voice-btn bg-green-500 hover:bg-green-600 text-white p-3 rounded-full transition-all duration-200 shadow-lg">
                    Mic
                </button>
                <button id="cameraVoice" class="voice-btn bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition-all duration-200 shadow-lg">
                    Cam
                </button>
                <button id="stopSpeaking" class="voice-btn bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-all duration-200 shadow-lg hidden">
                    Mute
                </button>
                <div class="voice-status text-sm text-gray-600 min-w-20">
                    <span id="voiceStatusText">Ready</span>
                </div>
            </div>
            <div id="transcriptPreview" class="transcript-preview mt-2 text-sm text-gray-700 hidden bg-gray-50 p-2 rounded"></div>
            <div id="voiceWaveform" class="voice-waveform mt-2 hidden">
                <div class="wave-bars flex items-end justify-center space-x-1 h-8">
                    <div class="bar bg-green-400 w-1 rounded-full animate-pulse" style="height: 20%"></div>
                    <div class="bar bg-green-500 w-1 rounded-full animate-pulse" style="height: 40%"></div>
                    <div class="bar bg-green-600 w-1 rounded-full animate-pulse" style="height: 60%"></div>
                    <div class="bar bg-green-500 w-1 rounded-full animate-pulse" style="height: 30%"></div>
                    <div class="bar bg-green-400 w-1 rounded-full animate-pulse" style="height: 50%"></div>
                </div>
            </div>
        `;

        document.body.appendChild(voicePanel);

        // Add event listeners
        document.getElementById('voiceToggle').addEventListener('click', () => this.toggleVoiceInput());
        document.getElementById('cameraVoice').addEventListener('click', () => this.startCameraVoiceAnalysis());
        document.getElementById('stopSpeaking').addEventListener('click', () => this.stopSpeaking());

        // Language change listener
        document.addEventListener('languageChanged', (e) => {
            this.currentLanguage = e.detail.language;
            this.updateRecognitionLanguage();
        });
    }

    async loadTTSConfig() {
        try {
            const response = await fetch('/api/voice/tts-config');
            this.ttsConfig = await response.json();
        } catch (error) {
            console.error('Error loading TTS config:', error);
            // Fallback config
            this.ttsConfig = {
                'en': { lang: 'en-US', rate: 1.0, pitch: 1.0 },
                'hi': { lang: 'hi-IN', rate: 0.9, pitch: 1.0 }
            };
        }
    }

    updateRecognitionLanguage() {
        if (!this.recognition) return;
        
        const langMap = {
            'en': 'en-US',
            'hi': 'hi-IN',
            'mr': 'mr-IN',
            'pa': 'pa-IN',
            'ml': 'ml-IN'
        };
        
        this.recognition.lang = langMap[this.currentLanguage] || 'en-US';
    }

    toggleVoiceInput() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (!this.recognition || this.isListening || this.isSpeaking) return;

        this.updateRecognitionLanguage();
        this.isListening = true;
        
        try {
            this.recognition.start();
            this.startVoiceSession();
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.isListening = false;
        }
    }

    stopListening() {
        if (!this.recognition || !this.isListening) return;
        
        this.recognition.stop();
        this.isListening = false;
    }

    async startVoiceSession() {
        try {
            const response = await fetch('/api/voice/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    language: this.currentLanguage
                })
            });
            
            this.voiceSession = await response.json();
        } catch (error) {
            console.error('Error starting voice session:', error);
        }
    }

    async handleTranscript(transcript, confidence) {
        if (!transcript.trim()) return;

        console.log('Transcript:', transcript, 'Confidence:', confidence);
        
        // Update UI
        this.updateTranscriptUI(transcript, true);
        this.updateVoiceUI('processing');
        
        // Send to chat
        await this.processVoiceInput(transcript);
    }

    async processVoiceInput(message) {
        try {
            this.isProcessing = true;
            
            // Add user message to chat immediately
            this.addMessageToChat(message, 'user');
            
            // Start streaming response
            await this.streamVoiceResponse(message);
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.updateVoiceUI('error');
        } finally {
            this.isProcessing = false;
            this.updateVoiceUI('idle');
        }
    }

    async streamVoiceResponse(message) {
        const messagesContainer = document.getElementById('messages');
        
        // Create streaming message element
        const streamingDiv = document.createElement('div');
        streamingDiv.className = 'message assistant-message bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded-r-lg';
        streamingDiv.innerHTML = `
            <div class="message-header flex items-center mb-2">
                <span class="text-green-600 font-medium">Krishi AI</span>
                <div class="typing-indicator ml-2">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
            </div>
            <div class="message-content text-gray-800" id="streamingContent"></div>
            <button class="speak-btn mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors" onclick="voiceSystem.speakText(this.previousElementSibling.textContent)">
                🔊 Speak
            </button>
        `;
        
        messagesContainer.appendChild(streamingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        const contentDiv = document.getElementById('streamingContent');
        let fullResponse = '';
        
        try {
            const response = await fetch('/api/voice/chat-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    language: this.currentLanguage
                })
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            
                            if (data.error) {
                                contentDiv.textContent = 'Error: ' + data.error;
                                break;
                            }
                            
                            if (data.accumulated) {
                                contentDiv.textContent = data.accumulated;
                                fullResponse = data.accumulated;
                            }
                            
                            if (data.complete) {
                                // Remove typing indicator
                                const typingIndicator = streamingDiv.querySelector('.typing-indicator');
                                if (typingIndicator) {
                                    typingIndicator.remove();
                                }
                                
                                // Auto-speak the response
                                if (this.shouldAutoSpeak()) {
                                    setTimeout(() => {
                                        this.speakText(fullResponse);
                                    }, 500);
                                }
                                
                                break;
                            }
                            
                            // Auto-scroll
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            
                        } catch (parseError) {
                            console.error('Error parsing stream data:', parseError);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error streaming response:', error);
            contentDiv.textContent = 'Error getting response. Please try again.';
        }
    }

    shouldAutoSpeak() {
        // Auto-speak if voice session is active and user preferences allow
        return this.voiceSession && this.voiceSession.active && !this.isSpeaking;
    }

    speakText(text, options = {}) {
        if (!this.synthesis || this.isSpeaking) return;
        
        // Stop any current speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const config = this.ttsConfig[this.currentLanguage] || this.ttsConfig['en'];
        
        // Configure voice
        utterance.rate = options.rate || config.rate;
        utterance.pitch = options.pitch || config.pitch;
        utterance.volume = options.volume || config.volume || 1.0;
        
        // Find appropriate voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(config.lang.split('-')[0])
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        // Event handlers
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateSpeakingUI(true);
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
        };
        
        utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
        };
        
        // Speak
        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.updateSpeakingUI(false);
        }
    }

    async startCameraVoiceAnalysis() {
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Create camera modal
            this.createCameraModal(stream);
            
        } catch (error) {
            console.error('Camera access error:', error);
            alert('Unable to access camera. Please check permissions.');
        }
    }

    createCameraModal(stream) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Take Photo for Disease Analysis</h3>
                    <button id="closeCameraModal" class="text-gray-500 hover:text-gray-700">
                        ×
                    </button>
                </div>
                <div class="camera-container bg-gray-100 rounded-lg overflow-hidden mb-4">
                    <video id="cameraVideo" class="w-full h-64 object-cover" autoplay muted></video>
                    <canvas id="photoCanvas" class="hidden"></canvas>
                </div>
                <div class="flex space-x-3">
                    <button id="capturePhoto" class="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600">
                        Capture & Analyze
                    </button>
                    <button id="retakePhoto" class="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 hidden">
                        Retake
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('photoCanvas');
        const captureBtn = document.getElementById('capturePhoto');
        const retakeBtn = document.getElementById('retakePhoto');
        const closeBtn = document.getElementById('closeCameraModal');
        
        video.srcObject = stream;
        
        captureBtn.addEventListener('click', () => this.captureAndAnalyze(video, canvas, modal, stream));
        retakeBtn.addEventListener('click', () => this.retakePhoto(video, canvas, captureBtn, retakeBtn));
        closeBtn.addEventListener('click', () => this.closeCameraModal(modal, stream));
    }

    async captureAndAnalyze(video, canvas, modal, stream) {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop camera
        stream.getTracks().forEach(track => track.stop());
        
        // Show loading
        modal.querySelector('.camera-container').innerHTML = `
            <div class="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                    <p class="text-gray-600">Analyzing image...</p>
                </div>
            </div>
        `;
        
        try {
            // Send to API
            const formData = new FormData();
            formData.append('image_data', imageData);
            formData.append('language', this.currentLanguage);
            
            const response = await fetch('/api/voice/analyze-image', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            // Close modal
            document.body.removeChild(modal);
            
            // Process result
            if (result.success) {
                this.handleImageAnalysisResult(result);
            } else {
                this.addMessageToChat(result.voice_text || 'Could not analyze image', 'assistant');
                if (result.voice_text) {
                    this.speakText(result.voice_text);
                }
            }
            
        } catch (error) {
            console.error('Image analysis error:', error);
            document.body.removeChild(modal);
            this.addMessageToChat('Error analyzing image. Please try again.', 'assistant');
        }
    }

    handleImageAnalysisResult(result) {
        const { disease, confidence, voice_text, advice, plant_emoji, formatted_name } = result;
        
        // Add analysis result to chat
        const analysisMessage = `
            <div class="disease-analysis bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
                <div class="flex items-center mb-3">
                    <span class="text-2xl mr-2">${plant_emoji}</span>
                    <div>
                        <h4 class="font-semibold text-green-800">${formatted_name}</h4>
                        <p class="text-sm text-gray-600">Confidence: ${confidence.toFixed(1)}%</p>
                    </div>
                </div>
                <div class="voice-response bg-white p-3 rounded border border-gray-200 mb-3">
                    <p class="text-gray-700">${voice_text}</p>
                </div>
                <div class="treatment-advice">
                    <h5 class="font-medium text-blue-800 mb-2">Treatment Advice:</h5>
                    <p class="text-gray-700 text-sm">${advice}</p>
                </div>
                <button class="speak-analysis-btn mt-3 bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors" onclick="voiceSystem.speakAnalysisResult('${voice_text}', '${advice}')">
                    Speak Full Analysis
                </button>
            </div>
        `;
        
        this.addMessageToChat(analysisMessage, 'assistant', true);
        
        // Auto-speak the voice response
        if (this.shouldAutoSpeak()) {
            setTimeout(() => {
                this.speakText(voice_text);
            }, 500);
        }
    }

    speakAnalysisResult(voiceText, advice) {
        const fullText = voiceText + '. ' + advice;
        this.speakText(fullText);
    }

    retakePhoto(video, canvas, captureBtn, retakeBtn) {
        video.style.display = 'block';
        canvas.style.display = 'none';
        captureBtn.style.display = 'block';
        retakeBtn.style.display = 'none';
    }

    closeCameraModal(modal, stream) {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
    }

    // UI Update Methods
    updateVoiceUI(state) {
        const statusText = document.getElementById('voiceStatusText');
        const voiceToggle = document.getElementById('voiceToggle');
        const waveform = document.getElementById('voiceWaveform');
        
        if (!statusText || !voiceToggle) return;
        
        switch (state) {
            case 'listening':
                statusText.textContent = 'Listening...';
                voiceToggle.innerHTML = '⏹️';
                voiceToggle.className = voiceToggle.className.replace('bg-green-500', 'bg-red-500');
                waveform.classList.remove('hidden');
                break;
                
            case 'processing':
                statusText.textContent = 'Processing...';
                voiceToggle.innerHTML = '⏳';
                waveform.classList.add('hidden');
                break;
                
            case 'error':
                statusText.textContent = 'Error';
                voiceToggle.innerHTML = '🎤';
                voiceToggle.className = voiceToggle.className.replace('bg-red-500', 'bg-green-500');
                waveform.classList.add('hidden');
                break;
                
            default: // idle
                statusText.textContent = 'Ready';
                voiceToggle.innerHTML = '🎤';
                voiceToggle.className = voiceToggle.className.replace('bg-red-500', 'bg-green-500');
                waveform.classList.add('hidden');
        }
    }

    updateTranscriptUI(transcript, isFinal) {
        const preview = document.getElementById('transcriptPreview');
        if (!preview) return;
        
        if (transcript.trim()) {
            preview.textContent = transcript;
            preview.classList.remove('hidden');
            
            if (isFinal) {
                preview.classList.add('border-green-200', 'bg-green-50');
                setTimeout(() => {
                    preview.classList.add('hidden');
                    preview.classList.remove('border-green-200', 'bg-green-50');
                }, 2000);
            }
        } else {
            preview.classList.add('hidden');
        }
    }

    updateSpeakingUI(isSpeaking) {
        const stopBtn = document.getElementById('stopSpeaking');
        const statusText = document.getElementById('voiceStatusText');
        
        if (isSpeaking) {
            stopBtn.classList.remove('hidden');
            if (statusText) statusText.textContent = 'Speaking...';
        } else {
            stopBtn.classList.add('hidden');
            if (statusText) statusText.textContent = 'Ready';
        }
    }

    addMessageToChat(content, sender, isHTML = false) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message ${sender === 'user' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-green-50 border-l-4 border-green-500'} p-4 mb-4 rounded-r-lg`;
        
        if (isHTML) {
            messageDiv.innerHTML = content;
        } else {
            messageDiv.innerHTML = `
                <div class="message-header flex items-center mb-2">
                    <span class="${sender === 'user' ? 'text-blue-600' : 'text-green-600'} font-medium">
                        ${sender === 'user' ? 'You' : 'Krishi AI'}
                    </span>
                    ${sender === 'assistant' ? `<button class="speak-btn ml-auto bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600" onclick="voiceSystem.speakText('${content.replace(/'/g, "\\'")}')">Speak</button>` : ''}
                </div>
                <div class="message-content text-gray-800">${content}</div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Utility Methods
    getVoiceCommands() {
        return fetch('/api/voice/quick-commands')
            .then(response => response.json())
            .catch(error => {
                console.error('Error getting voice commands:', error);
                return {};
            });
    }
}

// Initialize voice system when DOM is loaded
let voiceSystem;
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment to ensure other systems are initialized
    setTimeout(() => {
        voiceSystem = new VoiceInteractionSystem();
        console.log('Voice Interaction System initialized');
    }, 1000);
});

// Make voiceSystem globally accessible for onclick handlers
window.voiceSystem = voiceSystem;