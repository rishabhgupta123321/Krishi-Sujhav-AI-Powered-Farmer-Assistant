// Main application JavaScript for Farmer Assistant Chat
// Clean, functional version with Gemini AI integration

// Helper function to format disease names for better display
function formatDiseaseName(label) {
    // Replace underscores with spaces
    let formatted = label.replace(/_/g, ' ');
    
    // Remove double underscores
    formatted = formatted.replace(/  /g, ' - ');
    
    // Capitalize first letter of each word
    formatted = formatted.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    return formatted;
}

// Helper function to get plant emoji
function getPlantEmoji(label) {
    const lower = label.toLowerCase();
    if (lower.includes('potato')) return '🥔';
    if (lower.includes('tomato')) return '🍅';
    if (lower.includes('pepper') || lower.includes('bell')) return '🌶️';
    return '🌿';
}

// Global state management (exposed globally for media.js)
window.userState = {
    isLoggedIn: false,
    fullName: null,
    firstName: null
};

let chatHistory = [];
let isTyping = false;
let lastAnalyzedImages = []; // Track last analyzed images for follow-up questions

// Initialize user state from server data
function initializeUserState(serverUserState) {
    window.userState = serverUserState;
    updateUI();
}

// Update UI based on user authentication state
function updateUI() {
    const userGreeting = document.getElementById('userGreeting');
    
    if (window.userState.isLoggedIn && window.userState.firstName) {
        // Authenticated user state
        userGreeting.textContent = `Welcome, ${window.userState.firstName}!`;
        
        // Don't modify footerContent - let the server-rendered HTML handle it
        // The Jinja template already has proper styling for logged-in users
        
        // Load chat history if user is logged in
        loadChatHistory();
        
    } else {
        // Guest user state
        userGreeting.textContent = 'Welcome! Please login to chat';
        
        // Don't modify footerContent - let the server-rendered HTML handle it
        // The Jinja template already has proper styling for guest users
    }
}

