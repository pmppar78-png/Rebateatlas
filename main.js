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

  const appendMessage = (text, who = 'ai') => {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-ai');
    div.innerHTML = text;
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    appendMessage(`<strong>You:</strong> ${content}`, 'user');
    conversationHistory.push({ role: 'user', content });

    // Update active ZIP if the user mentions one
    const mentionedZip = extractZip(content);
    if (mentionedZip) {
      activeZip = mentionedZip;
    }

    input.value = '';
    input.disabled = true;

    const typingIndicator = renderTypingIndicator();

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

      const data = await res.json();

      if (typingIndicator && typingIndicator.parentNode) {
        log.removeChild(typingIndicator);
      }

      if (res.ok && data.reply) {
        const aiReply = `<strong>Rebate Atlas AI:</strong> ${data.reply}`;
        appendMessage(aiReply, 'ai');
        conversationHistory.push({ role: 'assistant', content: data.reply });
      } else {
        appendMessage(
          '<strong>Rebate Atlas AI:</strong> Sorry \u2014 I encountered an error. Please try again.',
          'ai'
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      if (typingIndicator && typingIndicator.parentNode) {
        log.removeChild(typingIndicator);
      }
      appendMessage(
        '<strong>Rebate Atlas AI:</strong> Sorry \u2014 I couldn\u2019t reach the AI engine. Please check your connection and try again.',
        'ai'
      );
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
});
