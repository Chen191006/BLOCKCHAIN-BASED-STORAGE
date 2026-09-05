const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const spiderOmega = require('./crypto-omega');

class StorageManager {
  constructor(blockchain, dataDir = path.join(__dirname, 'data')) {
    this.blockchain = blockchain;
    this.dataDir = dataDir;
    this.blocksDir = path.join(dataDir, 'blocks');
    this.ledgerPath = path.join(dataDir, 'ledger.json');
    this.chunkSize = 256 * 1024; // 256 KB per block chunk
    this.logger = console.log;

    this.ensureDirectoryStructure();
  }

  setLogger(logFn) {
    this.logger = logFn;
  }

  ensureDirectoryStructure() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.blocksDir)) {
      fs.mkdirSync(this.blocksDir, { recursive: true });
    }
  }

  /**
   * Process uploaded file: Chunk, Encrypt with Spider-Web Omega key, store on disk, and create Blockchain transactions
   */
  async processAndStoreFile(fileBuffer, originalName, mimeType, primaryPass, nodeAlpha, nodeBeta, nodeGamma) {
    const fileId = crypto.randomUUID();
    const fileSize = fileBuffer.length;
    const totalChunks = Math.ceil(fileSize / this.chunkSize) || 1;

    this.logger(`📁 [STORAGE ENGINE] Processing file: "${originalName}" (${(fileSize / 1024).toFixed(2)} KB)`);
    this.logger(`🔐 [SPIDER-WEB OMEGA] Deriving encryption key from 4 node passwords...`);

    // Derive multi-password Spider-Web key
    const derived = spiderOmega.deriveSpiderWebKey(primaryPass, nodeAlpha, nodeBeta, nodeGamma);
    this.logger(`🕸️  [SPIDER-WEB] Key Matrix generated. Salt: ${derived.salt.substring(0, 12)}...`);

    const chunkTxList = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, fileSize);
      const chunkBuffer = fileBuffer.subarray(start, end);

      // Encrypt chunk with Spider Web Omega cipher
      const encrypted = spiderOmega.encryptChunk(chunkBuffer, derived.key);
      const blockChunkFileName = `${fileId}_chunk_${i}.dat`;
      const blockChunkPath = path.join(this.blocksDir, blockChunkFileName);

      // Write encrypted chunk to storage
      fs.writeFileSync(blockChunkPath, encrypted.ciphertext, 'utf8');

      // Create transaction for blockchain ledger
      const tx = {
        type: 'FILE_CHUNK',
        fileId: fileId,
        fileName: originalName,
        fileSize: fileSize,
        fileType: mimeType,
        chunkIndex: i,
        totalChunks: totalChunks,
        chunkHash: crypto.createHash('sha256').update(chunkBuffer).digest('hex'),
        storagePath: blockChunkFileName,
        iv: encrypted.iv,
        tag: encrypted.tag,
        salt: derived.salt,
        timestamp: Date.now()
      };

      this.blockchain.addTransaction(tx);
      chunkTxList.push(tx);
    }

    this.logger(`⚙️  [BLOCKCHAIN] ${totalChunks} encrypted file chunk transactions added to Mempool.`);
    
    // Automatically trigger Mining of the pending transactions into a new Block
    const minedBlock = this.blockchain.minePendingTransactions('Localhost_Node_1');

    this.saveLedger();

    return {
      fileId,
      fileName: originalName,
      fileSize,
      fileType: mimeType,
      totalChunks,
      minedBlockIndex: minedBlock ? minedBlock.index : null,
      webMatrix: derived.webMatrix
    };
  }

  /**
   * Retrieve and reassemble file by decrypting chunks using the Spider-Web key
   */
  async retrieveAndDecryptFile(fileId, primaryPass, nodeAlpha, nodeBeta, nodeGamma) {
    const chunkMap = this.blockchain.getFileStorageMap(fileId);
    if (!chunkMap || chunkMap.length === 0) {
      throw new Error(`File ID ${fileId} not found in Blockchain ledger.`);
    }

    const fileMeta = chunkMap[0];
    this.logger(`🔍 [RETRIEVAL] Found ${chunkMap.length} blockchain block chunks for file "${fileMeta.fileName}".`);
    this.logger(`🔐 [SPIDER-WEB OMEGA] Re-deriving decryption key using provided Spider-Web node passwords...`);

    // Derive key using stored salt
    const derived = spiderOmega.deriveSpiderWebKey(
      primaryPass,
      nodeAlpha,
      nodeBeta,
      nodeGamma,
      fileMeta.salt
    );

    const decryptedBuffers = [];

    for (const chunk of chunkMap) {
      const chunkFilePath = path.join(this.blocksDir, chunk.storagePath);
      if (!fs.existsSync(chunkFilePath)) {
        throw new Error(`Corrupted storage: Chunk file ${chunk.storagePath} missing from storage disk.`);
      }

      const ciphertextHex = fs.readFileSync(chunkFilePath, 'utf8');
      
      try {
        const decryptedChunk = spiderOmega.decryptChunk(
          ciphertextHex,
          chunk.iv,
          chunk.tag,
          derived.key
        );
        decryptedBuffers.push(decryptedChunk);
      } catch (err) {
        this.logger(`❌ [DECRYPTION FAILED] Invalid Spider-Web Password combination for file "${fileMeta.fileName}".`);
        throw new Error('Spider-Web Omega Decryption failed! Invalid passphrases or compromised block chunk tag.');
      }
    }

    const reassembledBuffer = Buffer.concat(decryptedBuffers);
    this.logger(`✨ [SUCCESS] File "${fileMeta.fileName}" successfully decrypted and reassembled!`);

    return {
      fileName: fileMeta.fileName,
      fileType: fileMeta.fileType,
      fileSize: fileMeta.fileSize,
      buffer: reassembledBuffer
    };
  }

  saveLedger() {
    try {
      const ledgerData = {
        chain: this.blockchain.chain,
        difficulty: this.blockchain.difficulty,
        savedAt: Date.now()
      };
      fs.writeFileSync(this.ledgerPath, JSON.stringify(ledgerData, null, 2), 'utf8');
    } catch (err) {
      this.logger(`⚠️ Error saving ledger JSON: ${err.message}`);
    }
  }

  loadLedger() {
    if (fs.existsSync(this.ledgerPath)) {
      try {
        const raw = fs.readFileSync(this.ledgerPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.chain && Array.isArray(data.chain)) {
          // Restore chain items
          this.blockchain.chain = data.chain.map(b => {
            const block = new (require('./blockchain').Block)(b.index, b.timestamp, b.transactions, b.previousHash);
            block.nonce = b.nonce;
            block.hash = b.hash;
            block.merkleRoot = b.merkleRoot;
            return block;
          });
          this.logger(`📚 [STORAGE] Blockchain state restored from local disk ledger (${this.blockchain.chain.length} blocks).`);
        }
      } catch (err) {
        this.logger(`⚠️ Failed to parse ledger.json, starting fresh chain.`);
      }
    }
  }
}

module.exports = StorageManager;
