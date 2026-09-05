const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const { Blockchain } = require('./blockchain');
const StorageManager = require('./storage');
const spiderOmega = require('./crypto-omega');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Set up Multer (In-Memory Buffer)
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size limit
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Blockchain and Storage Engine
const omegaChain = new Blockchain();
const storageManager = new StorageManager(omegaChain);

// Unified Terminal Logger Function (Console + WebSocket clients)
function logToTerminal(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const formattedLog = `[${timestamp}] ${message}`;
  
  // 1. Output directly to local CMD console
  console.log(formattedLog);

  // 2. Broadcast to all active browser WebSocket terminal clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'LOG',
        text: formattedLog,
        timestamp
      }));
    }
  });
}

// Hook logger into Blockchain and Storage Manager
omegaChain.setLogger(logToTerminal);
storageManager.setLogger(logToTerminal);

// Load persisted state from disk if exists
storageManager.loadLedger();

// Log welcome ASCII Banner
logToTerminal("==========================================================================");
logToTerminal("⚡ SPIDER-WEB OMEGA: BLOCKCHAIN CLOUD STORAGE SYSTEM INITIALIZED");
logToTerminal("🌐 Localhost Server Listening on http://localhost:" + PORT);
logToTerminal("==========================================================================");

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  logToTerminal("⚡ [NET] New browser client connected to CMD terminal stream.");
  
  ws.send(JSON.stringify({
    type: 'WELCOME',
    text: `=== CONNECTED TO OMEGA-CHAIN LOCALHOST NODE v1.0.0 ===\nType 'help' in terminal for available commands.`
  }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'COMMAND') {
        handleTerminalCommand(parsed.command, ws);
      }
    } catch (e) {
      logToTerminal(`⚠️ Raw socket input: ${msg}`);
    }
  });
});

// Interactive Terminal CLI Command Processor
function handleTerminalCommand(cmdStr, ws = null) {
  const args = cmdStr.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  logToTerminal(`omega-chain> ${cmdStr}`);

  switch (command) {
    case 'help':
      logToTerminal(`
📋 Available Omega Blockchain CLI Commands:
  • help                  - Show this command reference
  • status                - Display node status and memory pool stats
  • chain                 - Output entire Blockchain ledger summary
  • blocks                - Display list of mined blocks and transactions
  • files                 - List all stored cloud files
  • mine                  - Manually trigger pending transaction block mining
  • verify                - Run full SHA-256 chain integrity verification
  • spider-matrix         - View active multi-password Spider Web matrix formula
  • clear                 - Clear browser terminal window
`);
      break;

    case 'status':
      logToTerminal(`
📊 [NODE STATUS]
  • Chain Height    : ${omegaChain.chain.length} blocks
  • Pending Mempool : ${omegaChain.pendingTransactions.length} txs
  • Mining Difficulty: ${omegaChain.difficulty} ("${'0'.repeat(omegaChain.difficulty)}")
  • Total Storage   : ${omegaChain.getAllStoredFiles().length} files active
  • Network Status  : ONLINE (Localhost Node)
`);
      break;

    case 'chain':
    case 'blocks':
      logToTerminal(`🔗 BLOCKCHAIN LEDGER SUMMARY (${omegaChain.chain.length} Blocks):`);
      omegaChain.chain.forEach(b => {
        logToTerminal(`   [Block #${b.index}] Hash: ${b.hash.substring(0, 24)}... | Prev: ${b.previousHash.substring(0, 16)}... | Merkle: ${b.merkleRoot.substring(0, 16)}... | Nonce: ${b.nonce} | Txs: ${b.transactions.length}`);
      });
      break;

    case 'files':
      const fileList = omegaChain.getAllStoredFiles();
      if (fileList.length === 0) {
        logToTerminal("📂 No stored files in Blockchain vault yet.");
      } else {
        logToTerminal(`📂 STORED VAULT FILES (${fileList.length}):`);
        fileList.forEach(f => {
          logToTerminal(`   • ID: ${f.fileId} | File: "${f.fileName}" | Size: ${(f.fileSize / 1024).toFixed(2)} KB | Chunks: ${f.chunksStored}/${f.totalChunks} | Block #${f.blockIndex}`);
        });
      }
      break;

    case 'mine':
      if (omegaChain.pendingTransactions.length === 0) {
        logToTerminal("ℹ️  No transactions pending in Mempool to mine.");
      } else {
        omegaChain.minePendingTransactions('Localhost_CLI_Miner');
      }
      break;

    case 'verify':
      logToTerminal("🛡️  Running full cryptographic hash and Merkle root chain verification...");
      const isValid = omegaChain.isChainValid();
      if (isValid) {
        logToTerminal("✅ [CHAIN VERIFIED] All blocks, hash links, and Merkle trees are 100% SECURE and VALID!");
      } else {
        logToTerminal("❌ [CRITICAL WARNING] Chain validation failed! Tampering detected.");
      }
      break;

    case 'spider-matrix':
      logToTerminal(`
🕸️ [SPIDER-WEB OMEGA CRYPTO SCHEMA]
  • Encryption Algo : AES-256-GCM
  • Key Derivation  : PBKDF2 (10,000 rounds) + 4-Point Geometric Node Vector
  • Security Layer  : Primary Passphrase + Alpha, Beta, Gamma Spider Strands
  • Chunking Size   : 256 KB Shards
`);
      break;

    case 'clear':
      if (ws) {
        ws.send(JSON.stringify({ type: 'CLEAR' }));
      }
      break;

    default:
      if (cmdStr.trim().length > 0) {
        logToTerminal(`❓ Unknown command: '${command}'. Type 'help' for command list.`);
      }
      break;
  }
}

