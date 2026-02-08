// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Mobile nav toggle — side drawer with overlay and scroll lock
  const siteNav = document.getElementById('site-nav');
  const navOverlay = document.getElementById('nav-overlay');
  const navClose = document.getElementById('nav-close');
  let navToggle = document.getElementById('nav-toggle');

  // ── Escape header stacking context on mobile ──
  // The .site-header uses position: sticky + z-index which creates a stacking
  // context.  A position: fixed child inside that context can end up rendered
  // behind or on top of content incorrectly.  Moving the nav and overlay to
  // <body> root level lets them use the viewport stacking context instead.
  const siteHeader = siteNav ? siteNav.closest('.site-header') : null;
  const mobileMediaQuery = window.matchMedia('(max-width: 640px)');

  const repositionNav = () => {
    if (!siteNav) return;
    if (mobileMediaQuery.matches) {
      // Move to body for correct fixed stacking
      document.body.appendChild(siteNav);
      if (navOverlay) document.body.appendChild(navOverlay);
    } else if (siteHeader && siteNav.parentNode !== siteHeader) {
      // Move back into header for desktop layout
      const toggleBtn = siteHeader.querySelector('.nav-toggle') || siteHeader.querySelector('#nav-toggle');
      if (toggleBtn) {
        siteHeader.insertBefore(siteNav, toggleBtn);
      } else {
        siteHeader.appendChild(siteNav);
      }
    }
  };

  repositionNav();
  mobileMediaQuery.addEventListener('change', repositionNav);

  // ── Defend against injected snippet drawers ──
  // Some Netlify snippets inject their own drawer (ra-drawer / ra-overlay) and
  // hijack the hamburger button with capture-phase stopPropagation, breaking the
  // built-in side drawer.  We remove their elements, strip their listeners by
  // cloning the button, and watch for late injection via MutationObserver.

  const cleanUpSnippet = () => {
    document.querySelectorAll('.ra-drawer, .ra-overlay').forEach(el => el.remove());
    document.documentElement.classList.remove('ra-lock');
    document.body.classList.remove('ra-lock');
    if (siteNav) siteNav.style.removeProperty('display');
  };

  const replaceToggle = () => {
    const current = document.getElementById('nav-toggle');
    if (!current) return;
    const fresh = current.cloneNode(true);
    current.parentNode.replaceChild(fresh, current);
    navToggle = fresh;
    attachToggleHandler();
  };

  cleanUpSnippet();

  // Watch for snippet-injected elements and remove them immediately
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList && (node.classList.contains('ra-drawer') || node.classList.contains('ra-overlay'))) {
          node.remove();
          replaceToggle();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });

  const openNav = () => {
    cleanUpSnippet();
    siteNav.classList.add('nav-open');
    if (navOverlay) navOverlay.classList.add('nav-overlay-active');
    document.body.classList.add('nav-locked');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close navigation menu');
  };

  const closeNav = () => {
    siteNav.classList.remove('nav-open');
    if (navOverlay) navOverlay.classList.remove('nav-overlay-active');
    document.body.classList.remove('nav-locked');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation menu');
  };

  const attachToggleHandler = () => {
    if (!navToggle || !siteNav) return;
    navToggle.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const isOpen = siteNav.classList.contains('nav-open');
      if (isOpen) { closeNav(); } else { openNav(); }
    });
  };

  if (navToggle && siteNav) {
    replaceToggle();
    // Close drawer via X button
    if (navClose) {
      navClose.addEventListener('click', closeNav);
    }
    // Close drawer when a nav link is clicked
    siteNav.addEventListener('click', (e) => {
      if (e.target.classList.contains('nav-link') || e.target.classList.contains('header-ai-cta')) {
        closeNav();
      }
    });
    // Close drawer when overlay is clicked
    if (navOverlay) {
      navOverlay.addEventListener('click', closeNav);
    }
    // Close drawer on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && siteNav.classList.contains('nav-open')) {
        closeNav();
      }
    });
  }

  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const log = document.getElementById('chat-log');

  if (!form || !input || !log) return;

  const conversationHistory = [];
  let activeZip = '';

  // Check for URL parameters from homepage form
  const urlParams = new URLSearchParams(window.location.search);
  const zipCode = urlParams.get('zip');
  const homeType = urlParams.get('home');
  const stateCode = urlParams.get('state');

  if (zipCode && /^\d{5}$/.test(zipCode)) {
    activeZip = zipCode;
  }

  // State code to full name mapping
  const stateNames = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
    CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
    HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
    KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
    MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
    MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
    NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
    OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
    SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
    VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
    DC:'Washington, D.C.'
  };

  // Build initial context message if we have parameters
  if (zipCode) {
    const homeTypeLabels = {
      'single_family': 'a single-family home',
      'multi_unit': 'a multi-unit building or condo',
      'manufactured': 'a manufactured or mobile home',
      'rental': 'a rental property'
    };
    const homeTypeText = homeType && homeTypeLabels[homeType] ? homeTypeLabels[homeType] : 'a home';
    const contextMessage = `I'm looking for energy rebates. My ZIP code is ${zipCode} and I live in ${homeTypeText}. What rebates and credits might I qualify for?`;
    input.value = contextMessage;
    input.focus();
    input.setSelectionRange(0, 0);
  } else if (stateCode && stateNames[stateCode.toUpperCase()]) {
    const stateName = stateNames[stateCode.toUpperCase()];
    const contextMessage = `I live in ${stateName}. What energy rebates, tax credits, and incentives are available in my state?`;
    input.value = contextMessage;
    input.focus();
    input.setSelectionRange(0, 0);
  }

  // Extract a 5-digit ZIP code from a message string
  const extractZip = (text) => {
    const match = text.match(/\b(\d{5})\b/);
    return match ? match[1] : '';
  };

  // HTML escape helper
  const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Sanitize AI output: allow only safe affiliate links, escape everything else
  const sanitizeAIContent = (text) => {
    // Extract safe links before escaping, then re-insert after
    const linkPattern = /<a\s+href="(https?:\/\/[^"]+)"\s*(?:class="[^"]*"\s*)?(?:style="[^"]*"\s*)?target="_blank"\s*rel="sponsored\s*noopener(?:\s*noreferrer)?"\s*>([^<]+)<\/a>/gi;
    const links = [];
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
      links.push({ full: match[0], url: match[1], label: match[2] });
    }

    // Escape the entire text
    let safe = escapeHtml(text);

    // Re-insert safe links with CSS class instead of inline style
    for (const link of links) {
      const escapedFull = escapeHtml(link.full);
      const safeLink = '<a href="' + escapeHtml(link.url) + '" class="affiliate-link" target="_blank" rel="sponsored noopener noreferrer">' + escapeHtml(link.label) + '</a>';
      safe = safe.replace(escapedFull, safeLink);
    }

    return safe;
  };

  const formatAIResponse = (text) => {
    // Sanitize first, then format
    let formatted = sanitizeAIContent(text);
    // Convert double newlines into paragraph breaks for readability
    formatted = formatted.replace(/\n{2,}/g, '</p><p>');
    // Convert single newlines to line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    // Wrap in paragraph if not already wrapped
    if (!formatted.startsWith('<p>')) {
      formatted = '<p>' + formatted + '</p>';
    }
    return formatted;
  };

  const appendMessage = (text, who = 'ai', rawAI = false) => {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-ai');
    if (who === 'ai' && rawAI) {
      // AI response from server - sanitize before rendering
      const label = document.createElement('strong');
      label.textContent = 'Rebate Atlas AI:';
      div.appendChild(label);
      div.appendChild(document.createTextNode(' '));
      const contentSpan = document.createElement('span');
      contentSpan.innerHTML = formatAIResponse(text);
      div.appendChild(contentSpan);
    } else if (who === 'ai') {
      // Pre-built safe HTML for system messages
      const labelMatch = text.match(/^(<strong>.*?<\/strong>)\s*/);
      if (labelMatch) {
        const label = labelMatch[1];
        const content = text.slice(labelMatch[0].length);
        div.innerHTML = label + ' ' + content;
      } else {
        div.innerHTML = text;
      }
    } else {
      div.innerHTML = text;
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  const renderTypingIndicator = () => {
    const div = document.createElement('div');
    div.className = 'msg msg-ai typing-indicator';
    div.innerHTML = '<strong>Rebate Atlas AI:</strong> <span class="typing-dots">Thinking<span>.</span><span>.</span><span>.</span></span>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  };

  // Clear chat button
  const clearBtn = document.getElementById('clear-chat');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      conversationHistory.length = 0;
      activeZip = '';
      log.innerHTML = '<div class="msg msg-ai"><p><strong>Rebate Atlas AI:</strong> Chat cleared. Share your ZIP code, home type, and an upgrade you\'re considering to get started.</p></div>';
      input.focus();
    });
  }

  // Export/copy chat button
  const exportBtn = document.getElementById('export-chat');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const lines = conversationHistory.map(m => {
        const label = m.role === 'user' ? 'You' : 'Rebate Atlas AI';
        // Strip HTML tags for plain text export
        const text = m.content.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        return `${label}: ${text}`;
      });
      if (lines.length === 0) {
        exportBtn.textContent = 'No messages to copy';
        setTimeout(() => { exportBtn.textContent = 'Copy chat'; }, 2000);
        return;
      }
      const text = 'Rebate Atlas Chat Export\n' + new Date().toLocaleDateString() + '\n\n' + lines.join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        exportBtn.textContent = 'Copied!';
        setTimeout(() => { exportBtn.textContent = 'Copy chat'; }, 2000);
      }).catch(() => {
        exportBtn.textContent = 'Copy failed';
        setTimeout(() => { exportBtn.textContent = 'Copy chat'; }, 2000);
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    const safeContent = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    appendMessage(`<strong>You:</strong> ${safeContent}`, 'user');
    conversationHistory.push({ role: 'user', content });

    // Update active ZIP if the user mentions one
    const mentionedZip = extractZip(content);
    if (mentionedZip) {
      activeZip = mentionedZip;
    }

    input.value = '';
    input.disabled = true;

    const typingIndicator = renderTypingIndicator();

    const MAX_RETRIES = 2;
    let attempt = 0;
    let success = false;

    while (attempt <= MAX_RETRIES && !success) {
      try {
        const payload = { messages: conversationHistory };
        if (activeZip) {
          payload.zip = activeZip;
        }
        if (stateCode) {
          payload.state = stateCode.toUpperCase();
        }

        const res = await fetch('/.netlify/functions/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.status === 429) {
          attempt++;
          if (attempt <= MAX_RETRIES) {
            if (typingIndicator) {
              typingIndicator.querySelector('.typing-dots').textContent = 'Rate limited, retrying...';
            }
            await new Promise(r => setTimeout(r, 2000 * attempt));
            continue;
          }
          if (typingIndicator && typingIndicator.parentNode) {
            log.removeChild(typingIndicator);
          }
          appendMessage(
            '<strong>Rebate Atlas AI:</strong> The AI is receiving a lot of requests right now. Please wait a moment and try again.',
            'ai'
          );
          success = true;
          break;
        }

        const data = await res.json();

        if (typingIndicator && typingIndicator.parentNode) {
          log.removeChild(typingIndicator);
        }

        if (res.ok && data.reply) {
          // Use rawAI=true to sanitize server response before rendering
          appendMessage(data.reply, 'ai', true);
          conversationHistory.push({ role: 'assistant', content: data.reply });
        } else if (res.status === 400 && data.error) {
          appendMessage(
            '<strong>Rebate Atlas AI:</strong> ' + escapeHtml(data.error),
            'ai'
          );
        } else {
          appendMessage(
            '<strong>Rebate Atlas AI:</strong> Sorry \u2014 I encountered an error. Please try again.',
            'ai'
          );
        }
        success = true;
      } catch (err) {
        attempt++;
        if (attempt <= MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          continue;
        }
        console.error('Chat error:', err);
        if (typingIndicator && typingIndicator.parentNode) {
          log.removeChild(typingIndicator);
        }
        appendMessage(
          '<strong>Rebate Atlas AI:</strong> Sorry \u2014 I couldn\u2019t reach the AI engine. Please check your connection and try again.',
          'ai'
        );
        success = true;
      }
    }

    input.disabled = false;
    input.focus();
  });
});
