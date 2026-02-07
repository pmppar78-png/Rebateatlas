/**
 * partners.js — Dynamically renders the partner section from affiliates.json.
 * Single source of truth: /affiliates.json
 */
(function () {
  'use strict';

  var AFFILIATES_URL = '/affiliates.json';
  var CATEGORY_ORDER = ['solar_quotes', 'home_services', 'energy_devices', 'retail', 'financing'];

  function createPartnerGrid(category) {
    var section = document.createDocumentFragment();

    var heading = document.createElement('h3');
    heading.className = 'partners-category-heading';
    heading.textContent = category.label;
    section.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'partner-grid';

    category.partners.forEach(function (partner) {
      var link = document.createElement('a');
      link.href = partner.url;
      link.className = 'partner-link';
      link.target = '_blank';
      link.rel = 'sponsored noopener';

      var strong = document.createElement('strong');
      strong.textContent = partner.name;
      link.appendChild(strong);

      var span = document.createElement('span');
      span.textContent = partner.description;
      link.appendChild(span);

      grid.appendChild(link);
    });

    section.appendChild(grid);
    return section;
  }

  function renderPartners(data) {
    var container = document.getElementById('partners-container');
    if (!container) return;

    CATEGORY_ORDER.forEach(function (key) {
      var category = data[key];
      if (!category || !category.partners) return;
      container.appendChild(createPartnerGrid(category));
    });
  }

  function init() {
    fetch(AFFILIATES_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load affiliates.json');
        return res.json();
      })
      .then(renderPartners)
      .catch(function (err) {
        console.warn('Partners load error:', err.message);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
