const spiderOmega = require('./crypto-omega');
const { Blockchain } = require('./blockchain');
const StorageManager = require('./storage');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log("=== RUNNING SPIDER-WEB OMEGA SYSTEM SUITE TESTS ===");

  // Test 1: Crypto Omega Encryption & Decryption
  console.log("\n[TEST 1] Testing Spider-Web Multi-Password Cipher...");
  const derivedKey1 = spiderOmega.deriveSpiderWebKey("Master123", "AlphaKey", "BetaKey", "GammaKey");
  const testBuffer = Buffer.from("Hello, Blockchain Cloud Storage with Spider-Web Omega Code!");
  
  const encrypted = spiderOmega.encryptChunk(testBuffer, derivedKey1.key);
  console.log("  • Encrypted Ciphertext (Hex):", encrypted.ciphertext.substring(0, 30) + "...");

  const decrypted = spiderOmega.decryptChunk(encrypted.ciphertext, encrypted.iv, encrypted.tag, derivedKey1.key);
  console.log("  • Decrypted String:", decrypted.toString('utf8'));
  
  if (decrypted.toString('utf8') === testBuffer.toString('utf8')) {
    console.log("  ✅ TEST 1 PASSED: Cipher roundtrip successful!");
  } else {
    throw new Error("TEST 1 FAILED: Decrypted buffer mismatch!");
  }

  // Test 2: Blockchain Mining & Merkle Root Verification
  console.log("\n[TEST 2] Testing Blockchain Ledger & Proof-of-Work...");
  const chain = new Blockchain();
  chain.setLogger(console.log);

  chain.addTransaction({
    fileId: "test-uuid-1234",
    fileName: "document.pdf",
    chunkIndex: 0,
    totalChunks: 1,
    chunkHash: "abc123hash",
    storagePath: "chunk_0.dat",
    iv: "ivhex",
    tag: "taghex",
    salt: "salthex",
    timestamp: Date.now()
  });

  const minedBlock = chain.minePendingTransactions("TestMiner");
  console.log("  • Mined Block Index:", minedBlock.index);
  console.log("  • Mined Block Hash:", minedBlock.hash);
  console.log("  • Merkle Root:", minedBlock.merkleRoot);

  const isValid = chain.isChainValid();
  if (isValid) {
    console.log("  ✅ TEST 2 PASSED: Blockchain integrity verified!");
  } else {
    throw new Error("TEST 2 FAILED: Chain invalid!");
  }

  // Test 3: Storage Engine Roundtrip
  console.log("\n[TEST 3] Testing Storage Engine Chunking & Reassembly...");
  const storage = new StorageManager(chain, path.join(__dirname, 'test_data'));
  
  const sampleFileBuffer = Buffer.from("SPIDER-WEB OMEGA DECENTRALIZED DATA PAYLOAD ".repeat(50));
  const storedResult = await storage.processAndStoreFile(
    sampleFileBuffer,
    "omega_secret.txt",
    "text/plain",
    "MasterPass",
    "AlphaKey",
    "BetaKey",
    "GammaKey"
  );

  console.log("  • Stored File ID:", storedResult.fileId);
  console.log("  • Total Chunks:", storedResult.totalChunks);

  const retrieved = await storage.retrieveAndDecryptFile(
    storedResult.fileId,
    "MasterPass",
    "AlphaKey",
    "BetaKey",
    "GammaKey"
  );

  if (retrieved.buffer.toString('utf8') === sampleFileBuffer.toString('utf8')) {
    console.log("  ✅ TEST 3 PASSED: Storage Manager process & retrieval successful!");
  } else {
    throw new Error("TEST 3 FAILED: Retrieved buffer mismatch!");
  }

  // Cleanup test_data directory
  if (fs.existsSync(path.join(__dirname, 'test_data'))) {
    fs.rmSync(path.join(__dirname, 'test_data'), { recursive: true, force: true });
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
