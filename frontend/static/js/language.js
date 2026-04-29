// Language switching functionality for Farmer Assistant Chat
// Load translations
let allTranslations = {};

// Global language change function
async function changeGlobalLanguage(language) {
  // Always use 2-letter codes for backend consistency
  const codeMap = {'english': 'en', 'hindi': 'hi', 'marathi': 'mr', 'punjabi': 'pa', 'malayalam': 'ml', 'tamil': 'ta', 'telugu': 'te', 'kannada': 'kn'};
  const langCode = codeMap[language] || language; // normalize to 2-letter
  
  try {
    // Change language in backend using 2-letter code
    const response = await fetch(`/change-language/${langCode}`);
    
    if (response.ok) {
      // Update entire UI with new language
      updateUILanguage(langCode);
      
      // Store language preference
      localStorage.setItem('preferredLanguage', langCode);
      window.APP_LANG = langCode;
      
      console.log('Language changed to:', langCode);
    } else {
      console.error('Failed to change language');
    }
  } catch (error) {
    console.error('Error changing language:', error);
  }
}

// Load translations from server or use cached
async function loadTranslations() {
  try {
    const response = await fetch('/translations/translations.json');
    if (response.ok) {
      allTranslations = await response.json();
      console.log('Translations loaded');
    }
  } catch (error) {
    console.error('Failed to load translations:', error);
  }
}

// Update all UI elements based on language
function updateUILanguage(language) {
  const t = allTranslations[language] || allTranslations['en'] || {};
  
  // Update document title
  document.title = t.site_title || 'Farmer Assistant';
  
  // Update page title and subtitle
  const titleElement = document.querySelector('h1.font-semibold.text-slate-900');
  if (titleElement) {
    titleElement.textContent = t.chat_title || 'Farmer Assistant';
  }
  
  const subtitleElement = document.querySelector('p.text-sm.text-slate-500');
  if (subtitleElement && (subtitleElement.textContent.includes('AI-powered') || subtitleElement.textContent.includes('AI-संचालित') || subtitleElement.textContent.includes('AI-चालित') || subtitleElement.textContent.includes('AI-ਸੰਚਾਲਿਤ') || subtitleElement.textContent.includes('AI-പവർഡ്'))) {
    subtitleElement.textContent = t.chat_subtitle || 'AI-powered farming guidance';
  }
  
  // Update input placeholder
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = t.chat_placeholder || 'Ask about crops, soil, or market prices...';
  }
  
  // Update sidebar header
  const sidebarHeader = document.querySelector('aside header span');
  if (sidebarHeader && sidebarHeader.textContent.includes('Chat')) {
    sidebarHeader.textContent = t.chat_history || 'Chat History';
  }
  
  // Update buttons with titles
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.title = t.new_chat || 'New Chat';
  }
  
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  if (closeSidebarBtn) {
    closeSidebarBtn.title = t.close_sidebar || 'Close Sidebar';
  }
  
  // Update "No previous chats" message
  const noPrevChats = document.querySelector('#chatHistoryList .text-slate-400');
  if (noPrevChats && (noPrevChats.textContent.includes('No previous') || noPrevChats.textContent.includes('कोई पिछली') || noPrevChats.textContent.includes('कोणतीही मागील') || noPrevChats.textContent.includes('ਕੋਈ ਪਿਛਲੀ') || noPrevChats.textContent.includes('മുൻ ചാറ്റുകളൊന്നുമില്ല'))) {
    noPrevChats.textContent = t.no_previous_chats || 'No previous chats';
  }
  
  // Update "Logged in as" text
  const loggedInText = document.querySelector('.text-xs.text-slate-500');
  if (loggedInText && (loggedInText.textContent.includes('Logged in') || loggedInText.textContent.includes('के रूप में') || loggedInText.textContent.includes('म्हणून') || loggedInText.textContent.includes('ਦੇ ਤੌਰ') || loggedInText.textContent.includes('ആയി'))) {
    loggedInText.textContent = t.logged_in_as || 'Logged in as';
  }
  
  // Update user greeting
  const userGreeting = document.getElementById('userGreeting');
  if (userGreeting) {
    const hasUsername = userGreeting.textContent.includes('Welcome') || userGreeting.textContent.includes('स्वागत') || userGreeting.textContent.includes('स्वागत') || userGreeting.textContent.includes('ਜੀ ਆਇਆਂ') || userGreeting.textContent.includes('സ്വാഗതം');
    if (hasUsername && !userGreeting.textContent.includes('login')) {
      // Extract username - try to find text between comma and exclamation
      const parts = userGreeting.textContent.split(',');
      if (parts.length > 1) {
        const username = parts[1].split('!')[0].trim();
        if (username) {
          userGreeting.textContent = `${t.welcome_user || 'Welcome'}, ${username}!`;
        }
      }
    } else if (userGreeting.textContent.includes('login') || userGreeting.textContent.includes('लॉगिन') || userGreeting.textContent.includes('लॉगिन') || userGreeting.textContent.includes('ਲਾਗਇਨ') || userGreeting.textContent.includes('ലോഗിൻ')) {
      userGreeting.textContent = t.login_prompt || 'Welcome! Please login to chat';
    }
  }
  
  // Update weather labels
  const weatherLabelTemp = document.querySelector('.weather-label-temp');
  if (weatherLabelTemp) {
    weatherLabelTemp.innerHTML = `🌡️ ${t.temperature || 'Temperature'}`;
  }
  
  const weatherLabelHumidity = document.querySelector('.weather-label-humidity');
  if (weatherLabelHumidity) {
    weatherLabelHumidity.innerHTML = `💧 ${t.humidity || 'Humidity'}`;
  }
  
  const weatherLabelWind = document.querySelector('.weather-label-wind');
  if (weatherLabelWind) {
    weatherLabelWind.innerHTML = `💨 ${t.wind_speed || 'Wind Speed'}`;
  }
  
  // Update "Loading..." text
  const loadingTexts = document.querySelectorAll('[class*="Loading"]');
  loadingTexts.forEach(el => {
    if (el.textContent === 'Loading...' || el.textContent.includes('लोड') || el.textContent.includes('लोड') || el.textContent.includes('ਲੋਡ') || el.textContent.includes('ലോഡ്')) {
      el.textContent = t.loading || 'Loading...';
    }
  });
  
  // Update camera modal
  const cameraModalTitle = document.querySelector('.camera-modal-title');
  if (cameraModalTitle) {
    cameraModalTitle.textContent = t.take_photo || 'Take Photo';
  }
  
  const captureBtn = document.querySelector('.capture-btn');
  if (captureBtn) {
    captureBtn.textContent = t.capture || 'Capture';
  }
  
  // Update login/signup buttons
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.textContent = t.login_button || 'Login';
  }
  
  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) {
    signupBtn.textContent = t.signup_button || 'Sign Up';
  }
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.textContent = t.logout || 'Logout';
  }
  
  // Update all data-i18n elements (profile dropdown, sidebar, etc.)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  // Store translations for later use in dynamic content
  window.currentLanguageData = {
    typing: t.ai_thinking || 'AI is thinking...',
    welcome: t.welcome_message || 'Welcome to Farmer Assistant!',
    placeholder: t.chat_placeholder,
    uploading: t.uploading || 'Uploading...',
    processing: t.processing || 'Processing...',
    send: t.send || 'Send',
    remove: t.remove || 'Remove',
    cancel: t.cancel || 'Cancel',
    capture: t.capture || 'Capture',
    attachImage: t.attach_image || 'Attach Image',
    attachDocument: t.attach_document || 'Attach Document',
    sendMessage: t.send_message || 'Send Message',
    selectedFiles: t.selected_files || 'Selected files'
  };
  
  // Store current language
  window.APP_LANG = language;
  window.APP_TRANSLATIONS = t;
  
  // Re-render welcome block if it exists (so language change updates it)
  const existingWelcome = document.getElementById('welcomeBlock');
  if (existingWelcome && typeof addWelcomeMessage === 'function') {
    existingWelcome.remove();
    addWelcomeMessage();
  }
  
  console.log('UI updated for language:', language);
}

