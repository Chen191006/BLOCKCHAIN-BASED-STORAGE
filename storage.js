const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const spiderOmega = require('./crypto-omega');

// Supabase client - SERVER SIDE ONLY
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'encrypted-files';

class StorageManager {
    constructor(blockchain, dataDir = path.join(__dirname, 'data')) {
        this.blockchain = blockchain;
        this.dataDir = dataDir;

        // Local blocks directory is no longer used for encrypted file chunks.
        this.blocksDir = path.join(dataDir, 'blocks');

        // IMPORTANT:
        // ledger.json is still stored locally.
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
     * Process uploaded file:
     * Chunk → Encrypt → Upload encrypted chunks to Supabase Storage
     * → Create blockchain transactions → Mine block
     */
    async processAndStoreFile(
        fileBuffer,
        originalName,
        mimeType,
        primaryPass,
        nodeAlpha,
        nodeBeta,
        nodeGamma
    ) {
        const fileId = crypto.randomUUID();
        const fileSize = fileBuffer.length;
        const totalChunks = Math.ceil(fileSize / this.chunkSize) || 1;

        this.logger(
            `📁 [STORAGE ENGINE] Processing file: "${originalName}" (${(
        fileSize / 1024
      ).toFixed(2)} KB)`
        );

        this.logger(
            `🔐 [SPIDER-WEB OMEGA] Deriving encryption key from 4 node passwords...`
        );

        // Derive multi-password Spider-Web key
        const derived = spiderOmega.deriveSpiderWebKey(
            primaryPass,
            nodeAlpha,
            nodeBeta,
            nodeGamma
        );

        this.logger(
            `🕸️ [SPIDER-WEB] Key Matrix generated. Salt: ${derived.salt.substring(
        0,
        12
      )}...`
        );

        const chunkTxList = [];

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, fileSize);

            const chunkBuffer = fileBuffer.subarray(start, end);

            // Encrypt chunk with Spider Web Omega cipher
            const encrypted = spiderOmega.encryptChunk(
                chunkBuffer,
                derived.key
            );

            // Supabase Storage file name
            const blockChunkFileName = `${fileId}_chunk_${i}.dat`;

            // Upload encrypted chunk to Supabase Storage
            this.logger(
                `☁️ [SUPABASE] Uploading encrypted chunk ${i + 1}/${totalChunks}...`
            );

            const { data: uploadData, error: uploadError } =
            await supabase.storage
                .from(SUPABASE_BUCKET)
                .upload(
                    blockChunkFileName,
                    Buffer.from(encrypted.ciphertext, 'utf8'), {
                        contentType: 'application/octet-stream',
                        upsert: false
                    }
                );

            if (uploadError) {
                this.logger(
                    `❌ [SUPABASE UPLOAD FAILED] ${uploadError.message}`
                );

                throw new Error(
                    `Supabase upload failed: ${uploadError.message}`
                );
            }

            this.logger(
                `✅ [SUPABASE] Chunk uploaded: ${uploadData.path}`
            );

            // Create transaction for blockchain ledger
            const tx = {
                type: 'FILE_CHUNK',
                fileId: fileId,
                fileName: originalName,
                fileSize: fileSize,
                fileType: mimeType,
                chunkIndex: i,
                totalChunks: totalChunks,

                // Hash of ORIGINAL chunk
                chunkHash: crypto
                    .createHash('sha256')
                    .update(chunkBuffer)
                    .digest('hex'),

                // Supabase Storage object path
                storagePath: blockChunkFileName,

                iv: encrypted.iv,
                tag: encrypted.tag,
                salt: derived.salt,
                timestamp: Date.now()
            };

            this.blockchain.addTransaction(tx);
            chunkTxList.push(tx);
        }

        this.logger(
            `⚙️ [BLOCKCHAIN] ${totalChunks} encrypted file chunk transactions added to Mempool.`
        );

        // Automatically mine pending transactions
        const minedBlock =
            this.blockchain.minePendingTransactions('Localhost_Node_1');

        // Save blockchain ledger
        this.saveLedger();

