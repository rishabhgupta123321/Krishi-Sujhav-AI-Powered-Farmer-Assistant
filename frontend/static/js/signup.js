// Signup form functionality and validation for Farmer Assistant
// Terms and Conditions modal management
// Translation is handled by the unified language.js system

// Form validation and submission handling
function initializeSignupForm() {
  // Client-side validation (server-side validation is primary)
  document.getElementById('signupForm').addEventListener('submit', function(e) {
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const languagePreference = document.getElementById('languagePreference').value;
    const termsAccepted = document.getElementById('terms').checked;
    
    // Validate required fields
    if (!fullName || !email || !password || !languagePreference || !termsAccepted) {
      e.preventDefault();
      alert('Please fill in all required fields and accept the terms of service');
      return;
    }
    
    // Validate password match
    if (password !== confirmPassword) {
      e.preventDefault();
      alert('Passwords do not match');
      return;
    }
  });

  // Password confirmation validation
  document.getElementById('confirmPassword').addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const confirmPassword = this.value;
    
    if (password !== confirmPassword) {
      this.setCustomValidity('Passwords do not match');
    } else {
      this.setCustomValidity('');
    }
  });
}

// Terms and Conditions modal functionality
function initializeTermsModal() {
  const openTerms = document.getElementById('openTermsModal');
  const openPrivacy = document.getElementById('openPrivacyModal');
  const termsModal = document.getElementById('termsModal');
  const closeTerms = document.getElementById('closeTermsModal');
  const declineTerms = document.getElementById('declineTerms');
  const acceptTerms = document.getElementById('acceptTerms');

  if (openTerms) {
    openTerms.addEventListener('click', function(e) {
      e.preventDefault();
      if (termsModal) termsModal.classList.remove('hidden');
    });
  }

  if (openPrivacy) {
    openPrivacy.addEventListener('click', function(e) {
      e.preventDefault();
      if (termsModal) termsModal.classList.remove('hidden');
    });
  }

  if (closeTerms) {
    closeTerms.addEventListener('click', function() {
      if (termsModal) termsModal.classList.add('hidden');
    });
  }

  if (declineTerms) {
    declineTerms.addEventListener('click', function() {
      document.getElementById('terms').checked = false;
      if (termsModal) termsModal.classList.add('hidden');
    });
  }

  if (acceptTerms) {
    acceptTerms.addEventListener('click', function() {
      document.getElementById('terms').checked = true;
      if (termsModal) termsModal.classList.add('hidden');
    });
  }

  if (termsModal) {
    termsModal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.add('hidden');
      }
    });
  }
}

// Initialize all signup functionality
function initializeSignupPage() {
  initializeSignupForm();
  initializeTermsModal();
}