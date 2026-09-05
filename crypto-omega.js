const crypto = require('crypto');

/**
 * Spider-Web Omega Cryptographic Engine
 * Multi-Password Matrix Encryption & Key Derivation
 */
class SpiderWebOmega {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 12;  // 96 bits for GCM
    this.saltLength = 16;
  }

  /**
   * Derive the composite Spider-Web Omega Master Encryption Key from 4 node passwords
   * @param {string} primaryPass - Master Passphrase
   * @param {string} nodeAlpha - Web Strand Alpha Key
   * @param {string} nodeBeta - Web Strand Beta Key
   * @param {string} nodeGamma - Web Strand Gamma Key
   * @param {Buffer} salt - Salt for PBKDF2
   * @returns {Object} { key, webMatrix, salt }
   */
  deriveSpiderWebKey(primaryPass, nodeAlpha, nodeBeta, nodeGamma, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength);
    } else if (typeof salt === 'string') {
      salt = Buffer.from(salt, 'hex');
    }

    // 1. Calculate node hashes and web graph node weights
    const hashAlpha = crypto.createHash('sha256').update(nodeAlpha).digest('hex');
    const hashBeta = crypto.createHash('sha256').update(nodeBeta).digest('hex');
    const hashGamma = crypto.createHash('sha256').update(nodeGamma).digest('hex');

    // 2. Compute 2D Spider Web Node Coordinates (0..100 normalized)
    const coordAlpha = {
      x: (parseInt(hashAlpha.substring(0, 4), 16) % 90) + 5,
      y: (parseInt(hashAlpha.substring(4, 8), 16) % 90) + 5
    };
    const coordBeta = {
      x: (parseInt(hashBeta.substring(0, 4), 16) % 90) + 5,
      y: (parseInt(hashBeta.substring(4, 8), 16) % 90) + 5
    };
    const coordGamma = {
      x: (parseInt(hashGamma.substring(0, 4), 16) % 90) + 5,
      y: (parseInt(hashGamma.substring(4, 8), 16) % 90) + 5
    };
    const coordMaster = { x: 50, y: 50 }; // Center hub

    // 3. Compute Spider Web Geometric Weight Vector
    const distanceAlpha = Math.hypot(coordAlpha.x - coordMaster.x, coordAlpha.y - coordMaster.y);
    const distanceBeta = Math.hypot(coordBeta.x - coordMaster.x, coordBeta.y - coordMaster.y);
    const distanceGamma = Math.hypot(coordGamma.x - coordMaster.x, coordGamma.y - coordMaster.y);

    const omegaMatrixString = `${primaryPass}:${hashAlpha}:${distanceAlpha.toFixed(4)}|${hashBeta}:${distanceBeta.toFixed(4)}|${hashGamma}:${distanceGamma.toFixed(4)}`;

    // 4. Derive final 256-bit AES key via PBKDF2 with 10,000 iterations
    const key = crypto.pbkdf2Sync(omegaMatrixString, salt, 10000, this.keyLength, 'sha256');

    return {
      key,
      salt: salt.toString('hex'),
      matrixString: omegaMatrixString,
      webMatrix: {
        center: coordMaster,
        nodes: [
          { name: 'Alpha Strand', pass: nodeAlpha, coord: coordAlpha, hash: hashAlpha.substring(0, 10) },
          { name: 'Beta Strand', pass: nodeBeta, coord: coordBeta, hash: hashBeta.substring(0, 10) },
          { name: 'Gamma Strand', pass: nodeGamma, coord: coordGamma, hash: hashGamma.substring(0, 10) }
        ]
      }
    };
  }

  /**
   * Encrypt a data buffer using derived Spider-Web Omega key
   * @param {Buffer} dataBuffer 
   * @param {Buffer} derivedKey 
   * @returns {Object} { encryptedDataHex, ivHex, tagHex }
   */
  encryptChunk(dataBuffer, derivedKey) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt an encrypted chunk using derived Spider-Web Omega key
   * @param {string} ciphertextHex 
   * @param {string} ivHex 
   * @param {string} tagHex 
   * @param {Buffer} derivedKey 
   * @returns {Buffer} decrypted data
   */
  decryptChunk(ciphertextHex, ivHex, tagHex, derivedKey) {
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
  }
}

module.exports = new SpiderWebOmega();