        return {
            fileId,
            fileName: originalName,
            fileSize,
            fileType: mimeType,
            totalChunks,
            minedBlockIndex: minedBlock ?
                minedBlock.index : null,
            webMatrix: derived.webMatrix
        };
    }

    /**
     * Retrieve file:
     * Blockchain metadata → Supabase encrypted chunks
     * → Decrypt → Reassemble original file
     */
    async retrieveAndDecryptFile(
        fileId,
        primaryPass,
        nodeAlpha,
        nodeBeta,
        nodeGamma
    ) {
        const chunkMap =
            this.blockchain.getFileStorageMap(fileId);

        if (!chunkMap || chunkMap.length === 0) {
            throw new Error(
                `File ID ${fileId} not found in Blockchain ledger.`
            );
        }

        const fileMeta = chunkMap[0];

        this.logger(
            `🔍 [RETRIEVAL] Found ${chunkMap.length} blockchain block chunks for file "${fileMeta.fileName}".`
        );

        this.logger(
            `🔐 [SPIDER-WEB OMEGA] Re-deriving decryption key using provided Spider-Web node passwords...`
        );

        // Derive key using stored salt
        const derived =
            spiderOmega.deriveSpiderWebKey(
                primaryPass,
                nodeAlpha,
                nodeBeta,
                nodeGamma,
                fileMeta.salt
            );

        const decryptedBuffers = [];

        // Make sure chunks are retrieved in correct order
        const sortedChunks = [...chunkMap].sort(
            (a, b) => a.chunkIndex - b.chunkIndex
        );

        for (const chunk of sortedChunks) {
            this.logger(
                `☁️ [SUPABASE] Downloading encrypted chunk ${
          chunk.chunkIndex + 1
        }/${chunk.totalChunks}...`
            );

            // Download encrypted chunk from Supabase
            const {
                data: encryptedFile,
                error: downloadError
            } = await supabase.storage
                .from(SUPABASE_BUCKET)
                .download(chunk.storagePath);

            if (downloadError) {
                throw new Error(
                    `Supabase download failed for ${chunk.storagePath}: ${downloadError.message}`
                );
            }

            if (!encryptedFile) {
                throw new Error(
                    `Supabase returned empty data for ${chunk.storagePath}.`
                );
            }

            // Convert downloaded Blob to original ciphertext string
            const ciphertextHex =
                await encryptedFile.text();

            try {
                const decryptedChunk =
                    spiderOmega.decryptChunk(
                        ciphertextHex,
                        chunk.iv,
                        chunk.tag,
                        derived.key
                    );

                decryptedBuffers.push(decryptedChunk);

                this.logger(
                    `✅ [DECRYPTION] Chunk ${chunk.chunkIndex} decrypted successfully.`
                );
            } catch (err) {
                this.logger(
                    `❌ [DECRYPTION FAILED] Invalid Spider-Web Password combination for file "${fileMeta.fileName}".`
                );

                throw new Error(
                    'Spider-Web Omega Decryption failed! Invalid passphrases or compromised block chunk tag.'
                );
            }
        }

        // Reassemble all decrypted chunks
        const reassembledBuffer =
            Buffer.concat(decryptedBuffers);

        this.logger(
            `✨ [SUCCESS] File "${fileMeta.fileName}" successfully decrypted and reassembled!`
        );

        return {
            fileName: fileMeta.fileName,
            fileType: fileMeta.fileType,
            fileSize: fileMeta.fileSize,
            buffer: reassembledBuffer
        };
    }

    /**
     * Save blockchain ledger locally.
     *
     * NOTE:
     * Render's filesystem is ephemeral.
     * This means ledger.json can still disappear after
     * a restart/redeploy. We will handle ledger persistence
     * separately in the next step.
     */
    saveLedger() {
        try {
            const ledgerData = {
                chain: this.blockchain.chain,
                difficulty: this.blockchain.difficulty,
                savedAt: Date.now()
            };

            fs.writeFileSync(
                this.ledgerPath,
                JSON.stringify(ledgerData, null, 2),
                'utf8'
            );
        } catch (err) {
            this.logger(
                `⚠️ Error saving ledger JSON: ${err.message}`
            );
        }
    }

    /**
     * Load blockchain ledger from local disk.
     */
    loadLedger() {
        if (fs.existsSync(this.ledgerPath)) {
            try {
                const raw = fs.readFileSync(
                    this.ledgerPath,
                    'utf8'
                );

                const data = JSON.parse(raw);

                if (
                    data.chain &&
                    Array.isArray(data.chain)
                ) {
                    // Restore chain items
                    this.blockchain.chain =
                        data.chain.map((b) => {
                            const block =
                                new(
                                    require('./blockchain').Block
                                )(
                                    b.index,
                                    b.timestamp,
                                    b.transactions,
                                    b.previousHash
                                );

                            block.nonce = b.nonce;
                            block.hash = b.hash;
                            block.merkleRoot = b.merkleRoot;

                            return block;
                        });

                    this.logger(
                        `📚 [STORAGE] Blockchain state restored from local disk ledger (${this.blockchain.chain.length} blocks).`
                    );
                }
            } catch (err) {
                this.logger(
                    `⚠️ Failed to parse ledger.json, starting fresh chain.`
                );
            }
        }
    }
}

module.exports = StorageManager;