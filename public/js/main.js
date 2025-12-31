// MigsList Client-side JavaScript

// Theme Toggle
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load saved theme on page load
(function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// Auto-dismiss success/error alerts after 5 seconds (but NOT tips/info)
document.addEventListener('DOMContentLoaded', function() {
  const alerts = document.querySelectorAll('.alert-success, .alert-error');
  alerts.forEach(function(alert) {
    setTimeout(function() {
      alert.style.transition = 'opacity 0.3s';
      alert.style.opacity = '0';
      setTimeout(function() {
        alert.remove();
      }, 300);
    }, 5000);
  });
});

// Confirm delete actions
document.querySelectorAll('[data-confirm]').forEach(function(element) {
  element.addEventListener('click', function(e) {
    if (!confirm(this.dataset.confirm)) {
      e.preventDefault();
    }
  });
});

// File input preview
document.querySelectorAll('input[type="file"]').forEach(function(input) {
  input.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
      const label = this.parentElement.querySelector('.file-name');
      if (label) {
        label.textContent = file.name;
      }
    }
  });
});
