const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api/chat'
  : '/api/chat';

// Each session: { id, title, history[], messages[], time }
let sessions = [];
// ── Boot ──
window.addEventListener('load', () => {
  createNewSession();
});

// Feature 1: Enter key to send
document.getElementById('userInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ══════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ══════════════════════════════════════════════════════

function createNewSession() {
  const id = Date.now();
  sessions.unshift({
    id,
    title:    'New Chat',
    history:  [],
    messages: [],
    time:     getTime()
  });
  activeSessionId = id;
  renderMessages([]);
  renderSidebar();
  document.getElementById('chatTitle').textContent = 'AI Assistant';
  document.getElementById('userInput').focus();
}

function getActiveSession() {
  return sessions.find(s => s.id === activeSessionId);
}

// ── Open a past session and re-render its messages ──
function openSession(id) {
  // If already active, do nothing
  if (activeSessionId === id) return;

  activeSessionId = id;
  const session = getActiveSession();
  if (!session) return;

  renderSidebar();
  renderMessages(session.messages);
  document.getElementById('chatTitle').textContent = session.title;
  document.getElementById('userInput').focus();
}

// ── Render all messages for a session ──
function renderMessages(messages) {
  const area = document.getElementById('messagesArea');

  // Welcome message always at top
  area.innerHTML = `
    <div class="date-divider"><span>Today</span></div>
    <div class="msg-row bot">
      <div class="msg-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <rect x="3" y="3" width="18" height="14" rx="3"/>
          <path d="M8 21h8M12 17v4"/>
          <circle cx="8.5" cy="10" r="1.5" fill="white" stroke="none"/>
          <circle cx="15.5" cy="10" r="1.5" fill="white" stroke="none"/>
        </svg>
      </div>
      <div class="msg-content">
        <div class="msg-bubble">Hello! I'm your AI assistant powered by Groq. How can I help you today? 😊</div>
        <div class="msg-meta"><span class="msg-time">${getTime()}</span></div>
      </div>
    </div>`;

  // Re-render all stored messages
  messages.forEach(m => {
    if (m.role === 'user') _appendUserBubble(m.content, m.time, false);
    else                   _appendBotBubble(m.content, m.time, false);
  });

  area.scrollTop = area.scrollHeight;
}

// ── Render sidebar chat list ──
function renderSidebar() {
  const list = document.getElementById('chatList');

  // Filter out empty "New Chat" sessions that were never used
  const usedSessions = sessions.filter(s => s.messages.length > 0 || s.id === activeSessionId);

  if (usedSessions.length === 0) {
    list.innerHTML = '<div class="empty-state">No conversations yet.<br/>Start chatting below!</div>';
    return;
  }

  list.innerHTML = usedSessions.map(s => `
    <div class="chat-item ${s.id === activeSessionId ? 'active' : ''}" onclick="openSession(${s.id})">
      <div class="chat-item-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="chat-item-info">
        <p>${esc(s.title)}</p>
        <span>${s.time}</span>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════
//  SEND MESSAGE — All 4 Features
// ══════════════════════════════════════════════════════
async function sendMessage() {

  // Feature 1: Accept User Input
  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  hideError();

  const session = getActiveSession();
  if (!session) return;

  const time = getTime();

  // Feature 3: Show user message immediately
  _appendUserBubble(text, time, true);
  session.messages.push({ role: 'user', content: text, time });

  // Auto-title session from first message
  if (session.title === 'New Chat') {
    session.title = text.length > 30 ? text.slice(0, 30) + '…' : text;
    document.getElementById('chatTitle').textContent = session.title;
    renderSidebar();
  }

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  const typingEl = showTyping();

  // Feature 2: Add to API history
  session.history.push({ role: 'user', content: text });

  try {
    // Feature 2: Send to Groq API via server.js
    const response = await fetch(SERVER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: session.history })
    });

    const data = await response.json();

    // Feature 4: Handle API-level errors
    if (!response.ok || data.error) throw new Error(data.error || `Server error: ${response.status}`);

    const replyTime = getTime();
    session.history.push({ role: 'assistant', content: data.reply });
    session.messages.push({ role: 'assistant', content: data.reply, time: replyTime });

    // Feature 3: Display Response
    typingEl.remove();
    _appendBotBubble(data.reply, replyTime, true);
    renderSidebar();

  } catch (error) {
    typingEl.remove();
    session.history.pop();
    session.messages.pop();

    // Feature 4: Specific error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
      showError('⚠️ Cannot connect to server. Make sure server.js is running: node server.js');
    } else if (error.message.includes('API key not set')) {
      showError('🔑 Groq API key not set. Open server.js and add your key.');
    } else if (error.message.includes('401')) {
      showError('🔑 Invalid API key. Check your Groq API key in server.js.');
    } else if (error.message.includes('429') || error.message.includes('Rate limit')) {
      showError('⏱️ Rate limit reached. Please wait a moment and try again.');
    } else if (error.message.includes('decommissioned')) {
      showError('🤖 AI model unavailable. Check server.js model name.');
    } else {
      showError('❌ ' + error.message);
    }
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

// ══════════════════════════════════════════════════════
//  BUBBLE BUILDERS
// ══════════════════════════════════════════════════════

function _appendUserBubble(text, time, scroll) {
  const area = document.getElementById('messagesArea');
  const div  = document.createElement('div');
  div.className = 'msg-row user';
  div.innerHTML = `
    <div class="msg-content">
      <div class="msg-bubble">${esc(text)}</div>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        <span class="check-icon">
          <svg width="14" height="9" viewBox="0 0 18 11" fill="none" stroke="#a78bfa" stroke-width="2.2">
            <polyline points="1,5.5 4.5,9 10,1"/>
            <polyline points="8,9 11.5,5.5 17,1"/>
          </svg>
        </span>
      </div>
    </div>`;
  area.appendChild(div);
  if (scroll) area.scrollTop = area.scrollHeight;
}

function _appendBotBubble(text, time, scroll) {
  const area = document.getElementById('messagesArea');
  const div  = document.createElement('div');
  div.className = 'msg-row bot';
  const safe = esc(text);
  const raw  = text.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\n/g,'\\n');
  div.innerHTML = `
    <div class="msg-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <rect x="3" y="3" width="18" height="14" rx="3"/>
        <path d="M8 21h8M12 17v4"/>
        <circle cx="8.5" cy="10" r="1.5" fill="white" stroke="none"/>
        <circle cx="15.5" cy="10" r="1.5" fill="white" stroke="none"/>
      </svg>
    </div>
    <div class="msg-content">
      <div class="msg-bubble">${safe}</div>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        <div class="msg-actions">
          <button class="action-btn" title="Copy" onclick="copyMsg(this,\`${raw}\`)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="action-btn like-btn" title="Like" onclick="likeMsg(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </button>
          <button class="action-btn dislike-btn" title="Dislike" onclick="dislikeMsg(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  area.appendChild(div);
  if (scroll) area.scrollTop = area.scrollHeight;
}

function showTyping() {
  const area = document.getElementById('messagesArea');
  const div  = document.createElement('div');
  div.className = 'typing-row';
  div.innerHTML = `
    <div class="msg-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <rect x="3" y="3" width="18" height="14" rx="3"/>
        <path d="M8 21h8M12 17v4"/>
        <circle cx="8.5" cy="10" r="1.5" fill="white" stroke="none"/>
        <circle cx="15.5" cy="10" r="1.5" fill="white" stroke="none"/>
      </svg>
    </div>
    <div class="typing-bubble">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return div;
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

function copyMsg(btn, text) {
  navigator.clipboard.writeText(text.replace(/\\n/g,'\n')).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });
}

function likeMsg(btn) {
  btn.classList.toggle('liked');
  btn.closest('.msg-actions')?.querySelector('.dislike-btn')?.classList.remove('disliked');
}

function dislikeMsg(btn) {
  btn.classList.toggle('disliked');
  btn.closest('.msg-actions')?.querySelector('.like-btn')?.classList.remove('liked');
}

function showError(msg) {
  const bar = document.getElementById('errorBar');
  bar.textContent = msg; bar.classList.add('show');
  setTimeout(hideError, 6000);
}

function hideError() {
  document.getElementById('errorBar').classList.remove('show');
}

function toggleTheme() {
  const html = document.documentElement;
  const chk  = document.getElementById('themeToggle');
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  chk.checked = html.dataset.theme === 'dark';
}

function newChat()  { createNewSession(); }

function clearAll() {
  if (!confirm('Clear all conversations?')) return;
  sessions = [];
  createNewSession();
}

function getTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function esc(t) {
  return String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}