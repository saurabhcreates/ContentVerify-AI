(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const input = $('#file-input');
  const dropzone = $('#dropzone');
  const fileCard = $('#file-card');
  const toast = $('#toast');
  const pages = ['dashboard', 'analyze', 'history', 'reports', 'settings'];
  const supportedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov']);
  let selectedFile = null;
  let previewUrl = null;
  let toastTimer = null;
  let analyses = [];
  let activeReport = null;

  const demoReport = {
    reportType: 'EXAMPLE ONLY',
    product: 'ContentVerify AI',
    media: { fileName: 'sample_video.mp4', mediaType: 'Video', duration: '00:00:15' },
    result: { label: 'Potentially manipulated', exampleManipulationScore: 82.7 },
    model: { status: 'Not connected', note: 'Illustrative sample values. No detection model was run.' },
    analyzedAt: null
  };

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
  }

  function getExtension(file) {
    return file.name.split('.').pop().toLowerCase();
  }

  function setResultAsExample() {
    $('#result-subtitle').textContent = 'An illustrative result to preview the report layout.';
    $('.demo-badge').textContent = 'EXAMPLE';
    $('#verdict-text').textContent = 'Potentially manipulated';
    $('#verdict-copy').textContent = 'Example result shown to demonstrate the interface.';
    $('#score-value').textContent = '82.7%';
    $('#score-bar').style.width = '82.7%';
    $('#detail-type').replaceChildren();
    const typeIcon = document.createElement('i');
    typeIcon.className = 'type-icon';
    typeIcon.append(icon('video'));
    $('#detail-type').append(typeIcon, ' Video');
    $('#detail-duration').textContent = '00:00:15';
    $('#detail-date').textContent = 'Example data';
    $('#preview-caption').textContent = 'sample_video.mp4';
    $('.caption-time').textContent = '00:15';
    const media = $('#media-preview');
    media.classList.remove('image-mode');
    media.querySelectorAll('img,video').forEach(node => node.remove());
    media.querySelector('.preview-art').hidden = false;
  }

  function setFileResultPending(file) {
    const isVideo = file.type.startsWith('video/') || ['mp4', 'mov'].includes(getExtension(file));
    $('#result-subtitle').textContent = 'Media preview loaded locally. No model has run.';
    $('#verdict-text').textContent = 'Ready for preview';
    $('#verdict-copy').textContent = 'Select Analyze Media to inspect the file details. A detection model is not connected.';
    $('#score-value').textContent = '—';
    $('#score-bar').style.width = '0%';
    $('.demo-badge').textContent = 'NO MODEL';
    $('#preview-caption').textContent = file.name;
    $('.caption-time').textContent = '';
    const typeIcon = document.createElement('i');
    typeIcon.className = 'type-icon';
    typeIcon.append(icon(isVideo ? 'video' : 'image'));
    $('#detail-type').replaceChildren(typeIcon, document.createTextNode(isVideo ? ' Video' : ' Image'));
    $('#detail-duration').textContent = isVideo ? 'Loading…' : 'Not applicable';
    $('#detail-date').textContent = 'Not analyzed';
    const media = $('#media-preview');
    media.querySelectorAll('img,video').forEach(node => node.remove());
    media.querySelector('.preview-art').hidden = true;
    media.classList.toggle('image-mode', !isVideo);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = previewUrl;
      video.controls = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', `Preview of ${file.name}`);
      video.addEventListener('loadedmetadata', () => {
        $('#detail-duration').textContent = formatDuration(video.duration);
        $('.caption-time').textContent = formatDuration(video.duration).slice(-5);
      }, { once: true });
      media.insertBefore(video, media.querySelector('.media-caption'));
    } else {
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = `Preview of ${file.name}`;
      media.insertBefore(image, media.querySelector('.media-caption'));
      image.addEventListener('load', () => {
        $('#detail-duration').textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
      }, { once: true });
    }
  }

  function setFile(file) {
    if (!file) return;
    const extension = getExtension(file);
    if (!supportedExtensions.has(extension)) {
      showToast('Choose a JPG, PNG, WEBP, MP4, or MOV file.');
      input.value = '';
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      showToast('This file is larger than the 100 MB limit.');
      input.value = '';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    fileCard.classList.remove('empty-file');
    fileCard.classList.add('has-file');
    $('#file-name').textContent = file.name;
    $('#file-meta').textContent = `${formatBytes(file.size)} · ${extension.toUpperCase()}`;
    $('#file-status').textContent = 'READY';
    const thumb = $('#file-thumb');
    thumb.replaceChildren();
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = '';
      thumb.append(image);
    } else {
      thumb.append(icon('video'));
    }
    setFileResultPending(file);
    input.value = '';
  }

  function clearFile() {
    selectedFile = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    fileCard.classList.remove('has-file');
    fileCard.classList.add('empty-file');
    $('#file-name').textContent = 'No media selected';
    $('#file-meta').textContent = 'Choose an image or video to get started';
    $('#file-status').textContent = 'WAITING';
    $('#file-thumb').replaceChildren(icon('file'));
    setResultAsExample();
  }

  function updateRecordViews() {
    $('#stat-analyzed').textContent = analyses.length;
    const count = $('#history-count');
    count.textContent = analyses.length;
    count.style.display = analyses.length ? 'inline-block' : 'none';
    renderActivity($('#history-list'), 'history');
    renderActivity($('#dashboard-recent'), 'dashboard');
  }

  function renderActivity(container, mode) {
    container.replaceChildren();
    if (!analyses.length) {
      container.className = 'empty-state';
      const glyph = document.createElement('span');
      glyph.className = 'empty-state-icon';
      glyph.append(icon('clock'));
      const title = document.createElement('strong');
      title.textContent = mode === 'history' ? 'No analyses yet' : 'No activity yet';
      const copy = document.createElement('p');
      copy.textContent = mode === 'history' ? 'Your saved analyses will appear here.' : 'Choose a file to start an analysis.';
      const action = document.createElement('button');
      action.className = 'outline-button';
      action.dataset.goto = 'analyze';
      action.textContent = mode === 'history' ? 'Analyze your first file →' : 'Go to Analyze Media →';
      container.append(glyph, title, copy, action);
      return;
    }
    container.className = 'activity-list';
    const visible = mode === 'dashboard' ? analyses.slice(0, 3) : analyses;
    for (const record of visible) {
      const row = document.createElement('div');
      row.className = 'activity-row';
      const fileIcon = document.createElement('span');
      fileIcon.className = 'activity-file-icon';
      fileIcon.append(icon(String(record.mediaType || '').toLowerCase() === 'video' ? 'video' : 'image'));
      const info = document.createElement('span');
      info.className = 'activity-name';
      const name = document.createElement('strong');
      name.textContent = record.fileName || 'Uploaded media';
      const date = document.createElement('small');
      date.textContent = `${record.createdAt || 'Date unavailable'} · Saved analysis`;
      info.append(name, date);
      const status = document.createElement('span');
      status.className = 'activity-status';
      status.textContent = record.prediction || (record.status === 'validated_only' ? 'Validated only' : 'Analyzed');
      const download = document.createElement('button');
      download.className = 'activity-download';
      download.setAttribute('aria-label', `Download report for ${record.fileName || 'uploaded media'}`);
      download.append(icon('download'));
      download.addEventListener('click', () => {
        const report = record.report || {
          reportType: record.prediction ? 'AI IMAGE CLASSIFICATION' : 'MEDIA VALIDATION ONLY',
          product: 'ContentVerify AI',
          media: { fileName: record.fileName, mediaType: record.mediaType },
          result: record.prediction ? { label: record.prediction, confidencePercent: Number.isFinite(record.confidence) ? record.confidence * 100 : null } : null,
          model: { name: record.model_name || record.modelName || null, status: record.status },
          analyzedAt: record.createdAt || null,
          disclaimer: 'Model predictions are not proof of authenticity.'
        };
        downloadReport(report);
      });
      row.append(fileIcon, info, status, download);
      container.append(row);
    }
  }

  async function loadHistory() {
    const response = await fetch('/api/history', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Could not load saved history');
    analyses = (data.history || []).map(item => ({
      id: item.id,
      fileName: item.filename,
      mediaType: item.media_type === 'video' ? 'Video' : 'Image',
      prediction: item.prediction,
      confidence: item.confidence,
      modelName: item.model_name,
      status: item.status,
      createdAt: item.created_at ? new Date(item.created_at).toLocaleString() : '',
      report: null
    }));
    updateRecordViews();
  }

  let authMode = 'login';
  let signedInUser = null;

  function showAuth(mode = 'login', message = '') {
    authMode = mode;
    $('#auth-screen').hidden = false;
    $('#auth-title').textContent = mode === 'register' ? 'Create your account' : 'Welcome back';
    $('#auth-description').textContent = mode === 'register'
      ? 'Create an account to save and revisit your analysis history.'
      : 'Sign in to analyze media and access your saved history.';
    $('#name-field').hidden = mode !== 'register';
    $('#auth-name').required = mode === 'register';
    $('#auth-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('#auth-submit').textContent = mode === 'register' ? 'Create account' : 'Sign in';
    $('#auth-switch-copy').textContent = mode === 'register' ? 'Already have an account?' : 'New to ContentVerify AI?';
    $('#auth-switch').textContent = mode === 'register' ? 'Sign in' : 'Create account';
    $('#auth-error').hidden = !message;
    $('#auth-error').textContent = message;
  }

  function hideAuth(user) {
    signedInUser = user;
    $('#auth-screen').hidden = true;
    const label = user?.name || user?.email || 'Account';
    const profile = $('.profile-button');
    if (profile) {
      const text = profile.querySelector('span:not(.avatar)');
      if (text) text.textContent = label;
      const avatar = profile.querySelector('.avatar');
      if (avatar) avatar.textContent = String(label).trim().charAt(0).toUpperCase() || 'U';
      profile.title = 'Click to sign out';
    }
    loadHistory().catch(error => showToast(error.message));
  }

  async function initAuth() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!response.ok) {
        showAuth('login');
        return;
      }
      const user = await response.json();
      hideAuth(user.user || user);
    } catch {
      showAuth('login', 'Cannot reach the backend. Check that the server is running.');
    }
  }