// Load chat history from server
async function loadChatHistory() {
    try {
        const response = await fetch('/api/chat/history');
        if (response.ok) {
            const data = await response.json();
            chatHistory = data.history || [];
            displayChatHistory();
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Display chat history in the UI
function displayChatHistory() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    if (chatHistory.length === 0) {
        addWelcomeMessage();
        return;
    }
    
    chatHistory.forEach(chat => {
        addMessageToChat(chat.userMessage, 'user', false);
        addMessageToChat(chat.aiResponse, 'assistant', false);
    });
    
    scrollToBottom();
}

// Add welcome message
function addWelcomeMessage() {
    const chatMessages = document.getElementById('chatMessages');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'self-start bg-white rounded-xl shadow p-4 max-w-2xl border border-slate-200';
    // Use server-provided translations if available
    const t = window.APP_TRANSLATIONS || {};
    const titleText = t.chat_title || 'Farmer Assistant AI';
    const welcomeText = t.welcome_message || "Hello! I'm your AI farming assistant powered by KrishiSujhav. I can help you with:";
    const items = [
        t.welcome_crop_diseases || 'Crop diseases and pest management',
        t.welcome_fertilizer || 'Fertilizer and soil recommendations',
        t.welcome_weather || 'Weather and irrigation advice',
        t.welcome_market || 'Market prices and selling strategies',
        t.welcome_organic || 'Organic farming practices',
        t.welcome_livestock || 'Livestock management'
    ];
    const question = t.welcome_question || 'Ask me any farming question in your preferred language!';

    welcomeDiv.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="h-8 w-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
            </div>
            <div class="flex-1">
                <div class="font-semibold text-slate-900 mb-1">${escapeHtml(titleText)}</div>
                <div class="text-slate-700">
                    ${escapeHtml(welcomeText)}
                    <ul class="list-disc list-inside mt-2 space-y-1">
                        ${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                    </ul>
                    <p class="mt-3 text-sm text-slate-600">${escapeHtml(question)}</p>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(welcomeDiv);
    scrollToBottom();
}

// Handle chat input - require login to send messages
async function handleChatInput() {
    if (!window.userState.isLoggedIn) {
        alert('Please login to start chatting with the Farmer Assistant!');
        window.location.href = "/login";
        return false;
    }
    
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    // Check if we have images selected (from media.js global variable)
    const hasImages = typeof selectedImages !== 'undefined' && selectedImages.length > 0;
    
    // Check if we have documents selected (from media.js global variable)
    const hasDocuments = typeof selectedDocuments !== 'undefined' && selectedDocuments.length > 0;
    
    // Check if we have previously analyzed images for context
    const hasImageContext = lastAnalyzedImages.length > 0;
    
    // Check if we have document context (from document upload)
    const hasDocumentContext = typeof lastAnalyzedDocuments !== 'undefined' && lastAnalyzedDocuments.length > 0;
    
    if (!message && !hasImages && !hasDocuments) {
        return false;
    }
    
    if (isTyping) {
        return false;
    }
    
    // If there are NEW images selected, handle image upload with optional text
    if (hasImages) {
        await handleImagesWithText(message);
        chatInput.value = '';
        return false;
    }
    
    // If there are NEW documents selected, handle document upload with optional text
    if (hasDocuments) {
        await handleDocumentsWithText(message);
        chatInput.value = '';
        return false;
    }
    
    // If user asks a follow-up question with image context (but no new images)
    if (hasImageContext && message) {
        await handleFollowUpQuestion(message);
        chatInput.value = '';
        return false;
    }
    
    // If user asks a question about previously uploaded documents
    if (hasDocumentContext && message) {
        await handleDocumentFollowUp(message);
        chatInput.value = '';
        return false;
    }
    
    // Regular text-only chat
    addMessageToChat(message, 'user', true);
    chatInput.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Send message to backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (response.ok && data.success) {
            // Add AI response to chat
            addMessageToChat(data.response, 'assistant', true);
            
            // Update chat history
            chatHistory.push({
                userMessage: message,
                aiResponse: data.response,
                timestamp: new Date().toISOString(),
                language: data.language
            });
        } else {
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }
            addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        addMessageToChat('Sorry, I couldn\'t connect to the server. Please check your internet connection.', 'assistant', true);
    }
    
    return false;
}

// ==========================================
// DOCUMENT HANDLING (Image-style flow)
// ==========================================

async function handleDocumentsWithText(textMessage) {
    if (typeof selectedDocuments === 'undefined' || selectedDocuments.length === 0) {
        return;
    }
    
    // Create user message with documents and text (same style as images)
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'self-end max-w-2xl mb-4';
    
    let html = '<div class="bg-accent text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">';
    
    // Add document icons (compact style like images)
    if (selectedDocuments.length > 0) {
        html += '<div class="flex flex-wrap gap-2 mb-2">';
        selectedDocuments.forEach((doc) => {
            const fileExtension = doc.name.split('.').pop().toUpperCase();
            const iconEmojis = {
                'PDF': 'PDF', 'DOCX': 'DOC', 'DOC': 'DOC', 'TXT': 'TXT',
                'XLSX': 'XLS', 'CSV': 'CSV', 'PPTX': 'PPT'
            };
            const icon = iconEmojis[fileExtension] || 'DOC';
            html += `<span class="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs font-medium">`;
            html += `${icon} ${doc.name.length > 20 ? doc.name.substring(0, 17) + '...' : doc.name}`;
            html += `</span>`;
        });
        html += '</div>';
    }
    
    // Add text message if provided
    if (textMessage) {
        html += `<div class="whitespace-pre-wrap mt-2">${escapeHtml(textMessage)}</div>`;
    }
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    html += `<div class="text-xs text-accent-100 mt-1 opacity-75">${timestamp}</div>`;
    html += '</div>';
    
    messageDiv.innerHTML = html;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Show typing indicator
    showTypingIndicator();
    
    // Store documents locally for processing (important!)
    const documentsToProcess = [...selectedDocuments];
    
    // Clear documents after sending to prevent re-sending with next query
    // User can upload again if they want to analyze more documents
    selectedDocuments = [];
    updateDocumentPreviewArea();
    
    // Extract all documents first
    try {
        const allExtractions = [];
        
        for (let i = 0; i < documentsToProcess.length; i++) {
            const doc = documentsToProcess[i];
            const formData = new FormData();
            formData.append('file', doc.file);
            
            const response = await fetch('/api/document/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                allExtractions.push({
                    filename: doc.name,
                    text: data.extracted_text || data.text || '',
                    word_count: data.text_length || Math.round((data.extracted_text || '').split(/\s+/).length) || 0,
                    ai_analysis: data.ai_analysis || null
                });
            } else {
                allExtractions.push({
                    filename: doc.name,
                    error: data.error || 'Extraction failed'
                });
            }
        }
        
        // Store extraction context for follow-up questions
        lastAnalyzedDocuments = allExtractions;
        
        // Check if we have AI analysis from the upload endpoint already
        const hasAIAnalysis = allExtractions.some(e => e.ai_analysis);
        
        // If user provided a text question AND we have AI analysis, use it directly
        if (textMessage && textMessage.trim() && hasAIAnalysis) {
            hideTypingIndicator();
            
            const lang = window.APP_LANG || 'en';
            let fullResponse = '';
            
            // Document extraction results (compact format)
            if (lang === 'hi') {
                fullResponse = '📄 **दस्तावेज़ निष्कर्षण**:\n';
            } else if (lang === 'mr') {
                fullResponse = '📄 **दस्तऐवज काढणे**:\n';
            } else if (lang === 'pa') {
                fullResponse = '📄 **ਦਸਤਾਵੇਜ਼ ਕੱਢਣਾ**:\n';
            } else if (lang === 'ml') {
                fullResponse = '📄 **ഡോക്യുമെന്റ് എക്സ്ട്രാക്ഷൻ**:\n';
            } else {
                fullResponse = '📄 **Document Extraction**:\n';
            }
            
            // Add extraction results
            allExtractions.forEach((result, index) => {
                if (result.text) {
                    if (documentsToProcess.length > 1) {
                        fullResponse += `${index + 1}. ${result.filename} (${result.word_count} words)\n`;
                    } else {
                        fullResponse += `${result.filename} (${result.word_count} ${lang === 'hi' ? 'शब्द' : 'words'})\n`;
                    }
                }
            });
            
            // Add separator and AI analysis
            fullResponse += '\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
            fullResponse += allExtractions[0].ai_analysis; // Use the AI analysis from upload
            
            addMessageToChat(fullResponse, 'assistant', true);
        }
        // If user provided a text question but no AI analysis, call chat API
        else if (textMessage && textMessage.trim()) {
            // Build document content summary for Gemini context (like disease context for images)
            let documentContext = '';
            let documentList = [];
            
            allExtractions.forEach((result, index) => {
                if (result.text) {
                    documentList.push(result.filename);
                    if (documentsToProcess.length > 1) {
                        documentContext += `Document ${index + 1} (${result.filename}): ${result.word_count} words\n`;
                    } else {
                        documentContext += `Document: ${result.filename} (${result.word_count} words)\n`;
                    }
                }
            });
            
            // Create context message for Gemini (same pattern as images)
            const fullDocumentText = allExtractions.map(e => e.text).filter(t => t).join('\n\n');
            const contextMessage = `I have extracted content from ${documentsToProcess.length} document(s):\n${documentContext}\n\nDocument content:\n${fullDocumentText}\n\nThe user is asking: "${textMessage}"\n\nPlease provide a helpful response about the document content and answer their question in their language.`;
            
            // Send to chat API (will use Gemini directly, same as images)
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: contextMessage,
                    userQuery: textMessage,
                    documentNames: documentList,
                    documentCount: documentsToProcess.length
                })
            });
            
            const chatData = await chatResponse.json();
            hideTypingIndicator();
            
            if (chatResponse.ok && chatData.success) {
                // Show document extraction summary first, then Gemini's response
                const t = window.APP_TRANSLATIONS || {};
                const lang = window.APP_LANG || 'en';
                
                let fullResponse = '';
                
                // Document extraction results (compact format like ML predictions)
                if (lang === 'hi') {
                    fullResponse = '**दस्तावेज़ निष्कर्षण**:\n';
                } else if (lang === 'mr') {
                    fullResponse = '**दस्तऐवज काढणे**:\n';
                } else if (lang === 'pa') {
                    fullResponse = '**ਦਸਤਾਵੇਜ਼ ਕੱਢਣਾ**:\n';
                } else if (lang === 'ml') {
                    fullResponse = '**ഡോക്യുമെന്റ് എക്സ്ട്രാക്ഷൻ**:\n';
                } else {
                    fullResponse = '**Document Extraction**:\n';
                }
                
                // Add compact extraction results
                allExtractions.forEach((result, index) => {
                    if (result.text) {
                        if (documentsToProcess.length > 1) {
                            fullResponse += `${index + 1}. ${result.filename} (${result.word_count} words)\n`;
                        } else {
                            fullResponse += `${result.filename} (${result.word_count} ${lang === 'hi' ? 'शब्द' : 'words'})\n`;
                        }
                    }
                });
                
                // Add separator and Gemini's expert response
                fullResponse += '\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
                fullResponse += chatData.response;
                
                addMessageToChat(fullResponse, 'assistant', true);
            } else {
                addMessageToChat('Failed to analyze documents: ' + (chatData.error || 'Unknown error'), 'assistant', true);
            }
        } else {
            // No text question - just show extraction results (like showing predictions only)
            hideTypingIndicator();
            const lang = window.APP_LANG || 'en';
            let extractionSummary = '';
            
            if (lang === 'hi') {
                extractionSummary = '**दस्तावेज़ निष्कर्षण पूर्ण**\n\n';
            } else {
                extractionSummary = '**Document Extraction Complete**\n\n';
            }
            
            allExtractions.forEach((result, index) => {
                if (result.text) {
                    extractionSummary += `**${index + 1}. ${result.filename}**\n`;
                    extractionSummary += `Word Count: ${result.word_count}\n`;
                    extractionSummary += `Preview: ${result.text.substring(0, 200)}...\n\n`;
                } else if (result.error) {
                    extractionSummary += `**${index + 1}. ${result.filename}** - ${result.error}\n\n`;
                }
            });
            
            addMessageToChat(extractionSummary, 'assistant', true);
        }
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error processing documents:', error);
        addMessageToChat('Sorry, I could not process the documents. Please try again.', 'assistant', true);
    }
}

