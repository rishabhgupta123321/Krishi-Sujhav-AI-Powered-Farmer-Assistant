// Login form functionality and validation for Farmer Assistant

// Login form validation and submission handling
function initializeLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function(e) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      e.preventDefault();
      alert('Please enter both email and password');
    }
  });
}

// Initialize login page functionality
function initializeLoginPage() {
  initializeLoginForm();
}