const authSwitch = $('#auth-switch');

if (authSwitch) {
  authSwitch.addEventListener('click', () => {
    showAuth(authMode === 'login' ? 'register' : 'login');
  });
}
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('#auth-submit');
    const errorBox = $('#auth-error');
    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = authMode === 'register' ? 'Creating account…' : 'Signing in…';
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    try {
      if (authMode === 'register') {
        const registerResponse = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: $('#auth-name').value.trim(), email, password })
        });
        const registerData = await registerResponse.json().catch(() => ({}));
        if (!registerResponse.ok) throw new Error(registerData.detail || 'Registration failed');
      }
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Login failed. Check your email and password.');
      const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const meData = await meResponse.json().catch(() => ({}));
      if (!meResponse.ok) throw new Error('Login response received, but the session cookie was not accepted.');
      hideAuth(meData.user || meData);
      showToast(authMode === 'register' ? 'Account created successfully.' : 'Signed in successfully.');
    } catch (error) {
      showAuth(authMode, error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = authMode === 'register' ? 'Create account' : 'Sign in';
    }
  });

  $('.profile-button')?.addEventListener('click', async () => {
    if (!signedInUser) return;
    if (!window.confirm('Sign out of ContentVerify AI?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      signedInUser = null;
      analyses = [];
      updateRecordViews();
      showAuth('login', 'You have been signed out.');
    }
  });

  function switchPage(page) {
    if (!pages.includes(page)) return;
    $$('.page-view').forEach(view => view.classList.toggle('active', view.id === `page-${page}`));
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    $('#mobile-title').textContent = page === 'analyze' ? 'Analyze Media' : page[0].toUpperCase() + page.slice(1);
    $('#sidebar').classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function makeReport(file, mediaType, duration) {
    return {
      reportType: 'PREVIEW ONLY — NO MODEL RESULT',
      product: 'ContentVerify AI',
      media: { fileName: file.name, fileSize: formatBytes(file.size), mediaType, duration },
      result: null,
      model: { status: 'Not connected', note: 'No detection or authenticity assessment was performed.' },
      analyzedAt: new Date().toISOString()
    };
  }

  function downloadReport(report = activeReport || demoReport) {
    const data = { ...report };
    if (data === demoReport || report.reportType === 'EXAMPLE ONLY') data.analyzedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `contentverify-${report.media?.fileName?.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-|-$/g, '') || 'example'}-report.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Analysis report downloaded. Predictions are not proof of authenticity.');
  }

  async function analyze() {
    if (!selectedFile) {
      showToast('Choose a file first.');
      return;
    }
    const button = $('#analyze-button');
    const label = button.querySelector('span');
    button.disabled = true;
    label.textContent = 'Uploading to backend…';
    $('#score-bar').style.width = '25%';

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Backend upload failed');

      const file = selectedFile;
      const isVideo = data.details?.kind === 'video';
      const type = isVideo ? 'Video' : 'Image';
      const duration = isVideo ? (data.details?.duration_seconds ?? 'Not measured by this prototype') : 'Not applicable';
           const detection = data.detection;
      const hasPrediction = !isVideo &&
        detection &&
        ['REAL', 'FAKE'].includes(String(detection.label).toUpperCase());

      const label = hasPrediction
        ? String(detection.label).toUpperCase()
        : null;

      const confidence = hasPrediction
        ? Number(detection.confidence_percent)
        : null;

      const report = {
        reportType: hasPrediction
          ? 'AI IMAGE CLASSIFICATION'
          : 'MEDIA VALIDATION ONLY',
        product: 'ContentVerify AI',
        media: {
          fileName: file.name,
          fileSize: formatBytes(file.size),
          mediaType: type,
          duration
        },
        result: hasPrediction
          ? {
              label,
              confidencePercent: confidence
            }
          : null,
        backend: data,
        model: hasPrediction
          ? {
              status: 'Prediction completed',
              name: detection.model,
              note: detection.warning
            }
          : {
              status: 'No prediction',
              note: isVideo
                ? 'Video deepfake detection is not implemented.'
                : 'No valid model prediction was returned.'
            },
        analyzedAt: new Date().toISOString()
      };

      activeReport = report;

     if (hasPrediction) {
  const isReal = label === 'REAL';

  $('#result-subtitle').textContent =
    'AI image classification completed';

  // Display the classification result.
  $('#verdict-text').textContent = isReal
    ? 'Likely Real'
    : 'Likely AI-Generated';

  // Explain the prediction and its limitations.
  $('#verdict-copy').textContent = isReal
    ? 'The model classified this image as real. This prediction is not proof of authenticity; edited or AI-generated images may be misclassified.'
    : 'The model classified this image as AI-generated. This prediction is not proof of synthetic origin; genuine photographs may be misclassified.';

  // Display the model score.
  $('#score-value').textContent =
    Number.isFinite(confidence)
      ? `${Math.max(0, Math.min(100, confidence)).toFixed(2)}%`
      : 'Unavailable';

  $('#score-bar').style.width =
    Number.isFinite(confidence)
      ? `${Math.max(0, Math.min(100, confidence))}%`
      : '0%';

  // Identify the result as an automated prediction.
  $('.demo-badge').textContent = 'AI PREDICTION';

  $('#detail-type').replaceChildren();

  const typeIcon = document.createElement('i');
  typeIcon.className = 'type-icon';
  typeIcon.append(icon('image'));

  $('#detail-type').append(
    typeIcon,
    document.createTextNode(' Image')
  );

  $('#detail-duration').textContent = 'Not applicable';

  $('#preview-caption').textContent = file.name;

  showToast(
    isReal
      ? 'Image classified as likely real.'
      : 'Image classified as likely AI-generated.'
  );

} else {
  $('#result-subtitle').textContent =
    'No image classification available';

  $('#verdict-text').textContent =
    isVideo
      ? 'Video Detection Unavailable'
      : 'Inconclusive';

  $('#verdict-copy').textContent =
    isVideo
      ? 'The video was validated, but video deepfake detection is not implemented.'
      : 'The backend did not return a valid image classification. Please try another image.';

  $('#score-value').textContent = 'N/A';
  $('#score-bar').style.width = '0%';

  $('.demo-badge').textContent =
    isVideo ? 'VALIDATION ONLY' : 'INCONCLUSIVE';

  showToast(
    isVideo
      ? 'Video validated; no deepfake prediction was made.'
      : 'No valid prediction was returned.'
  );
}

      $('#detail-date').textContent =
        new Date().toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

      const record = {
        fileName: file.name,
        mediaType: type,
        createdAt: new Date().toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short'
        }),
        report
      };

      analyses.unshift(record);
      updateRecordViews();
      try {
        await loadHistory();
      } catch (historyError) {
        showToast(`Analysis completed, but history refresh failed: ${historyError.message}`);
      }
    } catch (error) {
      showToast(`Backend error: ${error.message}`);
      $('#result-subtitle').textContent = 'Could not complete backend validation.';
      $('#verdict-text').textContent = 'Backend error';
      $('#verdict-copy').textContent = error.message;
    } finally {
      button.disabled = false;
      label.textContent = 'Analyze Media';
      $('#score-bar').style.width = '0%';
    }
  }

  $('#browse-button').addEventListener('click', event => { event.stopPropagation(); input.click(); });
 
  if (dropzone) {
    dropzone.addEventListener('click', event => {
      if (event.target !== $('#browse-button') && input) {
        input.click();
      }
    });

    dropzone.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && input) {
        event.preventDefault();
        input.click();
      }
    });
  }

  if (input) {
    input.addEventListener('change', () => setFile(input.files?.[0]));
  }

  const removeFileButton = $('#remove-file');
  if (removeFileButton) {
    removeFileButton.addEventListener('click', clearFile);
  }

  const analyzeButton = $('#analyze-button');
  if (analyzeButton) {
    analyzeButton.addEventListener('click', analyze);
  }

  const newButton = $('#new-button');
  if (newButton) {
    newButton.addEventListener('click', () => {
      clearFile();
      activeReport = null;
      showToast('Ready for a new analysis.');
    });
  }

  const downloadButton = $('#download-button');
  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      downloadReport(activeReport || demoReport);
    });
  }

  const secondaryDownloadButton = $('#download-button-secondary');
  if (secondaryDownloadButton) {
    secondaryDownloadButton.addEventListener('click', () => {
      downloadReport(activeReport || demoReport);
    });
  }

  const clearHistoryButton = $('#clear-history');
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', () => {
      showToast('Deleting saved history is not available yet.');
    });
  }

  const menuButton = $('#menu-button');
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const sidebar = $('#sidebar');
      if (sidebar) sidebar.classList.toggle('mobile-open');
    });
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-page]');
    const goto = event.target.closest('[data-goto]');

    if (nav) switchPage(nav.dataset.page);
    if (goto) switchPage(goto.dataset.goto);
  });

  

  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', event => setFile(event.dataTransfer?.files?.[0]));
  window.addEventListener('beforeunload', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
  updateRecordViews();
  initAuth();
})();