// Handle follow-up questions about previously uploaded documents
async function handleDocumentFollowUp(question) {
    if (!question || !lastAnalyzedDocuments || lastAnalyzedDocuments.length === 0) {
        return;
    }
    
    // Add user question to chat
    addMessageToChat(question, 'user', true);
    showTypingIndicator();
    
    try {
        // Build document context from last analyzed documents (like image context)
        let documentContext = '';
        let documentNames = [];
        
        lastAnalyzedDocuments.forEach((extraction, index) => {
            if (extraction.text) {
                documentNames.push(extraction.filename);
                if (lastAnalyzedDocuments.length > 1) {
                    documentContext += `\n\nDocument ${index + 1} (${extraction.filename}):\n${extraction.text}`;
                } else {
                    documentContext += extraction.text;
                }
            }
        });
        
        // Create context message for Gemini (same pattern as image follow-up)
        const contextMessage = `Previously analyzed documents: ${documentNames.join(', ')}\n\nDocument content:\n${documentContext}\n\nUser's follow-up question: "${question}"\n\nPlease answer based on the document content in their language.`;
        
        // Send to chat API (same as image follow-up)
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: contextMessage,
                userQuery: question,
                documentContext: true,
                documentCount: lastAnalyzedDocuments.length
            })
        });
        
        const data = await response.json();
        hideTypingIndicator();
        
        if (response.ok && data.success) {
            addMessageToChat(data.response, 'assistant', true);
        } else {
            addMessageToChat('Failed to get response: ' + (data.error || 'Unknown error'), 'assistant', true);
        }
    } catch (error) {
        hideTypingIndicator();
        console.error('Document follow-up error:', error);
        addMessageToChat('Error processing your question. Please try again.', 'assistant', true);
    }
}

