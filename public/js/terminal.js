/**
 * Terminal Manager for Real-time CMD Logging & Interactive CLI
 */
class TerminalManager {
  constructor(terminalBodyId, cmdInputId) {
    this.terminalBody = document.getElementById(terminalBodyId);
    this.cmdInput = document.getElementById(cmdInputId);
    this.history = [];
    this.historyIndex = -1;
    this.ws = null;

    this.initWebSocket();
    this.initInputHandler();
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.appendLine("🔌 [NET] WebSocket connection established with Omega-Chain Localhost Server.");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'LOG') {
          this.appendLine(msg.text);
        } else if (msg.type === 'WELCOME') {
          this.appendLine(msg.text);
        } else if (msg.type === 'CLEAR') {
          this.clearTerminal();
        }
      } catch (e) {
        this.appendLine(event.data);
      }
    };

    this.ws.onclose = () => {
      this.appendLine("⚠️ [NET] WebSocket disconnected. Retrying connection in 3 seconds...");
      setTimeout(() => this.initWebSocket(), 3000);
    };
  }

  initInputHandler() {
    if (!this.cmdInput) return;

    this.cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.cmdInput.value.trim();
        if (cmd) {
          this.history.push(cmd);
          this.historyIndex = this.history.length;
          
          if (cmd.toLowerCase() === 'clear') {
            this.clearTerminal();
          } else {
            this.sendTerminalCommand(cmd);
          }
          this.cmdInput.value = '';
        }
      } else if (e.key === 'ArrowUp') {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.cmdInput.value = this.history[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.cmdInput.value = this.history[this.historyIndex];
        } else {
          this.historyIndex = this.history.length;
          this.cmdInput.value = '';
        }
      }
    });
  }

  sendTerminalCommand(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'COMMAND', command }));
    } else {
      // Fallback to HTTP POST
      fetch('/api/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
    }
  }

  appendLine(text) {
    if (!this.terminalBody) return;

    const div = document.createElement('div');
    div.className = 'terminal-line';

    // Color code logs based on text keywords
    if (text.includes('❌') || text.includes('ERROR') || text.includes('FAILED')) {
      div.style.color = '#ff5f56';
    } else if (text.includes('✅') || text.includes('SUCCESS') || text.includes('VERIFIED')) {
      div.style.color = '#00ff66';
    } else if (text.includes('⛏️') || text.includes('MINED') || text.includes('MEMPOOL')) {
      div.style.color = '#ffb703';
    } else if (text.includes('🕸️') || text.includes('SPIDER-WEB') || text.includes('🔐')) {
      div.style.color = '#9d4edd';
    } else if (text.includes('omega-chain>')) {
      div.style.color = '#00f3ff';
      div.style.fontWeight = 'bold';
    } else {
      div.style.color = '#00ff66';
    }

    div.textContent = text;
    this.terminalBody.appendChild(div);

    // Auto scroll to bottom
    this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
  }

  clearTerminal() {
    if (this.terminalBody) {
      this.terminalBody.innerHTML = '<div class="terminal-line" style="color:#00f3ff;">=== TERMINAL CLEARED ===</div>';
    }
  }
}

window.TerminalManager = TerminalManager;
