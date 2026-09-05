const crypto = require('crypto');

/**
 * Block data structure for the Omega Blockchain Cloud Storage
 */
class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.merkleRoot = this.computeMerkleRoot(transactions);
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
          this.previousHash +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.merkleRoot +
          this.nonce
      )
      .digest('hex');
  }

  computeMerkleRoot(transactions) {
    if (!transactions || transactions.length === 0) {
      return crypto.createHash('sha256').update('EMPTY_BLOCK').digest('hex');
    }
    const hashes = transactions.map(tx =>
      crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex')
    );
    return this.buildMerkleTree(hashes);
  }

  buildMerkleTree(hashes) {
    if (hashes.length === 1) return hashes[0];
    const newLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        newLevel.push(
          crypto
            .createHash('sha256')
            .update(hashes[i] + hashes[i + 1])
            .digest('hex')
        );
      } else {
        newLevel.push(hashes[i]);
      }
    }
    return this.buildMerkleTree(newLevel);
  }

  mineBlock(difficulty, logger = console.log) {
    const target = Array(difficulty + 1).join('0');
    const startTime = Date.now();
    logger(`⛏️  [MINER] Starting Proof-of-Work mining for Block #${this.index} (Difficulty: ${difficulty})...`);
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      if (this.nonce % 50000 === 0) {
        logger(`  ↳ [MINING PROGRESS] Nonce: ${this.nonce} | Hash: ${this.hash.substring(0, 20)}...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    logger(`✅ [BLOCK MINED] Block #${this.index} successfully mined in ${duration}s!`);
    logger(`   • Hash: ${this.hash}`);
    logger(`   • Nonce: ${this.nonce}`);
    logger(`   • Merkle Root: ${this.merkleRoot}`);
  }
}

/**
 * Blockchain ledger manager
 */
class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.logger = console.log;
  }

  setLogger(logFn) {
    this.logger = logFn;
  }

  createGenesisBlock() {
    const genesisTx = [{
      type: 'GENESIS',
      fileId: '00000000-0000-0000-0000-000000000000',
      fileName: 'Genesis_Omega_Node.sys',
      chunkIndex: 0,
      totalChunks: 1,
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now(),
      owner: 'System'
    }];
    return new Block(0, Date.now(), genesisTx, '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    if (!transaction.fileId || !transaction.chunkHash) {
      throw new Error('Invalid file storage transaction');
    }
    this.pendingTransactions.push(transaction);
    this.logger(`📥 [MEMPOOL] New transaction added to mempool: File "${transaction.fileName}" (Chunk #${transaction.chunkIndex + 1}/${transaction.totalChunks})`);
    return this.getLatestBlock().index + 1;
  }

  minePendingTransactions(minerAddress = 'Omega_Node_Localhost') {
    if (this.pendingTransactions.length === 0) {
      this.logger('ℹ️  [MINER] No pending transactions in mempool to mine.');
      return null;
    }

    const block = new Block(
      this.chain.length,
      Date.now(),
      [...this.pendingTransactions],
      this.getLatestBlock().hash
    );

    block.mineBlock(this.difficulty, this.logger);
    this.chain.push(block);

    this.logger(`🔗 [LEDGER UPDATE] Block #${block.index} attached to Blockchain. Ledger height: ${this.chain.length}`);
    this.pendingTransactions = [];
    return block;
  }

  getFileStorageMap(fileId) {
    const chunks = [];
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fileId === fileId) {
          chunks.push({
            blockIndex: block.index,
            blockHash: block.hash,
            chunkIndex: tx.chunkIndex,
            totalChunks: tx.totalChunks,
            chunkHash: tx.chunkHash,
            storagePath: tx.storagePath,
            iv: tx.iv,
            tag: tx.tag,
            salt: tx.salt,
            fileName: tx.fileName,
            fileSize: tx.fileSize,
            fileType: tx.fileType,
            uploadedAt: tx.timestamp
          });
        }
      }
    }
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return chunks;
  }

  getAllStoredFiles() {
    const fileMap = new Map();
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'FILE_CHUNK' && tx.fileId) {
          if (!fileMap.has(tx.fileId)) {
            fileMap.set(tx.fileId, {
              fileId: tx.fileId,
              fileName: tx.fileName,
              fileSize: tx.fileSize,
              fileType: tx.fileType,
              totalChunks: tx.totalChunks,
              chunksStored: 1,
              blockIndex: block.index,
              blockHash: block.hash,
              uploadedAt: tx.timestamp
            });
          } else {
            const fileInfo = fileMap.get(tx.fileId);
            fileInfo.chunksStored += 1;
          }
        }
      }
    }
    return Array.from(fileMap.values());
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Re-verify hash calculation
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        this.logger(`❌ [CHAIN ERROR] Block #${i} hash validation failed!`);
        return false;
      }

      // Re-verify link hash
      if (currentBlock.previousHash !== previousBlock.hash) {
        this.logger(`❌ [CHAIN ERROR] Block #${i} previousHash link broken!`);
        return false;
      }

      // Re-verify Merkle Root
      if (currentBlock.merkleRoot !== currentBlock.computeMerkleRoot(currentBlock.transactions)) {
        this.logger(`❌ [CHAIN ERROR] Block #${i} Merkle root mismatch!`);
        return false;
      }
    }
    return true;
  }
}

module.exports = { Block, Blockchain };