// Helper function to show document extraction summary
function showDocumentExtractionSummary(extractions) {
    const t = window.APP_TRANSLATIONS || {};
    const lang = window.APP_LANG || 'en';
    
    let responseText = '';
    
    if (lang === 'hi') {
        responseText = '**दस्तावेज़ सफलतापूर्वक प्रोसेस किए गए**:\\n\\n';
    } else if (lang === 'mr') {
        responseText = '**दस्तऐवज यशस्वीरित्या प्रक्रिया केले**:\\n\\n';
    } else {
        responseText = '**Documents Processed Successfully**:\\n\\n';
    }
    
    extractions.forEach((extraction, index) => {
        if (extraction.text) {
            const wordCount = extraction.text.split(/\\s+/).length;
            responseText += `**${extraction.filename}**\\n`;
            responseText += `  ${wordCount} ${lang === 'hi' ? 'शब्द निकाले गए' : lang === 'mr' ? 'शब्द काढले' : 'words extracted'}\\n`;
            
            // Show first 200 characters as preview
            const preview = extraction.text.substring(0, 200).trim();
            responseText += `  ${lang === 'hi' ? 'पूर्वावलोकन' : lang === 'mr' ? 'पूर्वावलोकन' : 'Preview'}: \"${preview}...\"\\n\\n`;
        } else if (extraction.error) {
            responseText += `**${extraction.filename}**: ${extraction.error}\\n\\n`;
        }
    });
    
    if (lang === 'hi') {
        responseText += '\\n**प्रश्न पूछें**: इन दस्तावेज़ों के बारे में कोई भी प्रश्न पूछें!';
    } else if (lang === 'mr') {
        responseText += '\\n**प्रश्न विचारा**: या दस्तऐवजांबद्दल कोणताही प्रश्न विचारा!';
    } else {
        responseText += '\\n**Ask Questions**: Feel free to ask anything about these documents!';
    }
    
    addMessageToChat(responseText, 'assistant', true);
}