// Initialize language selector — works on ANY page
async function initializeLanguageSelector() {
  // Load translations first
  await loadTranslations();
  
  // Try multiple possible selector IDs across pages
  const languageSelector = document.getElementById('languageSelector') || document.getElementById('pageLangSelector') || document.getElementById('languagePreference');
  
  // Get saved language from localStorage or server
  const savedLanguage = localStorage.getItem('preferredLanguage') || (languageSelector ? languageSelector.value : null) || 'en';
  
  // Normalize saved lang (could be full name from old signup)
  const codeMap = {'english': 'en', 'hindi': 'hi', 'marathi': 'mr', 'punjabi': 'pa', 'malayalam': 'ml', 'tamil': 'ta', 'telugu': 'te', 'kannada': 'kn'};
  const normalizedLang = codeMap[savedLanguage] || savedLanguage;
  
  if (languageSelector) {
    // Update selector if different from saved
    if (languageSelector.value !== normalizedLang) {
      languageSelector.value = normalizedLang;
    }
    
    // Listen for language changes
    languageSelector.addEventListener('change', function() {
      changeGlobalLanguage(this.value);
    });
  }
  
  // Apply translations immediately for saved language on ALL pages
  if (allTranslations[normalizedLang]) {
    updateUILanguage(normalizedLang);
  }
  
  window.APP_LANG = normalizedLang;
  console.log('Language initialized:', normalizedLang);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLanguageSelector);
} else {
  initializeLanguageSelector();
}