/**
 * Main Web UI Controller for Blockchain Cloud Storage System
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Spider Web Canvas
  const spiderWeb = new SpiderWebCanvas('spiderCanvas');

  // Initialize CMD Terminal
  const terminal = new TerminalManager('terminalBody', 'cmdInput');

  // UI Elements
  const primaryPassInput = document.getElementById('primaryPass');
  const nodeAlphaInput = document.getElementById('nodeAlpha');
  const nodeBetaInput = document.getElementById('nodeBeta');
  const nodeGammaInput = document.getElementById('nodeGamma');

  const fileInput = document.getElementById('fileInput');
  const uploadZone = document.getElementById('uploadZone');
  const uploadBtn = document.getElementById('uploadBtn');
  const selectedFileName = document.getElementById('selectedFileName');
  const fileVaultList = document.getElementById('fileVaultList');

  // Modal Elements
  const fileModal = document.getElementById('fileModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Stats Elements
  const statHeight = document.getElementById('statHeight');
  const statMempool = document.getElementById('statMempool');
  const statFiles = document.getElementById('statFiles');
  const statStatus = document.getElementById('statStatus');

  let selectedFile = null;

  // 1. Update Spider Web Canvas when passwords change
  function handlePasswordChange() {
    spiderWeb.updateNodePositions(
      nodeAlphaInput.value,
      nodeBetaInput.value,
      nodeGammaInput.value
    );
  }

  [primaryPassInput, nodeAlphaInput, nodeBetaInput, nodeGammaInput].forEach(input => {
    if (input) {
      input.addEventListener('input', handlePasswordChange);
    }
  });

  // 2. Drag & Drop File Upload Handlers
  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      selectedFile = e.dataTransfer.files[0];
      updateSelectedFileLabel();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      selectedFile = fileInput.files[0];
      updateSelectedFileLabel();
    }
  });

  function updateSelectedFileLabel() {
    if (selectedFile) {
      selectedFileName.textContent = `📄 Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
      uploadBtn.disabled = false;
    } else {
      selectedFileName.textContent = 'No file selected';
      uploadBtn.disabled = true;
    }
  }

  // 3. Handle File Upload Action
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const primary = primaryPassInput.value.trim();
    const alpha = nodeAlphaInput.value.trim();
    const beta = nodeBetaInput.value.trim();
    const gamma = nodeGammaInput.value.trim();

    if (!primary || !alpha || !beta || !gamma) {
      alert('⚠️ Spider-Web Omega requirement: All 4 passwords (Master + Alpha, Beta, Gamma) must be filled!');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('primaryPass', primary);
    formData.append('nodeAlpha', alpha);
    formData.append('nodeBeta', beta);
    formData.append('nodeGamma', gamma);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '⚡ Encrypting & Mining...';

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        selectedFile = null;
        fileInput.value = '';
        updateSelectedFileLabel();
        loadVaultFiles();
        loadNodeStats();
      } else {
        alert(`❌ Upload Error: ${data.error || 'Upload failed'}`);
      }
    } catch (err) {
      alert(`❌ Network Error: ${err.message}`);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fas fa-lock"></i> Encrypt & Store on Blockchain';
    }
  });

  // 4. Load & Render Stored Vault Files
  async function loadVaultFiles() {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      renderVaultFiles(data.files || []);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }

  function renderVaultFiles(files) {
    fileVaultList.innerHTML = '';

    if (files.length === 0) {
      fileVaultList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
          <i class="fas fa-cube" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <p>No encrypted files stored on the Blockchain yet.</p>
        </div>
      `;
      return;
    }

    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';

      const fileExt = file.fileName.split('.').pop().toLowerCase();
      let iconClass = 'fas fa-file-code';
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) iconClass = 'fas fa-file-image';
      else if (['pdf', 'doc', 'docx', 'txt'].includes(fileExt)) iconClass = 'fas fa-file-alt';
      else if (['mp4', 'webm', 'mkv'].includes(fileExt)) iconClass = 'fas fa-file-video';

      item.innerHTML = `
        <div class="file-info">
          <i class="${iconClass} file-icon"></i>
          <div>
            <div class="file-name">${escapeHtml(file.fileName)}</div>
            <div class="file-meta">
              Block #${file.blockIndex} • ${(file.fileSize / 1024).toFixed(2)} KB • ${file.chunksStored} chunk(s)
            </div>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn-action btn-view" data-id="${file.fileId}">
            <i class="fas fa-eye"></i> View File
          </button>
          <button class="btn-action btn-dl" data-id="${file.fileId}" data-name="${escapeHtml(file.fileName)}">
            <i class="fas fa-download"></i> Download
          </button>
        </div>
      `;

      fileVaultList.appendChild(item);
    });

    // Attach click event listeners for View & Download buttons
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.currentTarget.getAttribute('data-id');
        openFileViewModal(fileId);
      });
    });

    document.querySelectorAll('.btn-dl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.currentTarget.getAttribute('data-id');
        downloadDecryptedFile(fileId);
      });
    });
  }

  // 5. Open File Viewer Modal & Decrypt Content
  async function openFileViewModal(fileId) {
    const primary = primaryPassInput.value.trim();
    const alpha = nodeAlphaInput.value.trim();
    const beta = nodeBetaInput.value.trim();
    const gamma = nodeGammaInput.value.trim();

    if (!primary || !alpha || !beta || !gamma) {
      alert('⚠️ Please enter all 4 Spider-Web Omega passwords in the security matrix panel to view and decrypt this file!');
      return;
    }

    modalTitle.textContent = '🔓 Decrypting File via Spider-Web Omega...';
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--cyan); margin-bottom: 1rem;"></i>
        <p style="color: var(--cyan);">Decrypting block shards from Blockchain storage...</p>
      </div>
    `;

    fileModal.classList.add('active');

    try {
      const response = await fetch('/api/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          primaryPass: primary,
          nodeAlpha: alpha,
          nodeBeta: beta,
          nodeGamma: gamma
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        modalTitle.textContent = '❌ Decryption Failed';
        modalBody.innerHTML = `
          <div style="color: #ff5f56; text-align: center; padding: 2rem;">
            <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p><strong>Invalid Spider-Web Passwords!</strong></p>
            <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
              The provided Multi-Password combination failed authentication.
            </p>
          </div>
        `;
        return;
      }

      modalTitle.textContent = `🔓 Preview: ${result.fileName}`;
      renderFilePreview(result);

    } catch (err) {
      modalTitle.textContent = '❌ Error';
      modalBody.innerHTML = `<p style="color: red;">${err.message}</p>`;
    }
  }

  function renderFilePreview(fileRes) {
    const { fileType, dataUrl, textContent, fileName } = fileRes;
    modalBody.innerHTML = '';

    if (fileType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = fileName;
      modalBody.appendChild(img);
    } else if (fileType.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = dataUrl;
      video.controls = true;
      video.autoplay = true;
      modalBody.appendChild(video);
    } else if (fileType.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = dataUrl;
      audio.controls = true;
      audio.autoplay = true;
      modalBody.appendChild(audio);
    } else if (textContent) {
      const pre = document.createElement('pre');
      pre.className = 'text-preview';
      pre.textContent = textContent;
      modalBody.appendChild(pre);
    } else {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <i class="fas fa-file-download" style="font-size: 3.5rem; color: var(--cyan); margin-bottom: 1rem;"></i>
          <p style="color: #fff; font-weight: 600;">Decrypted Binary File Ready</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">(${fileType})</p>
          <a href="${dataUrl}" download="${fileName}" class="btn-cyber" style="text-decoration: none; display: inline-flex; width: auto;">
            <i class="fas fa-download"></i> Save ${fileName} to Disk
          </a>
        </div>
      `;
    }
  }

  // Close Modal Handler
  closeModalBtn.addEventListener('click', () => {
    fileModal.classList.remove('active');
  });

  fileModal.addEventListener('click', (e) => {
    if (e.target === fileModal) {
      fileModal.classList.remove('active');
    }
  });

  // 6. Download Decrypted File
  async function downloadDecryptedFile(fileId) {
    const primary = primaryPassInput.value.trim();
    const alpha = nodeAlphaInput.value.trim();
    const beta = nodeBetaInput.value.trim();
    const gamma = nodeGammaInput.value.trim();

    if (!primary || !alpha || !beta || !gamma) {
      alert('⚠️ Enter all 4 Spider-Web Omega passwords to decrypt & download!');
      return;
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          primaryPass: primary,
          nodeAlpha: alpha,
          nodeBeta: beta,
          nodeGamma: gamma
        })
      });

      if (!response.ok) {
        alert('❌ Decryption failed: Invalid Spider-Web passwords!');
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'decrypted_file';

      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`❌ Download Error: ${err.message}`);
    }
  }

  // 7. Load System Stats
  async function loadNodeStats() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      statHeight.textContent = `${data.chainHeight} Blocks`;
      statMempool.textContent = `${data.pendingMempool} Tx`;
      statFiles.textContent = `${data.totalFiles} Files`;
      statStatus.textContent = data.isValid ? 'SECURE' : 'TAMPERED';
    } catch (e) {
      console.error(e);
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Initial load calls
  loadVaultFiles();
  loadNodeStats();
  setInterval(loadNodeStats, 5000);
});