// Handle questions about uploaded document (old single-document function - keep for compatibility)
async function handleDocumentQuestion(question) {
    // Add user question to chat
    addMessageToChat(question, 'user', true);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Send question with document context to backend
        const response = await fetch('/api/document/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                document_text: window.currentDocumentText,
                question: question,
                language: 'en' // You can get this from user settings
            })
        });
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (response.ok && data.success) {
            // Add AI response about the document
            const responseWithContext = `**About "${window.currentDocumentName}":**\n\n${data.response}`;
            addMessageToChat(responseWithContext, 'assistant', true);
        } else {
            addMessageToChat('Sorry, I couldn\'t analyze the document. Please try again.', 'assistant', true);
        }
    } catch (error) {
        console.error('Error asking about document:', error);
        hideTypingIndicator();
        addMessageToChat('Sorry, I couldn\'t connect to the server. Please check your internet connection.', 'assistant', true);
    }
}

// Handle images with optional text message
async function handleImagesWithText(textMessage) {
    if (typeof selectedImages === 'undefined' || selectedImages.length === 0) {
        return;
    }
    
    // Create user message with images and text
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'self-end max-w-2xl mb-4';
    
    let html = '<div class="bg-accent text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">';
    
    // Add images in a grid
    if (selectedImages.length > 0) {
        html += '<div class="grid gap-2 mb-2 ' + (selectedImages.length === 1 ? 'grid-cols-1' : selectedImages.length === 2 ? 'grid-cols-2' : 'grid-cols-3') + '">';
        selectedImages.forEach(img => {
            html += `<img src="${img.dataUrl}" alt="${img.name}" class="w-full h-auto rounded-lg border-2 border-white/20">`;
        });
        html += '</div>';
    }
    
    // Add text message if provided
    if (textMessage) {
        html += `<div class="whitespace-pre-wrap mt-2">${escapeHtml(textMessage)}</div>`;
    }
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    html += `<div class="text-xs text-accent-100 mt-1 opacity-75">${timestamp}</div>`;
    html += '</div>';
    
    messageDiv.innerHTML = html;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Show typing indicator
    showTypingIndicator();
    
    // Store images locally for processing (important!)
    const imagesToProcess = [...selectedImages];
    
    // Clear images after sending to prevent re-sending with next query
    // User can upload again if they want to analyze more images
    selectedImages = [];
    updateImagePreviewArea();
    
    // Process each image
    try {
        const allPredictions = [];
        
        for (let i = 0; i < imagesToProcess.length; i++) {
            const img = imagesToProcess[i];
            const formData = new FormData();
            formData.append('file', img.file);
            
            const response = await fetch('/api/predict', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                allPredictions.push({
                    filename: img.name,
                    predictions: data.predictions || []
                });
            } else {
                allPredictions.push({
                    filename: img.name,
                    error: data.error || 'Analysis failed'
                });
            }
        }
        
        // If user provided a text question, send predictions + question to chat API (Gemini)
        if (textMessage && textMessage.trim()) {
            // Store image analysis context for follow-up questions
            lastAnalyzedImages = allPredictions;
            
            // Build disease detection summary for Gemini context
            let diseaseContext = '';
            let diseaseList = [];
            
            allPredictions.forEach((result, index) => {
                if (result.predictions && result.predictions.length > 0) {
                    const topPrediction = result.predictions[0];
                    diseaseList.push(topPrediction.label);
                    
                    if (imagesToProcess.length > 1) {
                        diseaseContext += `Image ${index + 1}: ${topPrediction.label} (${(topPrediction.confidence * 100).toFixed(1)}% confidence)\n`;
                    } else {
                        diseaseContext += `Detected: ${topPrediction.label} (${(topPrediction.confidence * 100).toFixed(1)}% confidence)\n`;
                    }
                }
            });
            
            // Create context message for Gemini
            const contextMessage = `I have analyzed ${imagesToProcess.length} plant image(s) using ML model and detected: ${diseaseContext}\n\nThe user is asking: "${textMessage}"\n\nPlease provide a helpful response about the detected disease(s) and answer their question in their language.`;
            
            // Send to chat API (will use Gemini)
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: contextMessage,
                    userQuery: textMessage,
                    detectedDiseases: diseaseList,
                    imageCount: imagesToProcess.length
                })
            });
            
            const chatData = await chatResponse.json();
            hideTypingIndicator();
            
            if (chatResponse.ok && chatData.success) {
                // Show disease detection first, then Gemini's response
                const t = window.APP_TRANSLATIONS || {};
                const lang = window.APP_LANG || 'en';
                
                let fullResponse = '';
                
                // ML Model Detection Results (compact format)
                if (lang === 'hi') {
                    fullResponse = '**एमएल मॉडल पहचान**:\n';
                } else if (lang === 'mr') {
                    fullResponse = '**एमएल मॉडेल ओळख**:\n';
                } else if (lang === 'pa') {
                    fullResponse = '**ਐਮਐਲ ਮਾਡਲ ਪਛਾਣ**:\n';
                } else if (lang === 'ml') {
                    fullResponse = '**എംഎൽ മോഡൽ തിരിച്ചറിയൽ**:\n';
                } else {
                    fullResponse = '**ML Model Detection**:\n';
                }
                
                // Add compact detection results
                allPredictions.forEach((result, index) => {
                    if (result.predictions && result.predictions.length > 0) {
                        const topPred = result.predictions[0];
                        const emoji = getPlantEmoji(topPred.label);
                        const formattedName = formatDiseaseName(topPred.label);
                        
                        if (imagesToProcess.length > 1) {
                            fullResponse += `${index + 1}. ${emoji} ${formattedName} (${(topPred.confidence * 100).toFixed(0)}%)\n`;
                        } else {
                            fullResponse += `${emoji} ${formattedName} (${(topPred.confidence * 100).toFixed(0)}% ${lang === 'hi' ? 'आत्मविश्वास' : 'confidence'})\n`;
                        }
                        
                        // Add warning if confidence is low
                        if (topPred.confidence < 0.7) {
                            const warningMsg = lang === 'hi' ? '\nकम विश्वास - बेहतर तस्वीर अपलोड करें' :
                                              lang === 'mr' ? '\nकमी आत्मविश्वास - चांगली प्रतिमा अपलोड करा' :
                                              lang === 'pa' ? '\nਘੱਟ ਭਰੋਸਾ - ਵਧੀਆ ਤਸਵੀਰ ਅਪਲੋਡ ਕਰੋ' :
                                              lang === 'ml' ? '\nകുറഞ്ഞ ആത്മവിശ്വാസം - മികച്ച ചിത്രം അപ്‌ലോഡ് ചെയ്യുക' :
                                              '\nLow confidence - consider uploading a clearer image';
                            fullResponse += warningMsg + '\n';
                        }
                    }
                });
                
                // Add separator and Gemini's expert response
                fullResponse += '\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
                fullResponse += chatData.response;
                
                addMessageToChat(fullResponse, 'assistant', true);
            } else {
                // Fallback to showing just predictions
                showPredictionResults(allPredictions, textMessage);
            }
        } else {
            // No text question - just show predictions and store context
            lastAnalyzedImages = allPredictions;
            hideTypingIndicator();
            showPredictionResults(allPredictions, null);
        }
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error processing images:', error);
        addMessageToChat('Sorry, I could not process the images. Please try again.', 'assistant', true);
    }
}

