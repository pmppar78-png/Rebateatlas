/**
 * forms.js — Handles ZIP code form submissions across all pages.
 * Replaces inline onsubmit handlers to allow strict CSP (no unsafe-inline).
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Handle all ZIP forms via event delegation
    var zipForms = document.querySelectorAll('.zip-form');
    zipForms.forEach(function (form) {
      // Remove inline onsubmit if present
      form.removeAttribute('onsubmit');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input[type="text"]');
        if (!input) return;
        var zip = input.value.trim();
        if (!/^\d{5}$/.test(zip)) {
          alert('Please enter a valid 5-digit ZIP code.');
          return;
        }

        // Check for state parameter in hidden input or data attribute
        var stateInput = form.querySelector('input[name="state"]');
        var state = stateInput ? stateInput.value : (form.dataset.state || '');

        var url = '/chat.html?zip=' + encodeURIComponent(zip);
        if (state) {
          url += '&state=' + encodeURIComponent(state);
        }

        // Check for home type select
        var homeSelect = form.querySelector('#home-type');
        if (homeSelect && homeSelect.value) {
          url += '&home=' + encodeURIComponent(homeSelect.value);
        }

        window.location.href = url;
      });
    });

    // Savings calculator (homepage only)
    var checkboxes = document.querySelectorAll('.calc-option input[type="checkbox"]');
    var resultsEl = document.getElementById('calc-results');
    var federalEl = document.getElementById('calc-federal');
    var stateEl = document.getElementById('calc-state');
    var totalEl = document.getElementById('calc-total');

    if (checkboxes.length > 0 && resultsEl) {
      function updateCalc() {
        var federal = 0;
        var state = 0;
        checkboxes.forEach(function (cb) {
          if (cb.checked) {
            federal += parseInt(cb.dataset.federal, 10) || 0;
            state += parseInt(cb.dataset.state, 10) || 0;
          }
        });
        if (federal > 0 || state > 0) {
          resultsEl.style.display = 'block';
          federalEl.textContent = '$' + federal.toLocaleString();
          stateEl.textContent = '$' + state.toLocaleString();
          totalEl.textContent = '$' + (federal + state).toLocaleString();
        } else {
          resultsEl.style.display = 'none';
        }
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', updateCalc);
      });
    }
  });
})();
