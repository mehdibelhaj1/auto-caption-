/**
 * Darija Captions - Web UI Server v3.0
 * With API Management from UI
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

// Load env manually
async function loadEnv() {
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch (e) {}
}

// Save API key
async function saveApiKey(provider, key) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf-8');
  } catch (e) {}
  
  const keyName = provider.toUpperCase() + '_API_KEY';
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith(keyName));
  lines.push(`${keyName}=${key}`);
  
  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
  process.env[keyName] = key;
}

// Load env on startup
await loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Multer config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(os.tmpdir(), 'darija-uploads');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

const jobs = new Map();
const modelCache = new Map();

const PROVIDER_PRIORITY = ['gladia', 'assemblyai', 'groq', 'openrouter', 'gemini', 'openai', 'deepseek'];
const PROVIDER_DEFAULTS = {
  gladia: { sttModel: 'gladia-default', chatModel: 'groq' },
  assemblyai: { sttModel: 'assemblyai-default', chatModel: 'groq' },
  groq: { sttModel: 'whisper-large-v3', chatModel: 'llama-3.3-70b-versatile' },
  openrouter: { sttModel: 'google/gemini-2.0-flash-exp:free', chatModel: 'google/gemini-2.0-flash-exp:free' },
  gemini: { sttModel: 'gemini-1.5-flash', chatModel: 'gemini-1.5-flash' },
  openai: { sttModel: 'whisper-1', chatModel: 'gpt-4o-mini' },
  deepseek: { sttModel: null, chatModel: 'deepseek-chat' }
};

function resolveAutoProvider() {
  for (const provider of PROVIDER_PRIORITY) {
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    if (process.env[envKey]) {
      return provider;
    }
  }
  return null;
}

// Get configured APIs
function getAPIs() {
  const apis = [];
  
  // Gladia first - BEST FOR DIALECTS!
  if (process.env.GLADIA_API_KEY) {
    apis.push({
      name: 'gladia',
      label: 'Gladia (⭐ الأفضل! 10 ساعات مجاناً/شهر)',
      key: process.env.GLADIA_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: true,
      best: true
    });
  }
  
  // AssemblyAI
  if (process.env.ASSEMBLYAI_API_KEY) {
    apis.push({
      name: 'assemblyai',
      label: 'AssemblyAI ($50 مجاناً)',
      key: process.env.ASSEMBLYAI_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: false
    });
  }
  
  // Groq as secondary for chat
  if (process.env.GROQ_API_KEY?.startsWith('gsk_')) {
    apis.push({
      name: 'groq',
      label: 'Groq (مجاني)',
      key: process.env.GROQ_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: true
    });
  }
  
  if (process.env.OPENROUTER_API_KEY) {
    apis.push({
      name: 'openrouter',
      label: 'OpenRouter',
      key: process.env.OPENROUTER_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: true
    });
  }
  
  if (process.env.GEMINI_API_KEY) {
    apis.push({
      name: 'gemini',
      label: 'Gemini',
      key: process.env.GEMINI_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: true
    });
  }
  
  if (process.env.OPENAI_API_KEY?.startsWith('sk-')) {
    apis.push({
      name: 'openai',
      label: 'OpenAI',
      key: process.env.OPENAI_API_KEY.substring(0, 15) + '...',
      hasWhisper: true,
      free: false
    });
  }
  
  if (process.env.DEEPSEEK_API_KEY) {
    apis.push({
      name: 'deepseek',
      label: 'DeepSeek',
      key: process.env.DEEPSEEK_API_KEY.substring(0, 15) + '...',
      hasWhisper: false,
      free: false
    });
  }
  
  return apis;
}

// Test API
async function testAPI(provider, key) {
  const configs = {
    gladia: {
      url: 'https://api.gladia.io/v2/transcription',
      useGladiaKey: true
    },
    assemblyai: {
      url: 'https://api.assemblyai.com/v2/transcript',
      useAuthHeader: true
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/models',
      useKeyParam: false
    },
    gemini: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash',
      useKeyParam: true
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/models',
      useKeyParam: false
    },
    openai: {
      url: 'https://api.openai.com/v1/models',
      useKeyParam: false
    },
    deepseek: {
      url: 'https://api.deepseek.com/v1/models',
      useKeyParam: false
    }
  };
  
  const config = configs[provider];
  if (!config) return { success: false, error: 'Unknown provider' };
  
  const apiKey = key || process.env[provider.toUpperCase() + '_API_KEY'];
  if (!apiKey) return { success: false, error: 'No key' };
  
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    
    let url = config.url;
    let headers = {};
    
    if (config.useGladiaKey) {
      headers = { 'x-gladia-key': apiKey };
    } else if (config.useAuthHeader) {
      headers = { 'Authorization': apiKey };
    } else if (config.useKeyParam) {
      url = `${config.url}?key=${apiKey}`;
    } else {
      headers = { 'Authorization': `Bearer ${apiKey}` };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://darija-captions.local';
      }
    }
    
    const res = await fetch(url, {
      headers,
      signal: ctrl.signal
    });
    
    if (res.ok) return { success: true };
    if (res.status === 401 || res.status === 403) return { success: false, error: 'Invalid API key ❌' };
    if (res.status === 429) return { success: false, error: 'Rate limit 💰' };
    return { success: false, error: `Error ${res.status}` };
  } catch (e) {
    return { success: false, error: 'Connection failed 🌐' };
  }
}

async function fetchModelsForProvider(provider) {
  const cacheKey = provider;
  const cached = modelCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 60000) {
    return cached.data;
  }

  const defaults = PROVIDER_DEFAULTS[provider] || {};
  const envKey = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[envKey];

  if (!apiKey) {
    return { provider, models: [], source: 'missing_key', defaults };
  }

  if (provider === 'gladia' || provider === 'assemblyai') {
    return { provider, models: [], source: 'not_supported', defaults };
  }

  let url;
  let headers = {};

  if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  } else {
    const baseUrls = {
      openai: 'https://api.openai.com/v1/models',
      groq: 'https://api.groq.com/openai/v1/models',
      openrouter: 'https://openrouter.ai/api/v1/models',
      deepseek: 'https://api.deepseek.com/v1/models'
    };
    url = baseUrls[provider];
    headers = { Authorization: `Bearer ${apiKey}` };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://darija-captions.local';
      headers['X-Title'] = 'Darija Captions';
    }
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { provider, models: [], source: `error_${res.status}`, defaults };
    }
    const data = await res.json();
    let models = [];
    if (provider === 'gemini') {
      models = (data.models || []).map(model => model.name).sort();
    } else {
      models = (data.data || []).map(model => model.id).sort();
    }
    const payload = { provider, models, source: 'api', defaults };
    modelCache.set(cacheKey, { timestamp: now, data: payload });
    return payload;
  } catch (error) {
    return { provider, models: [], source: 'error', defaults };
  }
}

// Static UI
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', async (req, res) => {
  await loadEnv();
  const apis = getAPIs();
  
  const results = await Promise.all(apis.map(async api => {
    const result = await testAPI(api.name);
    return {
      ...api,
      status: result.success ? 'success' : 'error',
      statusMessage: result.success ? '✅ متصل' : result.error
    };
  }));
  
  res.json({ apis: results });
});

app.get('/api/models', async (req, res) => {
  await loadEnv();
  let provider = req.query.provider;
  if (!provider || provider === 'auto') {
    provider = resolveAutoProvider();
  }
  if (!provider) {
    return res.status(400).json({ error: 'No provider available' });
  }
  const result = await fetchModelsForProvider(provider);
  res.json(result);
});

app.post('/api/save-key', async (req, res) => {
  try {
    const { provider, key } = req.body;
    
    if (!provider || !key) {
      return res.status(400).json({ error: 'Missing data' });
    }
    
    // Validate key format
    if (provider === 'groq' && !key.startsWith('gsk_')) {
      return res.status(400).json({ error: 'Groq key must start with gsk_' });
    }
    if (provider === 'openai' && !key.startsWith('sk-')) {
      return res.status(400).json({ error: 'OpenAI key must start with sk-' });
    }
    if (provider === 'openrouter' && !key.startsWith('sk-or-')) {
      return res.status(400).json({ error: 'OpenRouter key must start with sk-or-' });
    }
    if ((provider === 'assemblyai' || provider === 'gladia') && key.length < 20) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    if ((provider === 'gemini' || provider === 'deepseek') && key.length < 20) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    
    const test = await testAPI(provider, key);
    if (!test.success) {
      return res.status(400).json({ error: test.error });
    }
    
    await saveApiKey(provider, key);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    const jobId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const outDir = path.join(os.tmpdir(), 'darija-output', jobId);
    await fs.mkdir(outDir, { recursive: true });
    
    const job = {
      id: jobId,
      status: 'processing',
      progress: 0,
      message: 'بدء المعالجة...',
      logs: [],
      inputPath: req.file.path,
      outputDir: outDir,
      options: {
        safeMode: req.body.safeMode === 'true',
        diarization: req.body.diarization === 'true',
        format: req.body.format || 'both',
        provider: req.body.provider !== 'auto' ? req.body.provider : null,
        sttModel: req.body.sttModel || null,
        chatModel: req.body.chatModel || null,
        darijaStrict: req.body.darijaStrict !== 'false',
        chunkMinutes: req.body.chunkMinutes ? parseInt(req.body.chunkMinutes, 10) : 0
      }
    };
    
    jobs.set(jobId, job);
    processJob(job);
    
    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json({
    status: job.status,
    progress: job.progress,
    message: job.message,
    logs: job.logs,
    error: job.error
  });
});

app.get('/api/download/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'completed') return res.status(404).json({ error: 'Not ready' });
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=darija-${job.id}.zip`);
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(job.outputDir, false);
  await archive.finalize();
});

async function processJob(job) {
  const log = (msg, type = 'info') => {
    job.logs.push({ message: msg, type, time: new Date().toISOString() });
  };
  
  try {
    const args = ['index.js', '--input', job.inputPath, '--out', job.outputDir, '--format', job.options.format];
    if (job.options.safeMode) args.push('--safeMode');
    if (job.options.diarization) args.push('--diarization');
    if (job.options.provider) args.push('--provider', job.options.provider);
    if (job.options.sttModel) args.push('--sttModel', job.options.sttModel);
    if (job.options.chatModel) args.push('--chatModel', job.options.chatModel);
    if (job.options.darijaStrict === false) args.push('--darijaStrict', 'false');
    if (job.options.chunkMinutes > 0) args.push('--chunkMinutes', String(job.options.chunkMinutes));
    
    log('🚀 بدء المعالجة...', 'info');
    job.progress = 10;
    
    const proc = spawn('node', args, { cwd: __dirname, env: process.env });
    
    proc.stdout.on('data', data => {
      const line = data.toString().trim();
      if (line) {
        log(line, 'info');
        if (line.includes('[1/8]')) job.progress = 12;
        else if (line.includes('[2/8]')) job.progress = 20;
        else if (line.includes('[3/8]')) job.progress = 30;
        else if (line.includes('[4/8]')) job.progress = 45;
        else if (line.includes('[5/8]')) job.progress = 62;
        else if (line.includes('[6/8]')) job.progress = 72;
        else if (line.includes('[7/8]')) job.progress = 86;
        else if (line.includes('[8/8]')) job.progress = 94;
        else if (line.includes('Pipeline completed')) job.progress = 100;
      }
    });
    
    proc.stderr.on('data', data => {
      const line = data.toString().trim();
      if (line && !line.includes('Warning')) log(line, 'err');
    });
    
    proc.on('close', async code => {
      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.message = 'تم بنجاح!';
        log('✅ اكتمل!', 'ok');
      } else {
        job.status = 'error';
        job.error = `فشل (code ${code})`;
        log('❌ فشل', 'err');
      }
      try { await fs.unlink(job.inputPath); } catch {}
    });
  } catch (e) {
    job.status = 'error';
    job.error = e.message;
    log('❌ ' + e.message, 'err');
  }
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎬 Darija Captions v3.0                         ║
║                                                   ║
║   🌐 http://localhost:${PORT}                       ║
║                                                   ║
║   ✨ Now with API management from UI!             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});
