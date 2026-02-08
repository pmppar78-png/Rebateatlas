// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
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

  if (zipCode && /^\d{5}$/.test(zipCode)) {
    activeZip = zipCode;
  }

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
  }

  // Extract a 5-digit ZIP code from a message string
  const extractZip = (text) => {
    const match = text.match(/\b(\d{5})\b/);
    return match ? match[1] : '';
  };

  const formatAIResponse = (html) => {
    // Convert double newlines into paragraph breaks for readability
    let formatted = html.replace(/\n{2,}/g, '</p><p>');
    // Convert single newlines to line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    // Wrap in paragraph if not already wrapped
    if (!formatted.startsWith('<p>')) {
      formatted = '<p>' + formatted + '</p>';
    }
    return formatted;
  };

  const appendMessage = (text, who = 'ai') => {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-ai');
    if (who === 'ai') {
      // Parse the label and content separately
      const labelMatch = text.match(/^(<strong>.*?<\/strong>)\s*/);
      if (labelMatch) {
        const label = labelMatch[1];
        const content = text.slice(labelMatch[0].length);
        div.innerHTML = label + ' ' + formatAIResponse(content);
      } else {
        div.innerHTML = formatAIResponse(text);
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
          const aiReply = `<strong>Rebate Atlas AI:</strong> ${data.reply}`;
          appendMessage(aiReply, 'ai');
          conversationHistory.push({ role: 'assistant', content: data.reply });
        } else if (res.status === 400 && data.error) {
          appendMessage(
            `<strong>Rebate Atlas AI:</strong> ${data.error.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`,
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
