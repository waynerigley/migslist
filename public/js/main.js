// MigsList Client-side JavaScript

// Auto-dismiss alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  const alerts = document.querySelectorAll('.alert');
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