// Handle follow-up questions about previously analyzed images (ChatGPT-style)
async function handleFollowUpQuestion(textMessage) {
    if (!textMessage || lastAnalyzedImages.length === 0) {
        return;
    }
    
    // Add user's follow-up question to chat
    addMessageToChat(textMessage, 'user', true);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Build disease detection summary from previous analysis
        let diseaseContext = '';
        let diseaseList = [];
        
        lastAnalyzedImages.forEach((result, index) => {
            if (result.predictions && result.predictions.length > 0) {
                const topPrediction = result.predictions[0];
                diseaseList.push(topPrediction.label);
                
                if (lastAnalyzedImages.length > 1) {
                    diseaseContext += `Image ${index + 1}: ${topPrediction.label} (${(topPrediction.confidence * 100).toFixed(1)}% confidence)\n`;
                } else {
                    diseaseContext += `Detected: ${topPrediction.label} (${(topPrediction.confidence * 100).toFixed(1)}% confidence)\n`;
                }
            }
        });
        
        // Create context message for Gemini
        const contextMessage = `I previously analyzed ${lastAnalyzedImages.length} plant image(s) and detected: ${diseaseContext}\n\nThe user is now asking a follow-up question: "${textMessage}"\n\nPlease provide a helpful response about the detected disease(s) and answer their question in their language.`;
        
        // Send to chat API (will use Gemini)
        const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: contextMessage,
                userQuery: textMessage,
                detectedDiseases: diseaseList,
                imageCount: lastAnalyzedImages.length
            })
        });
        
        const chatData = await chatResponse.json();
        hideTypingIndicator();
        
        if (chatResponse.ok && chatData.success) {
            addMessageToChat(chatData.response, 'assistant', true);
        } else {
            addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
        }
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error handling follow-up question:', error);
        addMessageToChat('Sorry, I could not process your question. Please try again.', 'assistant', true);
    }
}

