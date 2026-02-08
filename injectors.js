/**
 * injectors.js — Monetization & analytics integration hooks.
 *
 * Reads config.json and conditionally injects:
 *   1. Google AdSense (auto-ads + manual ad slots)
 *   2. Google Analytics 4 (GA4) measurement tag
 *
 * All hooks are disabled by default via config.json flags.
 * To activate, set the relevant flag to true and provide valid IDs.
 */
(function () {
  'use strict';

  var CONFIG_URL = '/config.json';

  /**
   * Inject the Google AdSense script and activate ad slots on the page.
   */
  function injectAdSense(ids) {
    var publisherId = ids.adsense_publisher_id;
    if (!publisherId) return;

    // Load the AdSense auto-ads script
    var script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + publisherId;
    document.head.appendChild(script);

    // Activate any ad-slot divs already on the page
    var adSlotId = ids.adsense_ad_slot_id || '';
    var slots = document.querySelectorAll('.ad-slot');
    slots.forEach(function (slot) {
      if (slot.dataset.adActivated) return;
      slot.dataset.adActivated = 'true';

      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', publisherId);
      if (adSlotId) {
        ins.setAttribute('data-ad-slot', adSlotId);
      }
      ins.setAttribute('data-ad-format', slot.dataset.adFormat || 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slot.appendChild(ins);

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // AdSense not ready yet — auto-ads script will handle it
      }
    });
  }

  /**
   * Inject the Google Analytics 4 measurement tag.
   */
  function injectGA4(ids) {
    var measurementId = ids.ga4_measurement_id;
    if (!measurementId) return;

    // Load the gtag.js script
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);

    // Initialize the dataLayer and configure the tag
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', measurementId);
  }

  /**
   * Load config.json and conditionally activate enabled hooks.
   */
  function init() {
    fetch(CONFIG_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Config load failed');
        return res.json();
      })
      .then(function (config) {
        var features = config.features || {};
        var ids = config.ids || {};

        if (features.adsense_enabled) {
          injectAdSense(ids);
        }

        if (features.ga4_enabled) {
          injectGA4(ids);
        }
      })
      .catch(function (err) {
        // Silently fail — monetization is non-critical
        console.warn('Injectors: config load error', err.message);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
