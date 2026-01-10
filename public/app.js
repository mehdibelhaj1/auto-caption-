const PRIORITY = ['gladia', 'assemblyai', 'groq', 'openrouter', 'gemini', 'openai', 'deepseek'];

const elements = {
  apiStatus: document.getElementById('apiStatus'),
  refreshStatus: document.getElementById('refreshStatus'),
  openKeyModal: document.getElementById('openKeyModal'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  fileCard: document.getElementById('fileCard'),
  fileName: document.getElementById('fileName'),
  fileMeta: document.getElementById('fileMeta'),
  clearFile: document.getElementById('clearFile'),
  estimateTime: document.getElementById('estimateTime'),
  summaryProvider: document.getElementById('summaryProvider'),
  summaryStt: document.getElementById('summaryStt'),
  summaryChat: document.getElementById('summaryChat'),
  startBtn: document.getElementById('startBtn'),
  startHint: document.getElementById('startHint'),
  providerSelect: document.getElementById('providerSelect'),
  providerHint: document.getElementById('providerHint'),
  formatSelect: document.getElementById('formatSelect'),
  safeMode: document.getElementById('safeMode'),
  diarization: document.getElementById('diarization'),
  darijaStrict: document.getElementById('darijaStrict'),
  chunkMinutes: document.getElementById('chunkMinutes'),
  fetchModels: document.getElementById('fetchModels'),
  sttModelInput: document.getElementById('sttModelInput'),
  chatModelInput: document.getElementById('chatModelInput'),
  sttModelList: document.getElementById('sttModelList'),
  chatModelList: document.getElementById('chatModelList'),
  progressFill: document.getElementById('progressFill'),
  progressPercent: document.getElementById('progressPercent'),
  progressStage: document.getElementById('progressStage'),
  statusText: document.getElementById('statusText'),
  logList: document.getElementById('logList'),
  downloadBtn: document.getElementById('downloadBtn'),
  keyModal: document.getElementById('keyModal'),
  closeKeyModal: document.getElementById('closeKeyModal'),
  keyProvider: document.getElementById('keyProvider'),
  keyInput: document.getElementById('keyInput'),
  keyHelp: document.getElementById('keyHelp'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  keyResult: document.getElementById('keyResult')
};

const state = {
  file: null,
  providers: [],
  providerStatuses: [],
  autoProvider: null,
  jobId: null
};

const providerHelp = {
  gladia: 'أفضل للهجات (10 ساعات مجانية شهرياً).',
  assemblyai: 'رصيد مجاني للبداية ونتائج قوية.',
  groq: 'مجاني وسريع، ممتاز للدارجة.',
  openrouter: 'بوابة للوصول لموديلات متعددة.',
  gemini: 'مناسب للدارجة لكن مع حدود صارمة.',
  openai: 'مدفوع مع Whisper الأصلي.',
  deepseek: 'رخيص لكنه بدون تفريغ صوتي.'
};

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function estimateDuration(fileSizeBytes, chunkMinutes) {
  if (!fileSizeBytes) return '—';
  const sizeMB = fileSizeBytes / (1024 * 1024);
  const baseSeconds = Math.max(30, Math.round(sizeMB * 6 + 20));
  const chunkPenalty = chunkMinutes > 0 ? Math.round(chunkMinutes * 4) : 0;
  const totalSeconds = baseSeconds + chunkPenalty;
  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} دقيقة تقريباً`;
}

function resolveAutoProvider() {
  for (const provider of PRIORITY) {
    const status = state.providerStatuses.find(p => p.name === provider && p.status === 'success');
    if (status) return provider;
  }
  return null;
}

function updateSummary() {
  const selectedProvider = elements.providerSelect.value;
  const effectiveProvider = selectedProvider === 'auto' ? state.autoProvider : selectedProvider;
  elements.summaryProvider.textContent = effectiveProvider ? `${effectiveProvider.toUpperCase()}` : 'غير متاح';
  elements.summaryStt.textContent = elements.sttModelInput.value || 'افتراضي';
  elements.summaryChat.textContent = elements.chatModelInput.value || 'افتراضي';
}

function updateStartState() {
  const selectedProvider = elements.providerSelect.value;
  const effectiveProvider = selectedProvider === 'auto' ? state.autoProvider : selectedProvider;
  const providerReady = !!effectiveProvider;
  const canStart = !!state.file && providerReady;
  elements.startBtn.disabled = !canStart;
  elements.startHint.textContent = canStart
    ? `سيتم التشغيل عبر ${effectiveProvider.toUpperCase()}.`
    : 'اختر ملفاً صالحاً وتأكد من توفر مزود.';
}

function updateProviderHint() {
  const selected = elements.providerSelect.value;
  if (selected === 'auto') {
    elements.providerHint.textContent = state.autoProvider
      ? `سيتم اختيار ${state.autoProvider.toUpperCase()} تلقائياً حسب الأولوية.`
      : 'لا يوجد مزود متاح حالياً.';
  } else {
    elements.providerHint.textContent = providerHelp[selected] || 'مزود مخصص.';
  }
}

function setFile(file) {
  state.file = file;
  if (!file) {
    elements.fileCard.classList.remove('show');
    elements.fileName.textContent = '';
    elements.fileMeta.textContent = '';
    elements.estimateTime.textContent = '—';
    updateStartState();
    return;
  }
  elements.fileCard.classList.add('show');
  elements.fileName.textContent = file.name;
  elements.fileMeta.textContent = formatBytes(file.size);
  elements.estimateTime.textContent = estimateDuration(file.size, parseInt(elements.chunkMinutes.value, 10));
  updateStartState();
}

function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  elements.logList.appendChild(entry);
  elements.logList.scrollTop = elements.logList.scrollHeight;
}

function resetProgress() {
  elements.progressFill.style.width = '0%';
  elements.progressPercent.textContent = '0%';
  elements.progressStage.textContent = '—';
  elements.statusText.textContent = 'جاري تجهيز المهمة...';
  elements.logList.innerHTML = '';
  elements.downloadBtn.hidden = true;
}

async function refreshStatus() {
  elements.apiStatus.innerHTML = '<p>جاري التحقق...</p>';
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.providerStatuses = data.apis;
    state.autoProvider = resolveAutoProvider();

    elements.providerSelect.innerHTML = '<option value="auto">تلقائي (أفضل متاح)</option>';
    elements.apiStatus.innerHTML = '';

    if (!data.apis.length) {
      elements.apiStatus.innerHTML = '<p>لا توجد مفاتيح API حالياً.</p>';
    }

    data.apis.forEach(api => {
      const option = document.createElement('option');
      option.value = api.name;
      option.textContent = api.label;
      option.disabled = api.status !== 'success';
      elements.providerSelect.appendChild(option);

      const tile = document.createElement('div');
      tile.className = `api-tile ${api.status === 'success' ? 'ok' : 'error'}`;
      tile.innerHTML = `
        <h4>${api.label}</h4>
        <div class="api-meta">
          <span>${api.status === 'success' ? '✅ جاهز' : api.statusMessage}</span>
          <span>${api.key}</span>
        </div>
      `;
      elements.apiStatus.appendChild(tile);
    });

    updateProviderHint();
    updateSummary();
    updateStartState();
  } catch (error) {
    elements.apiStatus.innerHTML = '<p>تعذر الاتصال بالخادم.</p>';
  }
}

async function fetchModels() {
  const provider = elements.providerSelect.value;
  elements.fetchModels.disabled = true;
  elements.fetchModels.textContent = 'جاري التحميل...';
  try {
    const res = await fetch(`/api/models?provider=${provider}`);
    const data = await res.json();
    if (data.error) {
      addLog(`⚠️ تعذر جلب الموديلات: ${data.error}`, 'error');
    } else {
      elements.sttModelList.innerHTML = '';
      elements.chatModelList.innerHTML = '';
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        elements.sttModelList.appendChild(option.cloneNode(true));
        elements.chatModelList.appendChild(option);
      });
      if (data.defaults?.sttModel && !elements.sttModelInput.value) {
        elements.sttModelInput.value = data.defaults.sttModel || '';
      }
      if (data.defaults?.chatModel && !elements.chatModelInput.value) {
        elements.chatModelInput.value = data.defaults.chatModel || '';
      }
      updateSummary();
    }
  } catch (error) {
    addLog('⚠️ فشل جلب الموديلات.', 'error');
  } finally {
    elements.fetchModels.disabled = false;
    elements.fetchModels.textContent = 'جلب الموديلات';
  }
}

async function startJob() {
  if (!state.file) return;
  resetProgress();
  addLog('📤 جاري رفع الفيديو...', 'info');

  const formData = new FormData();
  formData.append('video', state.file);
  formData.append('safeMode', elements.safeMode.checked);
  formData.append('diarization', elements.diarization.checked);
  formData.append('format', elements.formatSelect.value);
  formData.append('provider', elements.providerSelect.value);
  formData.append('sttModel', elements.sttModelInput.value.trim());
  formData.append('chatModel', elements.chatModelInput.value.trim());
  formData.append('darijaStrict', elements.darijaStrict.checked);
  formData.append('chunkMinutes', elements.chunkMinutes.value || '0');

  elements.startBtn.disabled = true;
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'فشل رفع الملف');
    }
    state.jobId = data.jobId;
    pollJob();
  } catch (error) {
    addLog(`❌ ${error.message}`, 'error');
    elements.startBtn.disabled = false;
  }
}

async function pollJob() {
  if (!state.jobId) return;
  try {
    const res = await fetch(`/api/job/${state.jobId}`);
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }

    elements.statusText.textContent = data.message || 'جاري المعالجة...';
    elements.progressFill.style.width = `${data.progress}%`;
    elements.progressPercent.textContent = `${data.progress}%`;
    elements.progressStage.textContent = data.status;

    if (data.logs && data.logs.length > elements.logList.children.length) {
      for (let i = elements.logList.children.length; i < data.logs.length; i += 1) {
        const entry = data.logs[i];
        addLog(entry.message, entry.type === 'err' ? 'error' : entry.type);
      }
    }

    if (data.status === 'completed') {
      addLog('✅ تم تجهيز النتائج.', 'ok');
      elements.downloadBtn.hidden = false;
      elements.startBtn.disabled = false;
      return;
    }

    if (data.status === 'error') {
      addLog(`❌ ${data.error || 'حدث خطأ أثناء المعالجة.'}`, 'error');
      elements.startBtn.disabled = false;
      return;
    }

    setTimeout(pollJob, 2000);
  } catch (error) {
    setTimeout(pollJob, 5000);
  }
}

function openModal() {
  elements.keyModal.classList.add('open');
  elements.keyResult.textContent = '';
  elements.keyResult.className = 'result';
  updateKeyHelp();
}

function closeModal() {
  elements.keyModal.classList.remove('open');
}

function updateKeyHelp() {
  const provider = elements.keyProvider.value;
  elements.keyHelp.textContent = providerHelp[provider] || '';
}

async function saveKey() {
  const provider = elements.keyProvider.value;
  const key = elements.keyInput.value.trim();
  if (!key) {
    elements.keyResult.textContent = 'المرجو إدخال المفتاح.';
    elements.keyResult.className = 'result error';
    return;
  }

  elements.saveKeyBtn.disabled = true;
  elements.saveKeyBtn.textContent = 'جارٍ التحقق...';

  try {
    const res = await fetch('/api/save-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطأ في المفتاح');
    }
    elements.keyResult.textContent = '✅ تم حفظ المفتاح بنجاح.';
    elements.keyResult.className = 'result ok';
    await refreshStatus();
    setTimeout(closeModal, 1200);
  } catch (error) {
    elements.keyResult.textContent = `❌ ${error.message}`;
    elements.keyResult.className = 'result error';
  } finally {
    elements.saveKeyBtn.disabled = false;
    elements.saveKeyBtn.textContent = 'حفظ وتجربة المفتاح';
  }
}

elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    elements.fileInput.click();
  }
});

elements.dropZone.addEventListener('dragover', event => {
  event.preventDefault();
  elements.dropZone.classList.add('dragover');
});

elements.dropZone.addEventListener('dragleave', () => {
  elements.dropZone.classList.remove('dragover');
});

elements.dropZone.addEventListener('drop', event => {
  event.preventDefault();
  elements.dropZone.classList.remove('dragover');
  const [file] = event.dataTransfer.files;
  if (file) setFile(file);
});

elements.fileInput.addEventListener('change', event => {
  const [file] = event.target.files;
  if (file) setFile(file);
});

elements.clearFile.addEventListener('click', () => {
  elements.fileInput.value = '';
  setFile(null);
});

elements.chunkMinutes.addEventListener('input', () => {
  elements.estimateTime.textContent = estimateDuration(state.file?.size, parseInt(elements.chunkMinutes.value, 10));
});

elements.providerSelect.addEventListener('change', () => {
  updateProviderHint();
  fetchModels();
  updateSummary();
  updateStartState();
});

elements.sttModelInput.addEventListener('input', updateSummary);
elements.chatModelInput.addEventListener('input', updateSummary);

elements.fetchModels.addEventListener('click', fetchModels);

elements.startBtn.addEventListener('click', startJob);

elements.downloadBtn.addEventListener('click', () => {
  if (state.jobId) window.location.href = `/api/download/${state.jobId}`;
});

elements.refreshStatus.addEventListener('click', refreshStatus);
elements.openKeyModal.addEventListener('click', openModal);
elements.closeKeyModal.addEventListener('click', closeModal);
elements.keyModal.addEventListener('click', event => {
  if (event.target === elements.keyModal) closeModal();
});

elements.keyProvider.addEventListener('change', updateKeyHelp);
elements.saveKeyBtn.addEventListener('click', saveKey);

refreshStatus();
fetchModels();