// Helper function to display prediction results
function showPredictionResults(allPredictions, userQuestion) {
    const t = window.APP_TRANSLATIONS || {};
    const lang = window.APP_LANG || 'en';
    
    let responseText = '';
    
    // Disease detection header in user's language
    if (lang === 'hi') {
        responseText = 'पौधों की बीमारी की पहचान:\n\n';
    } else if (lang === 'mr') {
        responseText = 'रोग ओळख:\n\n';
    } else if (lang === 'pa') {
        responseText = 'ਰੋਗ ਪਛਾਣ:\n\n';
    } else if (lang === 'ml') {
        responseText = 'രോഗ തിരിച്ചറിയൽ:\n\n';
    } else {
        responseText = 'Plant Disease Detection:\n\n';
    }
    
    allPredictions.forEach((result, index) => {
        if (allPredictions.length > 1) {
            responseText += `� ${lang === 'hi' ? 'छवि' : lang === 'mr' ? 'प्रतिमा' : lang === 'pa' ? 'ਚਿੱਤਰ' : 'Image'} ${index + 1}:\n`;
        }
        
        if (result.error) {
            responseText += `${result.error}\n\n`;
        } else if (result.predictions.length === 0) {
            if (lang === 'hi') {
                responseText += 'बीमारी की पहचान नहीं हो सकी। कृपया स्पष्ट चित्र अपलोड करें।\n\n';
            } else {
                responseText += 'Could not identify disease. Please upload a clearer image.\n\n';
            }
        } else {
            result.predictions.forEach((pred, idx) => {
                const icon = idx === 0 ? '1.' : '•';
                const emoji = getPlantEmoji(pred.label);
                const formattedName = formatDiseaseName(pred.label);
                responseText += `${icon} ${emoji} ${formattedName} — ${(pred.confidence * 100).toFixed(1)}%\n`;
                
                // Add warning for low confidence on top prediction
                if (idx === 0 && pred.confidence < 0.7) {
                    const warningMsg = lang === 'hi' ? '  कम विश्वास - बेहतर तस्वीर की सिफारिश' :
                                      lang === 'mr' ? '  कमी आत्मविश्वास - चांगली प्रतिमा शिफारस' :
                                      lang === 'pa' ? '  ਘੱਟ ਭਰੋਸਾ - ਵਧੀਆ ਤਸਵੀਰ ਦੀ ਸਿਫ਼ਾਰਿਸ਼' :
                                      lang === 'ml' ? '  ⚠️ കുറഞ്ഞ ആത്മവിശ്വാസം - മികച്ച ചിത്രം ശുപാർശ' :
                                      '  Low confidence - better image recommended';
                    responseText += warningMsg + '\n';
                }
            });
            responseText += '\n';
        }
    });
    
    // Add generic advice if no user question
    if (!userQuestion) {
        if (lang === 'hi') {
            responseText += '\nअधिक जानकारी के लिए, कृपया अपना प्रश्न पूछें।';
        } else {
            responseText += '\nFor more information, please ask your question.';
        }
    }
    
    addMessageToChat(responseText, 'assistant', true);
}