// REST API Endpoints

// 1. Get Node Status
app.get('/api/status', (req, res) => {
  res.json({
    chainHeight: omegaChain.chain.length,
    pendingMempool: omegaChain.pendingTransactions.length,
    difficulty: omegaChain.difficulty,
    totalFiles: omegaChain.getAllStoredFiles().length,
    isValid: omegaChain.isChainValid()
  });
});

// 2. Get Ledger Chain
app.get('/api/chain', (req, res) => {
  res.json({
    length: omegaChain.chain.length,
    chain: omegaChain.chain,
    isValid: omegaChain.isChainValid()
  });
});

// 3. Get Stored Files List
app.get('/api/files', (req, res) => {
  const files = omegaChain.getAllStoredFiles();
  res.json({ files });
});

// 4. File Upload with Multi-Password Spider Web Omega Sharding
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file attached in upload payload.' });
    }

    const { primaryPass, nodeAlpha, nodeBeta, nodeGamma } = req.body;
    if (!primaryPass || !nodeAlpha || !nodeBeta || !nodeGamma) {
      return res.status(400).json({
        error: 'Multi-Password Spider Web Omega matrix incomplete! Requires Primary + Alpha + Beta + Gamma passphrases.'
      });
    }

    logToTerminal(`🚀 [UPLOAD REQUEST] File received: "${req.file.originalname}" (${req.file.size} bytes).`);

    const result = await storageManager.processAndStoreFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype || 'application/octet-stream',
      primaryPass,
      nodeAlpha,
      nodeBeta,
      nodeGamma
    );

    res.json({
      success: true,
      message: 'File successfully encrypted with Spider-Web Omega and mined into Blockchain!',
      file: result
    });
  } catch (err) {
    logToTerminal(`❌ [UPLOAD ERROR] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 5. Decrypt & View File (In-browser preview)
app.post('/api/view', async (req, res) => {
  try {
    const { fileId, primaryPass, nodeAlpha, nodeBeta, nodeGamma } = req.body;
    if (!fileId || !primaryPass || !nodeAlpha || !nodeBeta || !nodeGamma) {
      return res.status(400).json({ error: 'Missing file ID or Spider-Web multi-passwords.' });
    }

    logToTerminal(`🔓 [VIEW REQUEST] Attempting Spider-Web Omega decryption for File ID: ${fileId}`);

    const fileResult = await storageManager.retrieveAndDecryptFile(
      fileId,
      primaryPass,
      nodeAlpha,
      nodeBeta,
      nodeGamma
    );

    // Send base64 data for rich browser preview
    const base64Data = fileResult.buffer.toString('base64');
    
    res.json({
      success: true,
      fileName: fileResult.fileName,
      fileType: fileResult.fileType,
      fileSize: fileResult.fileSize,
      dataUrl: `data:${fileResult.fileType};base64,${base64Data}`,
      textContent: fileResult.fileType.startsWith('text/') || fileResult.fileType.includes('json') || fileResult.fileType.includes('javascript')
        ? fileResult.buffer.toString('utf8')
        : null
    });
  } catch (err) {
    logToTerminal(`❌ [DECRYPTION ERROR] ${err.message}`);
    res.status(401).json({ error: err.message });
  }
});

// 6. Decrypt & Download File
app.post('/api/download', async (req, res) => {
  try {
    const { fileId, primaryPass, nodeAlpha, nodeBeta, nodeGamma } = req.body;
    
    const fileResult = await storageManager.retrieveAndDecryptFile(
      fileId,
      primaryPass,
      nodeAlpha,
      nodeBeta,
      nodeGamma
    );

    res.setHeader('Content-Type', fileResult.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileResult.fileName}"`);
    res.send(fileResult.buffer);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// 7. Execute CMD command via REST (fallback for CLI input)
app.post('/api/cmd', (req, res) => {
  const { command } = req.body;
  if (command) {
    handleTerminalCommand(command);
  }
  res.json({ status: 'OK' });
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