// Add message to chat area with enhanced styling
function addMessageToChat(message, sender, animate = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (sender === 'user') {
        messageDiv.className = 'self-end max-w-2xl mb-4 group';
        messageDiv.setAttribute('data-message-id', messageId);
        messageDiv.innerHTML = `
            <div class="relative bg-accent text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
                <button class="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600" 
                        onclick="deleteMessage('${messageId}')" 
                        title="Delete message">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <div class="whitespace-pre-wrap">${escapeHtml(message)}</div>
                <div class="text-xs text-accent-100 mt-1 opacity-75">${timestamp}</div>
            </div>
        `;
    } else {
        messageDiv.className = 'self-start max-w-2xl mb-4 group';
        messageDiv.setAttribute('data-message-id', messageId);
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3 relative">
                <button class="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10" 
                        onclick="deleteMessage('${messageId}')" 
                        title="Delete message">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <div class="h-8 w-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                    <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <div class="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-slate-200">
                        <div class="whitespace-pre-wrap text-slate-700">${escapeHtml(message)}</div>
                        <div class="text-xs text-slate-500 mt-1">${timestamp}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (animate) {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(10px)';
    }
    
    chatMessages.appendChild(messageDiv);
    
    if (animate) {
        // Animate message appearance
        setTimeout(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 10);
    }
    
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    if (document.getElementById('typingIndicator')) return;
    
    isTyping = true;
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'self-start max-w-2xl mb-4';
    typingDiv.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="h-8 w-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
            </div>
            <div class="flex-1">
                <div class="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-slate-200">
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                        <span class="ml-2 text-sm text-slate-500">${(window.APP_TRANSLATIONS && window.APP_TRANSLATIONS.ai_thinking) || 'KrishiSujhav is thinking...'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
    isTyping = false;
}

// Scroll to bottom of chat
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Clear chat history
async function clearChatHistory() {
    if (!confirm('Are you sure you want to clear your chat history? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/chat/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            chatHistory = [];
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            addWelcomeMessage();
        }
    } catch (error) {
        console.error('Error clearing chat history:', error);
    }
}

// Delete individual message function
function deleteMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    
    if (messageDiv) {
        // Fade out animation
        messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateX(-20px)';
        
        // Remove after animation
        setTimeout(() => {
            messageDiv.remove();
            
            // Check if chat is empty and show welcome message
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages.children.length === 0) {
                addWelcomeMessage();
            }
        }, 300);
    }
}

// Export chat history function
function exportChatHistory() {
    if (chatHistory.length === 0) {
        alert('No chat history to export');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalMessages: chatHistory.length,
        conversations: chatHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farming-chat-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for chat input
    const chatInput = document.getElementById('chatInput');
    const chatForm = document.getElementById('chatForm');
    
    if (chatForm) {
        // Handle form submission
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleChatInput();
        });
    }
    
    if (chatInput) {
        // Handle Enter key in input
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatInput();
            }
        });
        
        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
    
    // Settings button functionality
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            // Create settings menu
            const menu = document.createElement('div');
            menu.className = 'absolute top-12 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-10 settings-menu';
            menu.innerHTML = `
                <button onclick="clearChatHistory()" class="block w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700">
                    Clear Chat History
                </button>
                <button onclick="exportChatHistory()" class="block w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700">
                    Export Chat History
                </button>
            `;
            
            // Remove existing menu
            const existingMenu = document.querySelector('.settings-menu');
            if (existingMenu) existingMenu.remove();
            
            // Add new menu
            this.parentElement.style.position = 'relative';
            this.parentElement.appendChild(menu);
            
            // Close menu when clicking outside
            setTimeout(() => {
                document.addEventListener('click', function closeMenu(e) {
                    if (!menu.contains(e.target) && e.target !== settingsBtn) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }, 10);
        });
    }
});