#!/usr/bin/env node

/**
 * Darija Captions - Video → Darija Captions Tool
 * Extract, transcribe, clean and generate captions for Moroccan Darija videos
 * 
 * Supports: Gladia, AssemblyAI, Groq (FREE), OpenRouter, Gemini, OpenAI, DeepSeek
 * 
 * @author OKTOPIA
 * @version 2.0.0
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { createReadStream, existsSync, statSync } from 'fs';

// Load environment variables
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  supportedExtensions: ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.flv'],
  maxFileSizeMB: 2000,
  whisperMaxSizeMB: 25,
  tempDir: path.join(os.tmpdir(), 'darija-captions'),
  audioSampleRate: 16000,
  audioChannels: 1,
  maxCharsPerLine: 42,
  maxLinesPerBlock: 2,
  
  // Provider configs
  providers: {
    gladia: {
      baseUrl: 'https://api.gladia.io/v2',
      sttModel: 'gladia-default',
      envKey: 'GLADIA_API_KEY'
    },
    assemblyai: {
      baseUrl: 'https://api.assemblyai.com/v2',
      sttModel: 'assemblyai-default',
      envKey: 'ASSEMBLYAI_API_KEY',
      languageCode: 'ar'
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      sttModel: 'google/gemini-2.0-flash-exp:free',
      chatModel: 'google/gemini-2.0-flash-exp:free',
      envKey: 'OPENROUTER_API_KEY'
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      sttModel: 'gemini-1.5-flash',
      chatModel: 'gemini-1.5-flash',
      envKey: 'GEMINI_API_KEY'
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      sttModel: 'whisper-large-v3',
      chatModel: 'llama-3.3-70b-versatile',
      envKey: 'GROQ_API_KEY'
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      sttModel: 'whisper-1',
      chatModel: 'gpt-4o-mini',
      envKey: 'OPENAI_API_KEY'
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      sttModel: null,
      chatModel: 'deepseek-chat',
      envKey: 'DEEPSEEK_API_KEY'
    }
  }
};

const STT_AUTO_PRIORITY = ['gladia', 'assemblyai', 'groq', 'openai', 'gemini', 'openrouter'];
const CHAT_AUTO_PRIORITY = ['openai', 'groq', 'openrouter', 'gemini', 'deepseek'];
const AUDIO_MODEL_HINTS = ['whisper', 'gemini', 'audio', 'speech', 'transcribe'];

// Prompts
const PROMPTS = {
  // Main Darija conversion prompt - AGGRESSIVE 100% DARIJA!
  toDarija: `أنت مغربي من الدار البيضاء. حوّل هاد النص للدارجة المغربية 100%.

⚠️ مهم بزاف: ما تخلي حتى كلمة بالفصحى!

القاموس (فصحى ← دارجة):
أريد/أرغب = بغيت
أذهب/ذهبت = مشيت/غادي نمشي
ماذا/ما هو = شنو/أشنو
لماذا = علاش
كيف = كيفاش
أين = فين
من/الذي = اللي/شكون
هل = واش
نعم = آه/أيه
لا = لا/أوهو
الآن = دابا
سوف/سأ = غادي
كثير/جداً = بزاف
جيد/حسن = مزيان/واعر
سيء = خايب
لا شيء = والو
هكذا = هاكا/هاكدا
حسناً = واخا/يالاه
يوجد/هناك = كاين
ليس = ماشي
أعرف = كنعرف
لا أعرف = معرفتش/مكنعرفش
أفهم = كنفهم
لا أفهم = مافهمتش
أنظر/انظر = شوف
تعال = أجي/آجي
اذهب = سير
أعطني = عطيني
قل لي = گوليا/قولي
أخبرني = عيّطليا/قولي
معي = معايا
معك = معاك
أحتاج = خاصني
يمكن/يستطيع = يقدر/ممكن
أحب = كنبغي
لا أحب = ماكنبغيش
الناس = الناس
شيء = شي حاجة
ممتاز = خطير/واعر
جميل = زوين
قبيح = خايب
كبير = كبير
صغير = صغير
قليل = شوية
كثير = بزاف
مرحباً = السلام/أهلا
شكراً = الله يحفظك/شكراً
آسف = سمحليا
من فضلك = عافاك
لو سمحت = عافاك
أستطيع = نقدر
لا أستطيع = ما نقدرش
أظن/أعتقد = كنظن/كنحسب
ربما = يمكن/بلكي
بالتأكيد = أكيد
طبعاً = طبعاً/بيان
ممكن = واخا/يمكن
مستحيل = مستاحيل
سريع = بالزربة/فيسع
بطيء = بشوية
الآن = دابا
غداً = غدا
أمس = البارح
اليوم = اليوم
متى = إمتى/فوقاش
أين = فين
كم = شحال
لماذا = علاش
ماذا يحدث = شنو كاين/أش واقع
انتظر = تسنى/صبر

قواعد الأفعال المغربية:
- المضارع: كن + الفعل (كنشوف، كندير، كناكل، كنمشي)
- النفي: ما + كن + الفعل + ش (ماكنشوفش، ماكنديرش)
- المستقبل: غادي + ن + الفعل (غادي نمشي، غادي نشوف)
- الأمر: فعل مباشر (شوف، دير، كول، سير)

ملاحظات:
✅ خلي الكلمات الفرنسية كما هي (normal, bien, d'accord, voilà)
✅ حيّد التكرار والـ filler (آه، ممم، يعني يعني)
✅ خلي النص طبيعي كما كيهضرو المغاربة فالشارع

رجع غير النص بالدارجة، بلا شرح:`,

  clean: `صلّح هاد النص:
1. حيّد التكرار الزائد
2. زيد ترقيم خفيف (نقط، فواصل)
3. خليه طبيعي ومقروء

رجع غير النص المصلح:`,
  
  caption: `خرج caption قصير (1–2 سطور) بالدارجة المغربية 100%، ستايل ريلز/تيك توك، خفيف ومفهوم، و CTA بسيط، وزيد حتى 2 emojis. بلا فصحى!`,
  
  captionVariations: `من هاد النص، خرج 3 captions بالدارجة المغربية 100%:
1. neutral: عادي و مفهوم
2. hype: حماسي و منشط  
3. classy: أنيق و راقي

كل caption: 1-2 سطور، CTA خفيف، max 2 emojis.
رجع JSON:
{"neutral": "...", "hype": "...", "classy": "..."}`,

  safeMode: `بدّل الكلمات القوية بكلمات أخف، خلي المعنى. رجع النص فقط:`,

  diarization: `حلل النص وميّز المتكلمين. حط [Speaker A] أو [Speaker B] قبل كل جزء. رجع النص مع labels:`,

  mixedClean: `صلّح هاد النص بلا ما تبدّل لغة أي كلمة:
1) حيّد التكرار والتأتأة والفيلرز (آه، ممم، euh)
2) خليه مقروء بترقيم خفيف
3) ممنوع تبديل اللغة (العربية/الفرنسية/الإنجليزية) أو ترجمتها
4) خلّي code-switching كيف ما نطق المتكلم

رجع غير النص المصلّح.`,

  msaClean: `حوّل هاد النص للعربية الفصحى (MSA) بدون تغيير الكلمات غير العربية:
1) ممنوع تبديل الكلمات الفرنسية/الإنجليزية
2) خليه مقروء بترقيم خفيف
3) رجع غير النص المصلّح.`,

  darijaClean: `حوّل النص للدارجة المغربية مع احترام الكلمات غير العربية:
1) ممنوع الفصحى
2) خلّي الفرنسية/الإنجليزية كما هي
3) حيّد التكرار والتأتأة والفيلرز
رجع غير النص.`
};

const DARIJA_FORBIDDEN_WORDS = [
  'سوف', 'يجب', 'لذلك', 'هذا', 'هذه', 'الذي', 'التي', 'إن', 'قد', 'لن', 'لم',
  'ليس', 'حيث', 'بينما', 'كذلك', 'وبالتالي', 'من أجل', 'على الرغم', 'بالتالي',
  'بالرغم', 'لعل', 'لكن', 'ولكن', 'إذ', 'إذن', 'عندما', 'إلى', 'إلا أن'
];

const DARIJA_MARKERS = [
  'دابا', 'غادي', 'علاش', 'كيفاش', 'شنو', 'شكون', 'فين', 'واش', 'بزاف', 'مزيان',
  'ماشي', 'حيت', 'راه', 'واخا', 'يالاه', 'هادشي', 'ديال', 'ديالي', 'ديالك',
  'آش', 'إوا', 'بصح', 'هاكا', 'كن', 'كت', 'غادي', 'خاصني', 'بغيت'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.logs = [];
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] ${message}`;
    this.logs.push(entry);
    
    switch(level) {
      case 'INFO':
        console.log(chalk.blue('ℹ'), message);
        break;
      case 'SUCCESS':
        console.log(chalk.green('✓'), message);
        break;
      case 'WARN':
        console.log(chalk.yellow('⚠'), message);
        break;
      case 'ERROR':
        console.log(chalk.red('✗'), message);
        break;
      case 'DEBUG':
        console.log(chalk.gray('◦'), message);
        break;
    }
  }

  info(msg) { this.log('INFO', msg); }
  success(msg) { this.log('SUCCESS', msg); }
  warn(msg) { this.log('WARN', msg); }
  error(msg) { this.log('ERROR', msg); }
  debug(msg) { this.log('DEBUG', msg); }

  async save() {
    if (this.logFile) {
      await fs.writeFile(this.logFile, this.logs.join('\n'), 'utf-8');
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function isAudioCapableModel(provider, model) {
  if (!model) return false;
  const name = model.toLowerCase();
  if (provider === 'openrouter' || provider === 'gemini') {
    return AUDIO_MODEL_HINTS.some(hint => name.includes(hint));
  }
  if (provider === 'openai' || provider === 'groq') {
    return true;
  }
  return false;
}

function getSttProviderSuggestion() {
  return 'Use gladia, assemblyai, groq, openai, or gemini for STT.';
}

async function withRetry(fn, maxRetries = 3, delayMs = 2000, logger) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || String(error);
      
      const isRetryable = 
        errorMsg.includes('Connection error') ||
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('socket hang up') ||
        errorMsg.includes('network') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('fetch failed') ||
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503;
      
      if (isRetryable && attempt < maxRetries) {
        const waitTime = delayMs * attempt;
        if (logger) {
          logger.warn(`Attempt ${attempt}/${maxRetries} failed: ${errorMsg}. Retrying in ${waitTime/1000}s...`);
        }
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

async function checkFFmpeg() {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

function getFFmpegInstructions() {
  const platform = os.platform();
  
  const instructions = {
    win32: `
${chalk.yellow('FFmpeg Installation on Windows:')}
  Option 1: Using winget (recommended)
    ${chalk.cyan('winget install ffmpeg')}
  
  Option 2: Using Chocolatey
    ${chalk.cyan('choco install ffmpeg')}
`,
    darwin: `
${chalk.yellow('FFmpeg Installation on macOS:')}
  Using Homebrew:
    ${chalk.cyan('brew install ffmpeg')}
`,
    linux: `
${chalk.yellow('FFmpeg Installation on Linux:')}
  Ubuntu/Debian:
    ${chalk.cyan('sudo apt update && sudo apt install ffmpeg')}
`
  };

  return instructions[platform] || instructions.linux;
}

async function validateInput(inputPath, logger) {
  if (!existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (!CONFIG.supportedExtensions.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${CONFIG.supportedExtensions.join(', ')}`);
  }

  const stats = statSync(inputPath);
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > CONFIG.maxFileSizeMB) {
    throw new Error(`File too large: ${sizeMB.toFixed(2)}MB. Max: ${CONFIG.maxFileSizeMB}MB`);
  }

  try {
    await fs.access(inputPath, fs.constants.R_OK);
  } catch {
    throw new Error(`Cannot read file: ${inputPath}`);
  }

  logger.info(`Input validated: ${path.basename(inputPath)} (${sizeMB.toFixed(2)}MB)`);
  return { sizeMB, ext };
}

async function extractAudio(inputPath, outputPath, logger) {
  const spinner = ora('Extracting audio...').start();
  
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', String(CONFIG.audioSampleRate),
      '-ac', String(CONFIG.audioChannels),
      '-y',
      outputPath
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const stats = statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        spinner.succeed(`Audio extracted: ${sizeMB.toFixed(2)}MB`);
        logger.success(`Audio extracted to ${outputPath} (${sizeMB.toFixed(2)}MB)`);
        resolve(outputPath);
      } else {
        spinner.fail('Audio extraction failed');
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      spinner.fail('Audio extraction failed');
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const args = ['-i', audioPath, '-f', 'null', '-'];
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', () => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
      } else {
        resolve(0);
      }
    });

    proc.on('error', reject);
  });
}

async function splitAudio(audioPath, chunkMinutes, outputDir, logger) {
  const duration = await getAudioDuration(audioPath);
  const chunkSeconds = chunkMinutes * 60;
  const chunks = [];
  
  if (duration <= chunkSeconds) {
    return [{ path: audioPath, startTime: 0 }];
  }

  logger.info(`Splitting audio into ${Math.ceil(duration / chunkSeconds)} chunks...`);
  
  for (let start = 0; start < duration; start += chunkSeconds) {
    const chunkPath = path.join(outputDir, `chunk_${chunks.length}.wav`);
    
    await new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-ss', String(start),
        '-t', String(chunkSeconds),
        '-acodec', 'pcm_s16le',
        '-ar', String(CONFIG.audioSampleRate),
        '-ac', String(CONFIG.audioChannels),
        '-y',
        chunkPath
      ];

      const proc = spawn('ffmpeg', args);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Chunk split failed at ${start}s`));
      });
      proc.on('error', reject);
    });

    chunks.push({ path: chunkPath, startTime: start });
    logger.debug(`Created chunk ${chunks.length}: ${start}s - ${Math.min(start + chunkSeconds, duration)}s`);
  }

  return chunks;
}

// ============================================================================
// API CLIENT - Multi-provider support
// ============================================================================

class APIClient {
  constructor(provider, apiKey, logger, overrides = {}) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.logger = logger;
    this.config = CONFIG.providers[provider];
    this.chatModel = overrides.chatModel || this.config.chatModel;
    this.sttModel = overrides.sttModel || this.config.sttModel || this.config.whisperModel || this.config.transcriptionModel;
    
    if (!this.config) {
      throw new Error(`Unknown provider: ${provider}. Use: gladia, assemblyai, groq, openrouter, gemini, openai, or deepseek`);
    }
  }

  async fetch(endpoint, options = {}) {
    // Gemini uses different auth pattern
    if (this.provider === 'gemini') {
      return this.fetchGemini(endpoint, options);
    }
    
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // OpenRouter needs extra headers
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers
    };
    
    if (this.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://darija-captions.local';
      headers['X-Title'] = 'Darija Captions';
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      let errorMsg = `API Error ${response.status}: ${error}`;
      
      if (response.status === 401) {
        errorMsg = `Invalid API key for ${this.provider}. Check your ${this.config.envKey}`;
      } else if (response.status === 429) {
        errorMsg = `Rate limit exceeded on ${this.provider}. Wait a moment and try again.`;
      }
      
      throw new Error(errorMsg);
    }

    return response;
  }

  async fetchGemini(endpoint, options = {}) {
    const url = `${this.config.baseUrl}${endpoint}?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      // Include status code in error for retry logic
      throw new Error(`Gemini API Error ${response.status}: ${error}`);
    }

    return response;
  }

  async testConnection() {
    try {
      if (this.provider === 'gladia') {
        // Test Gladia with a simple request
        const response = await fetch('https://api.gladia.io/v2/transcription', {
          method: 'GET',
          headers: { 'x-gladia-key': this.apiKey }
        });
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key');
        }
        return true;
      }
      
      if (this.provider === 'assemblyai') {
        const response = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'GET',
          headers: { 'Authorization': this.apiKey }
        });
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        return true;
      }
      
      if (this.provider === 'gemini') {
        const response = await this.fetchGemini(`/models/${this.chatModel}`, {
          method: 'GET'
        });
        return true;
      }
      await this.fetch('/models');
      return true;
    } catch (error) {
      throw new Error(`Cannot connect to ${this.provider}: ${error.message}`);
    }
  }

  async transcribe(audioPath, options = {}) {
    const format = options.format || 'srt';
    const language = options.language || 'auto';
    // Gladia - BEST for Arabic dialects!
    if (this.provider === 'gladia') {
      return await this.transcribeWithGladia(audioPath, language);
    }
    
    // AssemblyAI - BEST for Arabic dialects!
    if (this.provider === 'assemblyai') {
      return await this.transcribeWithAssemblyAI(audioPath, language);
    }
    
    // Use OpenRouter for transcription (best - free Gemini via OpenRouter!)
    if (this.provider === 'openrouter') {
      return await this.transcribeWithOpenRouter(audioPath, language);
    }
    
    // Use Gemini for transcription (best for Darija!)
    if (this.provider === 'gemini') {
      return await this.transcribeWithGemini(audioPath, language);
    }
    
    if (!this.sttModel) {
      throw new Error(`${this.provider} doesn't support transcription. ${getSttProviderSuggestion()}`);
    }

    const audioBuffer = await fs.readFile(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', this.sttModel);
    if (language === 'ar') {
      formData.append('language', 'ar');
    }
    
    const darijaPrompt = `هاد الفيديو بالدارجة المغربية. كلمات شائعة: واش، كيفاش، علاش، فين، شكون، شنو، هادشي، ديالي، ديالك، مزيان، بزاف، دابا، غادي، كنت، كان، عندي، عندك، بغيت، خاصني، معايا، معاك، والو، يالاه، زعما، بصح، هاكا، واخا، إوا، أش، راه، كاين، ماشي، بلا، غير، حتى، كيدير، كتقول، كنقول، سير، جي، شوف`;
    formData.append('prompt', darijaPrompt);
    
    const responseFormat = this.getTranscriptionResponseFormat(format);
    if (responseFormat) {
      formData.append('response_format', responseFormat);
    }

    const response = await this.fetch('/audio/transcriptions', {
      method: 'POST',
      body: formData
    });

    return await this.handleTranscriptionResponse(response, responseFormat, audioPath);
  }

  getTranscriptionResponseFormat(format) {
    if (this.provider === 'groq') {
      return 'verbose_json';
    }
    if (this.provider === 'openai') {
      if (this.sttModel === 'whisper-1') {
        return format === 'vtt' ? 'vtt' : 'srt';
      }
      return 'json';
    }
    return null;
  }

  async handleTranscriptionResponse(response, responseFormat, audioPath) {
    if (responseFormat === 'verbose_json') {
      const json = await response.json();
      return this.verboseJsonToSRT(json);
    }

    if (responseFormat === 'json') {
      const json = await response.json();
      if (json.segments && json.segments.length) {
        return this.verboseJsonToSRT(json);
      }
      const duration = await this.getAudioDuration(audioPath);
      const text = json.text || '';
      return `1\n00:00:00,000 --> ${this.secondsToSRTTime(duration)}\n${text.trim()}\n`;
    }

    return await response.text();
  }

  // Gladia transcription - BEST for Arabic dialects & code-switching!
  async transcribeWithGladia(audioPath, language = 'auto') {
    const audioBuffer = await fs.readFile(audioPath);
    
    // Step 1: Upload audio
    if (this.logger) this.logger.info('Uploading audio to Gladia...');
    
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.wav');
    
    const uploadResponse = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': this.apiKey
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Gladia upload failed: ${error}`);
    }
    
    const { audio_url } = await uploadResponse.json();
    
    // Step 2: Start transcription
    if (this.logger) this.logger.info('Starting transcription...');
    
    const transcriptResponse = await fetch('https://api.gladia.io/v2/transcription', {
      method: 'POST',
      headers: {
        'x-gladia-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audio_url,
        // Enable code-switching for Darija (Arabic + French mix)
        enable_code_switching: true,
        // Detect language automatically
        detect_language: language !== 'ar',
        ...(language === 'ar' ? { language: 'ar' } : {}),
        // Get word-level timestamps
        output_format: 'json'
      })
    });
    
    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.text();
      throw new Error(`Gladia transcription start failed: ${error}`);
    }
    
    const { id: transcriptId, result_url } = await transcriptResponse.json();
    
    // Step 3: Poll for result
    if (this.logger) this.logger.info('Processing... (this may take a moment)');
    
    let result;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000));
      
      const pollResponse = await fetch(result_url, {
        headers: { 'x-gladia-key': this.apiKey }
      });
      
      result = await pollResponse.json();
      
      if (result.status === 'done') {
        break;
      } else if (result.status === 'error') {
        throw new Error(`Gladia error: ${result.error}`);
      }
      
      attempts++;
    }
    
    if (!result || result.status !== 'done') {
      throw new Error('Gladia transcription timeout');
    }
    
    // Step 4: Convert to SRT
    return this.gladiaToSRT(result);
  }
  
  gladiaToSRT(result) {
    const transcription = result.result?.transcription;
    
    if (!transcription || !transcription.utterances || !transcription.utterances.length) {
      const fullText = transcription?.full_transcript || '';
      return `1\n00:00:00,000 --> 00:00:10,000\n${fullText}\n`;
    }
    
    let srt = '';
    transcription.utterances.forEach((utt, i) => {
      const startTime = this.secondsToSRTTime(utt.start || 0);
      const endTime = this.secondsToSRTTime(utt.end || 0);
      const text = utt.text || '';
      srt += `${i + 1}\n${startTime} --> ${endTime}\n${text.trim()}\n\n`;
    });
    
    return srt.trim();
  }

  // AssemblyAI transcription - BEST for Arabic dialects!
  async transcribeWithAssemblyAI(audioPath, language = 'auto') {
    const audioBuffer = await fs.readFile(audioPath);
    
    // Step 1: Upload audio
    if (this.logger) this.logger.info('Uploading audio to AssemblyAI...');
    
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`AssemblyAI upload failed: ${error}`);
    }
    
    const { upload_url } = await uploadResponse.json();
    
    // Step 2: Start transcription
    if (this.logger) this.logger.info('Starting transcription...');
    
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        ...(language === 'ar' ? { language_code: 'ar' } : {}),
        // Enable punctuation and formatting
        punctuate: true,
        format_text: true
      })
    });
    
    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcription start failed: ${error}`);
    }
    
    const { id: transcriptId } = await transcriptResponse.json();
    
    // Step 3: Poll for result
    if (this.logger) this.logger.info('Processing... (this may take a moment)');
    
    let result;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
      
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'Authorization': this.apiKey }
      });
      
      result = await pollResponse.json();
      
      if (result.status === 'completed') {
        break;
      } else if (result.status === 'error') {
        throw new Error(`AssemblyAI error: ${result.error}`);
      }
      
      attempts++;
    }
    
    if (!result || result.status !== 'completed') {
      throw new Error('AssemblyAI transcription timeout');
    }
    
    // Step 4: Convert to SRT
    return this.assemblyAIToSRT(result);
  }
  
  assemblyAIToSRT(result) {
    if (!result.words || !result.words.length) {
      // No word-level timing, create single block
      const duration = (result.audio_duration || 10);
      return `1\n00:00:00,000 --> ${this.secondsToSRTTime(duration)}\n${result.text || ''}\n`;
    }
    
    // Group words into segments (~5 seconds each)
    const segments = [];
    let currentSegment = { words: [], start: 0, end: 0 };
    
    for (const word of result.words) {
      if (currentSegment.words.length === 0) {
        currentSegment.start = word.start / 1000;
      }
      
      currentSegment.words.push(word.text);
      currentSegment.end = word.end / 1000;
      
      // Split every ~5 seconds or at punctuation
      if (currentSegment.end - currentSegment.start >= 5 || 
          word.text.match(/[.!?،؟]$/)) {
        segments.push({
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.words.join(' ')
        });
        currentSegment = { words: [], start: 0, end: 0 };
      }
    }
    
    // Don't forget the last segment
    if (currentSegment.words.length > 0) {
      segments.push({
        start: currentSegment.start,
        end: currentSegment.end,
        text: currentSegment.words.join(' ')
      });
    }
    
    // Convert to SRT
    let srt = '';
    segments.forEach((seg, i) => {
      srt += `${i + 1}\n${this.secondsToSRTTime(seg.start)} --> ${this.secondsToSRTTime(seg.end)}\n${seg.text}\n\n`;
    });
    
    return srt.trim();
  }

  // Transcribe with OpenRouter (uses Gemini via OpenRouter - better rate limits!)
  async transcribeWithOpenRouter(audioPath, language = 'auto') {
    if (!isAudioCapableModel('openrouter', this.sttModel)) {
      throw new Error(`OpenRouter model "${this.sttModel}" does not accept audio input. ${getSttProviderSuggestion()}`);
    }
    const audioBuffer = await fs.readFile(audioPath);
    const base64Audio = audioBuffer.toString('base64');
    
    const duration = await this.getAudioDuration(audioPath);
    
    const prompt = `أنت خبير في الدارجة المغربية (اللهجة المغربية). استمع لهاد الأوديو وكتب بالضبط شنو قال المتكلم بالدارجة المغربية.

قواعد مهمة:
1. اكتب بالدارجة المغربية الطبيعية كما كيهضرو المغاربة، ماشي بالفصحى
2. استعمل الكلمات الدارجية بحال: واش، كيفاش، علاش، فين، شنو، دابا، غادي، بزاف، مزيان، والو، كاين، ماشي، بغيت، خاصني
3. إلا كانت كلمات بالفرنسية، خليها كما هي (عادي فالدارجة)
4. حيّد الـ filler sounds بحال: آه، أه، ممم، إيه
5. قسم النص لـ segments مع timestamps تقريبية
6. اللغة المطلوبة: ${language === 'ar' ? 'العربية' : 'تلقائي (دارجة + فرنسية + إنجليزية)'}

رجع النتيجة بهاد الformat JSON بلا أي شرح:
{
  "segments": [
    {"start": 0.0, "end": 3.5, "text": "النص هنا"},
    {"start": 3.5, "end": 7.0, "text": "النص هنا"}
  ],
  "full_text": "النص الكامل هنا"
}

مدة الأوديو: ${duration} ثانية`;

    // Retry logic for rate limits
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://darija-captions.local',
            'X-Title': 'Darija Captions'
          },
          body: JSON.stringify({
            model: this.sttModel,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'input_audio',
                  input_audio: {
                    data: base64Audio,
                    format: 'wav'
                  }
                }
              ]
            }],
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter API Error ${response.status}: ${error}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0]) {
          throw new Error('No transcription result from OpenRouter');
        }

        const text = data.choices[0].message.content;
        
        // Try to parse as JSON
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const json = JSON.parse(jsonMatch[0]);
            return this.geminiJsonToSRT(json, duration);
          }
        } catch (e) {
          // If not JSON, create simple SRT from text
        }
        
        // Fallback: create single-segment SRT
        return `1\n00:00:00,000 --> ${this.secondsToSRTTime(duration)}\n${text.trim()}\n`;
        
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || String(error);
        
        if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota')) {
          if (attempt < 3) {
            const waitTime = 20 * attempt;
            if (this.logger) {
              this.logger.warn(`Rate limit hit. Waiting ${waitTime}s before retry ${attempt}/3...`);
            }
            await new Promise(r => setTimeout(r, waitTime * 1000));
            continue;
          }
        }
        throw error;
      }
    }
    
    throw lastError;
  }

  // Transcribe with Gemini (best for Darija!)
  async transcribeWithGemini(audioPath, language = 'auto') {
    if (!isAudioCapableModel('gemini', this.sttModel)) {
      throw new Error(`Gemini model "${this.sttModel}" does not accept audio input. ${getSttProviderSuggestion()}`);
    }
    const audioBuffer = await fs.readFile(audioPath);
    const base64Audio = audioBuffer.toString('base64');
    
    // Get audio duration for better segment timing
    const duration = await this.getAudioDuration(audioPath);
    
    const prompt = `أنت خبير في الدارجة المغربية (اللهجة المغربية). استمع لهاد الأوديو وكتب بالضبط شنو قال المتكلم بالدارجة المغربية.

قواعد مهمة:
1. اكتب بالدارجة المغربية الطبيعية كما كيهضرو المغاربة، ماشي بالفصحى
2. استعمل الكلمات الدارجية بحال: واش، كيفاش، علاش، فين، شنو، دابا، غادي، بزاف، مزيان، والو، كاين، ماشي، بغيت، خاصني
3. إلا كانت كلمات بالفرنسية، خليها كما هي (عادي فالدارجة)
4. حيّد الـ filler sounds بحال: آه، أه، ممم، إيه
5. قسم النص لـ segments مع timestamps تقريبية
6. اللغة المطلوبة: ${language === 'ar' ? 'العربية' : 'تلقائي (دارجة + فرنسية + إنجليزية)'}

رجع النتيجة بهاد الformat JSON:
{
  "segments": [
    {"start": 0.0, "end": 3.5, "text": "النص هنا"},
    {"start": 3.5, "end": 7.0, "text": "النص هنا"}
  ],
  "full_text": "النص الكامل هنا"
}

مدة الأوديو: ${duration} ثانية
اسمع مزيان وكتب بالدارجة!`;

    // Retry logic for rate limits
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.fetchGemini(`/models/${this.sttModel}:generateContent`, {
          method: 'POST',
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'audio/wav',
                    data: base64Audio
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.2,
              topK: 40,
              topP: 0.95
            }
          })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) {
          throw new Error('No transcription result from Gemini');
        }

        const text = data.candidates[0].content.parts[0].text;
        
        // Try to parse as JSON, otherwise create simple SRT
        try {
          // Extract JSON from response (might have markdown code blocks)
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const json = JSON.parse(jsonMatch[0]);
            return this.geminiJsonToSRT(json, duration);
          }
        } catch (e) {
          // If not JSON, create simple SRT from text
        }
        
        // Fallback: create single-segment SRT
        return `1\n00:00:00,000 --> ${this.secondsToSRTTime(duration)}\n${text.trim()}\n`;
        
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || String(error);
        
        // Check if rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          if (attempt < 3) {
            // Wait before retry (40 seconds for rate limit)
            const waitTime = 40 * attempt;
            if (this.logger) {
              this.logger.warn(`Rate limit hit. Waiting ${waitTime}s before retry ${attempt}/3...`);
            }
            await new Promise(r => setTimeout(r, waitTime * 1000));
            continue;
          }
        }
        throw error;
      }
    }
    
    throw lastError;
  }

  async getAudioDuration(audioPath) {
    return new Promise((resolve) => {
      const args = ['-i', audioPath, '-f', 'null', '-'];
      const proc = spawn('ffmpeg', args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', () => {
        const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          resolve(hours * 3600 + minutes * 60 + seconds);
        } else {
          resolve(30); // Default 30 seconds
        }
      });

      proc.on('error', () => resolve(30));
    });
  }

  geminiJsonToSRT(json, defaultDuration) {
    if (!json.segments || !json.segments.length) {
      const text = json.full_text || json.text || '';
      return `1\n00:00:00,000 --> ${this.secondsToSRTTime(defaultDuration)}\n${text}\n`;
    }

    let srt = '';
    json.segments.forEach((seg, i) => {
      const startTime = this.secondsToSRTTime(seg.start || 0);
      const endTime = this.secondsToSRTTime(seg.end || defaultDuration);
      const text = seg.text || '';
      srt += `${i + 1}\n${startTime} --> ${endTime}\n${text.trim()}\n\n`;
    });
    
    return srt.trim();
  }

  // Convert Groq verbose_json to SRT format
  verboseJsonToSRT(json) {
    if (!json.segments || !json.segments.length) {
      // If no segments, create one block with full text
      return `1\n00:00:00,000 --> 00:00:10,000\n${json.text || ''}\n`;
    }

    let srt = '';
    json.segments.forEach((seg, i) => {
      const startTime = this.secondsToSRTTime(seg.start);
      const endTime = this.secondsToSRTTime(seg.end);
      srt += `${i + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n\n`;
    });
    
    return srt.trim();
  }

  secondsToSRTTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  async listModels() {
    if (this.provider === 'gladia' || this.provider === 'assemblyai') {
      return {
        models: ['provider-managed'],
        source: 'static'
      };
    }

    const response = this.provider === 'gemini'
      ? await this.fetchGemini('/models', { method: 'GET' })
      : await this.fetch('/models', { method: 'GET' });

    const data = await response.json();

    if (this.provider === 'gemini') {
      const models = (data.models || []).map(model => model.name).sort();
      return { models, source: 'api' };
    }

    const models = (data.data || []).map(model => model.id).sort();
    return { models, source: 'api' };
  }

  async chat(messages, options = {}) {
    // Handle Gemini chat differently
    if (this.provider === 'gemini') {
      return await this.chatWithGemini(messages, options);
    }
    
    const response = await this.fetch('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.chatModel,
        messages,
        temperature: options.temperature || 0.7,
        ...(options.response_format && { response_format: options.response_format })
      })
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async chatWithGemini(messages, options = {}) {
    // Convert OpenAI-style messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // If there's a system message, prepend it to the first user message
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg && contents.length > 0) {
      const firstUserIdx = contents.findIndex(c => c.role === 'user');
      if (firstUserIdx >= 0) {
        contents[firstUserIdx].parts[0].text = `${systemMsg.content}\n\n${contents[firstUserIdx].parts[0].text}`;
      }
      // Remove system message from contents
      const sysIdx = contents.findIndex(c => c.parts[0].text === systemMsg.content);
      if (sysIdx >= 0 && sysIdx !== firstUserIdx) {
        contents.splice(sysIdx, 1);
      }
    }

    // Filter out any remaining system messages
    const filteredContents = contents.filter(c => c.role !== 'system');

    // Retry logic for rate limits
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.fetchGemini(`/models/${this.chatModel}:generateContent`, {
          method: 'POST',
          body: JSON.stringify({
            contents: filteredContents,
            generationConfig: {
              temperature: options.temperature || 0.7
            }
          })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) {
          throw new Error('No response from Gemini');
        }

        return data.candidates[0].content.parts[0].text.trim();
        
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || String(error);
        
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          if (attempt < 3) {
            const waitTime = 30 * attempt;
            if (this.logger) {
              this.logger.warn(`Rate limit hit. Waiting ${waitTime}s before retry ${attempt}/3...`);
            }
            await new Promise(r => setTimeout(r, waitTime * 1000));
            continue;
          }
        }
        throw error;
      }
    }
    
    throw lastError;
  }
}

// ============================================================================
// TRANSCRIPTION & PROCESSING
// ============================================================================

async function transcribeAudio(client, audioPath, format = 'srt', language = 'auto', logger) {
  const spinner = ora(`Transcribing (${format})...`).start();
  
  try {
    const result = await withRetry(async () => {
      return await client.transcribe(audioPath, { format, language });
    }, 3, 3000, logger);
    
    spinner.succeed(`Transcription complete (${format})`);
    logger.success(`Transcribed audio in ${format} format`);
    
    return result;
  } catch (error) {
    spinner.fail('Transcription failed');
    throw error;
  }
}

function parseSRT(srt) {
  const blocks = [];
  const parts = srt.trim().split(/\n\n+/);

  for (const part of parts) {
    const lines = part.trim().split('\n');
    if (lines.length >= 3) {
      const index = parseInt(lines[0]);
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      
      if (timeMatch) {
        const start = parseTimestamp(timeMatch.slice(1, 5));
        const end = parseTimestamp(timeMatch.slice(5, 9));
        const text = lines.slice(2).join('\n');
        
        blocks.push({ index, start, end, text });
      }
    }
  }

  return blocks;
}

function parseTimestamp(parts) {
  const [h, m, s, ms] = parts.map(Number);
  return h * 3600 + m * 60 + s + ms / 1000;
}

function formatTimestamp(seconds, separator = ',') {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`;
}

function formatSRT(blocks) {
  return blocks.map((block, i) => {
    const startTS = formatTimestamp(block.start, ',');
    const endTS = formatTimestamp(block.end, ',');
    return `${i + 1}\n${startTS} --> ${endTS}\n${block.text}`;
  }).join('\n\n');
}

function mergeSRTChunks(srtContents, startTimes) {
  let merged = [];
  let indexOffset = 0;

  for (let i = 0; i < srtContents.length; i++) {
    const srt = srtContents[i];
    const offsetSeconds = startTimes[i];
    const blocks = parseSRT(srt);

    for (const block of blocks) {
      merged.push({
        index: indexOffset + block.index,
        start: block.start + offsetSeconds,
        end: block.end + offsetSeconds,
        text: block.text
      });
    }
    
    indexOffset += blocks.length;
  }

  return formatSRT(merged);
}

function optimizeSRT(srt) {
  const blocks = parseSRT(srt);
  const optimized = [];

  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i];
    let text = block.text;

    const lines = text.split('\n');
    const newLines = [];
    
    for (const line of lines) {
      if (line.length > CONFIG.maxCharsPerLine) {
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= CONFIG.maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
          } else {
            if (currentLine) newLines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) newLines.push(currentLine);
      } else {
        newLines.push(line);
      }
    }

    if (newLines.length > CONFIG.maxLinesPerBlock) {
      for (let j = 0; j < newLines.length; j += CONFIG.maxLinesPerBlock) {
        const chunk = newLines.slice(j, j + CONFIG.maxLinesPerBlock);
        const ratio = j / newLines.length;
        const endRatio = Math.min((j + CONFIG.maxLinesPerBlock) / newLines.length, 1);
        
        optimized.push({
          index: optimized.length + 1,
          start: block.start + (block.end - block.start) * ratio,
          end: block.start + (block.end - block.start) * endRatio,
          text: chunk.join('\n')
        });
      }
    } else {
      optimized.push({
        ...block,
        text: newLines.join('\n')
      });
    }
  }

  const merged = [];
  for (let i = 0; i < optimized.length; i++) {
    const current = optimized[i];
    const next = optimized[i + 1];
    
    if (next && 
        (current.end - current.start) < 0.5 && 
        (next.end - next.start) < 0.5 &&
        (current.text + ' ' + next.text).length <= CONFIG.maxCharsPerLine) {
      merged.push({
        index: merged.length + 1,
        start: current.start,
        end: next.end,
        text: current.text + ' ' + next.text
      });
      i++;
    } else {
      merged.push({
        ...current,
        index: merged.length + 1
      });
    }
  }

  return formatSRT(merged);
}

function srtToVTT(srt) {
  let vtt = 'WEBVTT\n\n';
  const blocks = parseSRT(srt);
  
  for (const block of blocks) {
    const startTS = formatTimestamp(block.start, '.');
    const endTS = formatTimestamp(block.end, '.');
    vtt += `${startTS} --> ${endTS}\n${block.text}\n\n`;
  }
  
  return vtt;
}

function srtToText(srt) {
  const blocks = parseSRT(srt);
  return blocks.map(b => b.text.replace(/\n/g, ' ')).join(' ');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countListHits(text, list) {
  let hits = 0;
  for (const term of list) {
    const pattern = new RegExp(`(^|[\\s\\n\\r\\t\\u200f\\u200e\\u061f،؛.!؟])${escapeRegex(term)}(?=$|[\\s\\n\\r\\t\\u200f\\u200e\\u061f،؛.!؟])`, 'g');
    const match = text.match(pattern);
    if (match) hits += match.length;
  }
  return hits;
}

function sanitizeText(text, { preserveLatin = true } = {}) {
  if (!text) return '';
  let cleaned = text;
  if (!preserveLatin) {
    cleaned = cleaned.replace(/[A-Za-z]/g, '');
  }
  cleaned = cleaned.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFA-Za-z0-9\s.,!؟،؛…\-–()"'«»]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function applyForbiddenWordFilter(text) {
  let cleaned = text;
  for (const term of DARIJA_FORBIDDEN_WORDS) {
    const pattern = new RegExp(`(^|[\\s\\n\\r\\t\\u200f\\u200e\\u061f،؛.!؟])${escapeRegex(term)}(?=$|[\\s\\n\\r\\t\\u200f\\u200e\\u061f،؛.!؟])`, 'g');
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function darijaQualityScore(text) {
  const forbiddenHits = countListHits(text, DARIJA_FORBIDDEN_WORDS);
  const markerHits = countListHits(text, DARIJA_MARKERS);
  const score = Math.max(0, 100 - forbiddenHits * 18 + markerHits * 6);
  return { score, forbiddenHits, markerHits };
}

function transliterateArabicToArabizi(text) {
  if (!text) return '';
  const map = {
    'ا': 'a',
    'أ': 'a',
    'إ': 'i',
    'آ': 'a',
    'ب': 'b',
    'ت': 't',
    'ث': 't',
    'ج': 'j',
    'ح': '7',
    'خ': '5',
    'د': 'd',
    'ذ': 'd',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ش': 'ch',
    'ص': 's',
    'ض': 'd',
    'ط': 't',
    'ظ': 'd',
    'ع': '3',
    'غ': 'gh',
    'ف': 'f',
    'ق': '9',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'w',
    'ي': 'y',
    'ى': 'a',
    'ة': 'a',
    'ء': '2',
    'ئ': '2',
    'ؤ': '2',
    'ّ': '',
    'َ': '',
    'ً': '',
    'ُ': '',
    'ٌ': '',
    'ِ': '',
    'ٍ': '',
    'ْ': '',
    'ـ': ''
  };

  let result = '';
  for (const char of text) {
    result += Object.prototype.hasOwnProperty.call(map, char) ? map[char] : char;
  }
  return result;
}

function applyScript(text, script) {
  if (script === 'latin') {
    return transliterateArabicToArabizi(text);
  }
  return text;
}

function basicMixedCleaning(text) {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/\b(aaa+|mmm+|euh+|uh+|erm+)\b/gi, '');
  cleaned = cleaned.replace(/\b(آه+|ممم+|إيه+|اه+)\b/g, '');
  cleaned = cleaned.replace(/\b(يعني)\s+\1\b/g, '$1');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function basicMSANormalization(text) {
  if (!text) return '';
  const replacements = [
    [/\bواش\b/g, 'هل'],
    [/\bبزاف\b/g, 'كثيرا'],
    [/\bشنو\b/g, 'ماذا'],
    [/\bعلاش\b/g, 'لماذا'],
    [/\bفين\b/g, 'أين'],
    [/\bدابا\b/g, 'الآن'],
    [/\bغادي\b/g, 'سوف']
  ];
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}

// Basic rule-based Darija conversion (fallback when no LLM available)
function basicDarijaConversion(text) {
  const replacements = [
    // Greetings
    [/\bمرحباً?\s*بكم\b/g, 'مرحبا بيكم'],
    [/\bأهلاً?\s*وسهلاً?\b/g, 'مرحبا'],
    [/\bمرحباً?\b/g, 'مرحبا'],
    [/\bالسلام عليكم\b/g, 'السلام'],
    
    // Common verbs and phrases
    [/\bأريد\s*أن\b/g, 'بغيت'],
    [/\bأريد\b/g, 'بغيت'],
    [/\bأرغب\b/g, 'بغيت'],
    [/\bأذهب\b/g, 'كنمشي'],
    [/\bذهبت\b/g, 'مشيت'],
    [/\bسأذهب\b/g, 'غادي نمشي'],
    [/\bستجدون\b/g, 'غادي تلقاو'],
    [/\bستجد\b/g, 'غادي تلقى'],
    [/\bسنجد\b/g, 'غادي نلقاو'],
    [/\bسأجد\b/g, 'غادي نلقى'],
    [/\bتجدون\b/g, 'كتلقاو'],
    [/\bنجد\b/g, 'كنلقاو'],
    [/\bأجد\b/g, 'كنلقى'],
    
    // Questions
    [/\bماذا\b/g, 'شنو'],
    [/\bما\s*هو\b/g, 'شنو'],
    [/\bما\s*هي\b/g, 'شنو'],
    [/\bلماذا\b/g, 'علاش'],
    [/\bكيف\b/g, 'كيفاش'],
    [/\bأين\b/g, 'فين'],
    [/\bهل\b/g, 'واش'],
    [/\bمتى\b/g, 'إمتى'],
    [/\bكم\b/g, 'شحال'],
    [/\bمن\s*هو\b/g, 'شكون'],
    
    // Time
    [/\bالآن\b/g, 'دابا'],
    [/\bسوف\b/g, 'غادي'],
    [/\bسأ/g, 'غادي ن'],
    [/\bسن/g, 'غادي ن'],
    [/\bغداً\b/g, 'غدا'],
    [/\bأمس\b/g, 'البارح'],
    
    // Quantities
    [/\bكثير(اً)?\b/g, 'بزاف'],
    [/\bجداً?\b/g, 'بزاف'],
    [/\bقليل(اً)?\b/g, 'شوية'],
    
    // Adjectives
    [/\bجيد\b/g, 'مزيان'],
    [/\bحسن\b/g, 'مزيان'],
    [/\bممتاز\b/g, 'واعر'],
    [/\bجميل\b/g, 'زوين'],
    [/\bسيء\b/g, 'خايب'],
    
    // Negation & affirmation
    [/\bلا\s*شيء\b/g, 'والو'],
    [/\bليس\b/g, 'ماشي'],
    [/\bلست\b/g, 'ماشي'],
    [/\bحسناً?\b/g, 'واخا'],
    [/\bنعم\b/g, 'آه'],
    [/\bطبعاً\b/g, 'طبعا'],
    
    // Existence
    [/\bيوجد\b/g, 'كاين'],
    [/\bتوجد\b/g, 'كاينة'],
    [/\bهناك\b/g, 'كاين'],
    
    // Knowledge
    [/\bلا\s*أعرف\b/g, 'معرفتش'],
    [/\bأعرف\b/g, 'كنعرف'],
    [/\bلا\s*أفهم\b/g, 'مافهمتش'],
    [/\bأفهم\b/g, 'كنفهم'],
    
    // Commands
    [/\bأنظر\b/g, 'شوف'],
    [/\bانظر\b/g, 'شوف'],
    [/\bتعال\b/g, 'أجي'],
    [/\bاذهب\b/g, 'سير'],
    [/\bإذهب\b/g, 'سير'],
    [/\bأعطني\b/g, 'عطيني'],
    [/\bأخبرني\b/g, 'قولي'],
    [/\bقل\s*لي\b/g, 'قولي'],
    [/\bانتظر\b/g, 'تسنى'],
    
    // Pronouns & prepositions
    [/\bمعي\b/g, 'معايا'],
    [/\bمعك\b/g, 'معاك'],
    [/\bمعه\b/g, 'معاه'],
    [/\bمعها\b/g, 'معاها'],
    [/\bلدي\b/g, 'عندي'],
    [/\bلديك\b/g, 'عندك'],
    [/\bأحتاج\b/g, 'خاصني'],
    [/\bيمكن(ني)?\b/g, 'نقدر'],
    [/\bأستطيع\b/g, 'نقدر'],
    [/\bالذي\b/g, 'اللي'],
    [/\bالتي\b/g, 'اللي'],
    
    // Numbers (context)
    [/\bالخمسة\b/g, 'خمسة'],
    [/\bالعشرة\b/g, 'عشرة'],
    [/\bالأربعون\b/g, 'ربعين'],
    [/\bأربعون\b/g, 'ربعين'],
    
    // Channel/video context
    [/\bقناة\b/g, 'قناة'],
    [/\bحلقة\b/g, 'حلقة'],
    [/\bنقوم\s*ب/g, 'غادي ن'],
    [/\bتحضير/g, 'تحضير'],
    [/\bنضمن/g, 'نضمنو'],
    [/\bلكي\b/g, 'باش'],
    
    // Remove filler
    [/\bآه+\b/g, ''],
    [/\bإيه+\b/g, ''],
    [/\bممم+\b/g, ''],
    [/\bأه+\b/g, ''],
    [/\bيعني\s*يعني\b/g, 'يعني'],
    
    // Clean up extra spaces
    [/\s+/g, ' ']
  ];
  
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  return result.trim();
}

async function enforceDarijaStrictText(client, text, logger, maxRetries = 2) {
  let enforced = text;
  let attempt = 0;
  while (attempt <= maxRetries) {
    enforced = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: `أنت مدقق دارجة صارم. ممنوع الفصحى، وخلي الكلمات غير العربية (فرنسية/إنجليزية) كما هي بلا تغيير.
قواعد صارمة:
- حيّد أي فصحى (سوف، يجب، لذلك، هذا، هذه، الذي، التي، إن، قد، لن، لم، ليس، حيث، بينما، كذلك، وبالتالي، من أجل، على الرغم)
- رجع غير النص`
        },
        {
          role: 'user',
          content: `صحّح هاد النص للدارجة 100% وبلا فصحى:\n\n${enforced}`
        }
      ], { temperature: 0.2 });
    }, 3, 2000, logger);

    enforced = sanitizeText(enforced, { preserveLatin: true });
    enforced = applyForbiddenWordFilter(enforced);

    const { score } = darijaQualityScore(enforced);
    if (score >= 70) {
      return enforced;
    }
    attempt += 1;
  }
  return enforced;
}

async function cleanTranscript(client, text, logger, options) {
  const { safeMode, darijaStrict, style, script } = options;
  const spinner = ora(`Cleaning transcript (${style})...`).start();

  try {
    let cleanedText = text;

    if (style === 'mixed') {
      spinner.text = 'تنظيف النص المختلط...';
      cleanedText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: 'أنت مدقق نصوص. ممنوع تبديل اللغة أو ترجمة الكلمات.'
          },
          {
            role: 'user',
            content: `${PROMPTS.mixedClean}\n\n${text}`
          }
        ], { temperature: 0.2 });
      }, 3, 3000, logger);
    } else if (style === 'msa') {
      spinner.text = 'توحيد النص إلى الفصحى...';
      cleanedText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: 'حوّل النص إلى العربية الفصحى مع الحفاظ على الكلمات غير العربية كما هي.'
          },
          {
            role: 'user',
            content: `${PROMPTS.msaClean}\n\n${text}`
          }
        ], { temperature: 0.2 });
      }, 3, 3000, logger);
    } else {
      spinner.text = 'تحويل للدارجة المغربية...';
      let darijaText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: `أنت مغربي من كازا. كتحوّل أي نص للدارجة المغربية 100%.

قواعد صارمة:
- ما تخلي حتى كلمة فصحى واحدة
- استعمل الدارجة كما كيهضرو الناس فالشارع
- خلي الكلمات الفرنسية والإنجليزية كما هي
- رجع غير النص، بلا شرح`
          },
          {
            role: 'user',
            content: `${PROMPTS.toDarija}\n\nالنص:\n${text}`
          }
        ], { temperature: 0.3 });
      }, 3, 3000, logger);

      spinner.text = 'تأكد من الدارجة 100%...';
      darijaText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: 'أنت مدقق دارجة مغربية. بدل أي كلمة فصحى باقية مع الحفاظ على الكلمات غير العربية.'
          },
          {
            role: 'user',
            content: `شوف هاد النص وبدّل أي كلمة فصحى باقية للدارجة المغربية. رجع غير النص:\n\n${darijaText}`
          }
        ], { temperature: 0.2 });
      }, 3, 3000, logger);

      spinner.text = 'تنظيف النص...';
      cleanedText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: 'نظّف النص: حيّد التكرار، زيد ترقيم خفيف. رجع غير النص.'
          },
          {
            role: 'user',
            content: `${PROMPTS.darijaClean}\n\n${darijaText}`
          }
        ], { temperature: 0.2 });
      }, 3, 3000, logger);

      if (darijaStrict) {
        spinner.text = 'تشديد الدارجة...';
        cleanedText = await enforceDarijaStrictText(client, cleanedText, logger);
      }
    }

    if (safeMode) {
      spinner.text = 'تطبيق الوضع الآمن...';
      cleanedText = await withRetry(async () => {
        return await client.chat([
          { role: 'user', content: `${PROMPTS.safeMode}\n\n${cleanedText}` }
        ], { temperature: 0.2 });
      }, 3, 2000, logger);
    }

    cleanedText = sanitizeText(cleanedText, { preserveLatin: true });
    cleanedText = applyScript(cleanedText, script);

    spinner.succeed(`✅ تم تنظيف النص (${style})`);
    logger.success(`Transcript cleaned (${style})`);

    return cleanedText;
  } catch (error) {
    spinner.fail('فشل تنظيف النص');
    throw error;
  }
}

function getCaptionPrompt(style) {
  if (style === 'mixed') {
    return 'خرج caption قصير (1–2 سطور) بنفس أسلوب النص الأصلي بدون ترجمة. خلّي أي كلمات فرنسية/إنجليزية كما هي، و CTA بسيط مع 1-2 emojis.';
  }
  if (style === 'msa') {
    return 'اكتب caption قصير (1–2 سطور) بالعربية الفصحى بدون تغيير الكلمات غير العربية، مع CTA بسيط و 1-2 emojis.';
  }
  return PROMPTS.caption;
}

function getCaptionVariationsPrompt(style) {
  if (style === 'mixed') {
    return `من هاد النص، خرج 3 captions بنفس أسلوب الكلام (دارجة + فرنسي/إنجليزي كما هو):
1. neutral: عادي و مفهوم
2. hype: حماسي و منشط
3. classy: أنيق و راقي

كل caption: 1-2 سطور، CTA خفيف، max 2 emojis.
رجع JSON:
{"neutral": "...", "hype": "...", "classy": "..."}`;
  }
  if (style === 'msa') {
    return `من هاد النص، خرج 3 captions بالعربية الفصحى بدون تغيير الكلمات غير العربية:
1. neutral: عادي و مفهوم
2. hype: حماسي و منشط
3. classy: أنيق و راقي

كل caption: 1-2 سطور، CTA خفيف، max 2 emojis.
رجع JSON:
{"neutral": "...", "hype": "...", "classy": "..."}`;
  }
  return PROMPTS.captionVariations;
}

async function generateCaptions(client, text, logger, options) {
  const { style, script } = options;
  const spinner = ora('Generating captions...').start();
  
  try {
    const caption = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: 'أنت خبير في كتابة captions لمنصات التواصل الاجتماعي.'
        },
        {
          role: 'user',
          content: `${getCaptionPrompt(style)}\n\nالنص:\n${text}`
        }
      ], { temperature: 0.7 });
    }, 3, 2000, logger);

    spinner.text = 'Generating variations...';
    let variations;
    
    try {
      const variationsText = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: 'أنت خبير في كتابة captions. رجع دائما JSON صالح بدون أي نص إضافي.'
          },
          {
            role: 'user',
            content: `${getCaptionVariationsPrompt(style)}\n\nالنص:\n${text}`
          }
        ], { temperature: 0.8 });
      }, 3, 2000, logger);
      
      // Try to extract JSON from response
      const jsonMatch = variationsText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      variations = {
        neutral: caption,
        hype: caption + ' 🔥',
        classy: caption
      };
    }

    const finalCaption = applyScript(caption, script);
    const finalVariations = Object.fromEntries(
      Object.entries(variations).map(([key, value]) => [key, applyScript(value, script)])
    );

    spinner.succeed('Captions generated');
    logger.success('Captions generated successfully');
    
    return { caption: finalCaption, variations: finalVariations };
  } catch (error) {
    spinner.fail('Caption generation failed');
    throw error;
  }
}

async function applyDiarization(client, text, logger) {
  const spinner = ora('Applying speaker diarization (heuristic)...').start();
  
  try {
    const result = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: 'أنت محلل نصوص. حاول تميز بين المتكلمين بناء على السياق والأسلوب.'
        },
        {
          role: 'user',
          content: `${PROMPTS.diarization}\n\n${text}`
        }
      ], { temperature: 0.3 });
    }, 3, 2000, logger);

    spinner.succeed('Speaker diarization applied (heuristic)');
    logger.warn('Note: Speaker diarization is heuristic-based');
    
    return result;
  } catch (error) {
    spinner.fail('Diarization failed');
    throw error;
  }
}

async function cleanSubtitleBlock(client, blockText, logger, options) {
  const { style, darijaStrict, script } = options;
  let cleaned = blockText;

  if (style === 'mixed') {
    cleaned = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: 'نظّف النص بدون تغيير اللغة. ممنوع ترجمة أو تبديل كلمات.'
        },
        {
          role: 'user',
          content: `${PROMPTS.mixedClean}\n\n${blockText}`
        }
      ], { temperature: 0.2 });
    }, 3, 2000, logger);
  } else if (style === 'msa') {
    cleaned = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: 'حوّل النص إلى الفصحى مع الحفاظ على الكلمات غير العربية.'
        },
        {
          role: 'user',
          content: `${PROMPTS.msaClean}\n\n${blockText}`
        }
      ], { temperature: 0.2 });
    }, 3, 2000, logger);
  } else {
    const passA = await withRetry(async () => {
      return await client.chat([
        {
          role: 'system',
          content: 'أنت كاتب دارجة. حوّل النص للدارجة المغربية الطبيعية مع الحفاظ على الكلمات غير العربية.'
        },
        {
          role: 'user',
          content: `نص:\n${blockText}`
        }
      ], { temperature: 0.25 });
    }, 3, 2000, logger);

    if (!darijaStrict) {
      cleaned = sanitizeText(passA, { preserveLatin: true }) || blockText;
    } else {
      let enforced = await withRetry(async () => {
        return await client.chat([
          {
            role: 'system',
            content: `أنت مدقق دارجة صارم. ممنوع الفصحى وخلي الكلمات الفرنسية/الإنجليزية كما هي.
قواعد:
- ممنوع هاد الكلمات: ${DARIJA_FORBIDDEN_WORDS.join('، ')}
- استعمل الدارجة: ${DARIJA_MARKERS.slice(0, 10).join('، ')}`
          },
          {
            role: 'user',
            content: `صحّح هاد النص للدارجة الصارمة:\n${passA}`
          }
        ], { temperature: 0.2 });
      }, 3, 2000, logger);

      enforced = sanitizeText(enforced, { preserveLatin: true });
      enforced = applyForbiddenWordFilter(enforced);

      let { score } = darijaQualityScore(enforced);
      let retries = 0;
      const maxRetries = 2;
      while (score < 70 && retries < maxRetries) {
        enforced = await withRetry(async () => {
          return await client.chat([
            {
              role: 'system',
              content: 'عاود صحّح النص للدارجة الصارمة مع الحفاظ على الكلمات غير العربية.'
            },
            {
              role: 'user',
              content: enforced
            }
          ], { temperature: 0.2 });
        }, 3, 2000, logger);

        enforced = sanitizeText(enforced, { preserveLatin: true });
        enforced = applyForbiddenWordFilter(enforced);
        ({ score } = darijaQualityScore(enforced));
        retries += 1;
      }

      cleaned = enforced || blockText;
    }
  }

  cleaned = sanitizeText(cleaned, { preserveLatin: true }) || blockText;
  cleaned = applyScript(cleaned, script);
  return cleaned || blockText;
}

// Generate cleaned SRT subtitles (style-aware)
async function generateStyledSRT(client, srtContent, logger, options) {
  const blocks = parseSRT(srtContent);
  const cleanedBlocks = [];

  for (const block of blocks) {
    try {
      const cleanedText = await cleanSubtitleBlock(client, block.text, logger, options);
      cleanedBlocks.push({ ...block, text: cleanedText || block.text });
    } catch (error) {
      cleanedBlocks.push(block);
    }
  }

  return formatSRT(cleanedBlocks);
}

async function cleanup(tempDir, keepTemp, logger) {
  if (keepTemp) {
    logger.info(`Keeping temp files at: ${tempDir}`);
    return;
  }

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    logger.debug('Temp files cleaned up');
  } catch (error) {
    logger.warn(`Could not clean temp files: ${error.message}`);
  }
}

// ============================================================================
// DETECT AVAILABLE API KEY
// ============================================================================

function getProviderEnvKey(provider) {
  return CONFIG.providers[provider]?.envKey;
}

function getProviderKey(provider) {
  const envKey = getProviderEnvKey(provider);
  return envKey ? process.env[envKey] : null;
}

function detectSttProvider(sttModelOverride) {
  for (const provider of STT_AUTO_PRIORITY) {
    const apiKey = getProviderKey(provider);
    if (!apiKey) continue;

    if (provider === 'openrouter') {
      const model = sttModelOverride || CONFIG.providers.openrouter?.sttModel;
      if (!isAudioCapableModel('openrouter', model)) {
        continue;
      }
    }

    return { provider, key: apiKey };
  }
  return null;
}

function detectChatProvider(preferredProvider) {
  if (preferredProvider) {
    const apiKey = getProviderKey(preferredProvider);
    if (apiKey && CONFIG.providers[preferredProvider]?.chatModel) {
      return { provider: preferredProvider, key: apiKey };
    }
  }

  for (const provider of CHAT_AUTO_PRIORITY) {
    const apiKey = getProviderKey(provider);
    if (apiKey && CONFIG.providers[provider]?.chatModel) {
      return { provider, key: apiKey };
    }
  }

  return null;
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipeline(options) {
  const startTime = Date.now();
  
  await fs.mkdir(options.out, { recursive: true });
  
  const logger = new Logger(path.join(options.out, 'run.log'));
  
  const tempDir = path.join(CONFIG.tempDir, Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });
  
  let exitCode = 0;

  try {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  Darija Captions v2.0 - Starting Pipeline');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`Input: ${options.input}`);
    logger.info(`Output: ${options.out}`);

    // Step 1: Check FFmpeg
    logger.info('\n[1/8] Checking FFmpeg...');
    const hasFFmpeg = await checkFFmpeg();
    if (!hasFFmpeg) {
      console.log(getFFmpegInstructions());
      throw new Error('FFmpeg is not installed.');
    }
    logger.success('FFmpeg is available');

    // Step 2: Validate input
    logger.info('\n[2/8] Validating input...');
    const inputPath = path.resolve(options.input);
    await validateInput(inputPath, logger);

    // Step 3: Initialize API
    logger.info('\n[3/8] Initializing API...');
    
    // Detect or use specified provider
    let provider = options.provider === 'auto' ? null : options.provider;
    let sttProvider = options.sttProvider || provider;
    let chatProvider = options.chatProvider || provider;
    let sttKey;
    let chatKey;

    if (sttProvider === 'auto') sttProvider = null;
    if (chatProvider === 'auto') chatProvider = null;

    if (sttProvider) {
      const providerConfig = CONFIG.providers[sttProvider];
      if (!providerConfig) {
        throw new Error(`Unknown STT provider: ${sttProvider}`);
      }
      if (!providerConfig.sttModel) {
        throw new Error(`${sttProvider} doesn't support transcription. ${getSttProviderSuggestion()}`);
      }
      sttKey = getProviderKey(sttProvider);
      if (!sttKey) {
        throw new Error(`${providerConfig.envKey} not found for STT provider ${sttProvider}`);
      }
    } else {
      const detected = detectSttProvider(options.sttModel);
      if (!detected) {
        console.log(chalk.yellow(`
╔════════════════════════════════════════════════════════════════╗
║  No STT API key found! Add one of these to your .env file:     ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ${chalk.green('GLADIA_API_KEY=gladia_...')}   ← Best dialects              ║
║  ${chalk.green('ASSEMBLYAI_API_KEY=...')}      ← Great Arabic STT           ║
║  ${chalk.green('GROQ_API_KEY=gsk_...')}         ← FREE (recommended)         ║
║  ${chalk.gray('OPENAI_API_KEY=sk-...')}         ← Paid                       ║
║  ${chalk.gray('GEMINI_API_KEY=...')}            ← Audio-capable              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`));
        throw new Error('No STT API key configured. Configure an STT-capable provider.');
      }
      sttProvider = detected.provider;
      sttKey = detected.key;
    }

    if (sttProvider === 'openrouter') {
      const candidateModel = options.sttModel || CONFIG.providers.openrouter?.sttModel;
      if (!isAudioCapableModel('openrouter', candidateModel)) {
        throw new Error(`OpenRouter STT model "${candidateModel}" is not audio-capable. ${getSttProviderSuggestion()}`);
      }
    }

    if (!chatProvider) {
      const detectedChat = detectChatProvider(provider || sttProvider);
      if (detectedChat) {
        chatProvider = detectedChat.provider;
        chatKey = detectedChat.key;
      }
    } else {
      const providerConfig = CONFIG.providers[chatProvider];
      if (!providerConfig) {
        throw new Error(`Unknown chat provider: ${chatProvider}`);
      }
      chatKey = getProviderKey(chatProvider);
      if (!chatKey) {
        throw new Error(`${providerConfig.envKey} not found for chat provider ${chatProvider}`);
      }
    }

    const sttModel = options.sttModel || CONFIG.providers[sttProvider]?.sttModel;
    const chatModel = options.chatModel || options.model || CONFIG.providers[chatProvider]?.chatModel;

    logger.info(`STT provider: ${chalk.cyan(sttProvider.toUpperCase())}`);
    logger.info(`STT base URL: ${CONFIG.providers[sttProvider]?.baseUrl}`);
    logger.info(`STT model: ${sttModel || 'default'}`);
    logger.info(`Chat provider: ${chatProvider ? chalk.cyan(chatProvider.toUpperCase()) : 'none'}`);
    logger.info(`Chat model: ${chatModel || 'default'}`);

    const client = new APIClient(sttProvider, sttKey, logger, { sttModel, chatModel });
    const responseFormat = client.getTranscriptionResponseFormat('srt') || 'provider-default';
    logger.info(`Transcription response_format: ${responseFormat}`);
    logger.info(`Diarization: ${options.diarization ? 'true' : 'false'}`);
    logger.info(`chunkMinutes: ${options.chunkMinutes}`);
    logger.info(`Format: ${options.format}`);
    logger.info(`Style: ${options.style}`);
    logger.info(`Script: ${options.script}`);
    logger.info(`Language: ${options.lang}`);

    if (options.sttModel && (sttProvider === 'gladia' || sttProvider === 'assemblyai')) {
      logger.warn(`STT model override is not supported for ${sttProvider}. Using default.`);
    }
    
    // For Gladia/AssemblyAI, we need a secondary client for chat (Darija conversion)
    let chatClient = null;
    if (chatProvider && chatKey) {
      chatClient = new APIClient(chatProvider, chatKey, logger, { chatModel });
    } else {
      logger.warn('No chat provider available. Cleaning will be basic.');
    }
    
    // Test connection
    logger.info('Testing API connection...');
    await client.testConnection();
    logger.success(`${sttProvider.toUpperCase()} STT API connected`);

    if (chatClient && chatProvider !== sttProvider) {
      logger.info('Testing chat API connection...');
      await chatClient.testConnection();
      logger.success(`${chatProvider.toUpperCase()} Chat API connected`);
    }

    // Step 4: Extract audio
    logger.info('\n[4/8] Extracting audio...');
    const audioPath = path.join(tempDir, 'audio.wav');
    await extractAudio(inputPath, audioPath, logger);

    // Step 5: Transcribe
    logger.info('\n[5/8] Transcribing audio...');
    let srtContent;
    
    if (options.chunkMinutes > 0) {
      const chunks = await splitAudio(audioPath, options.chunkMinutes, tempDir, logger);
      const srtContents = [];
      const startTimes = [];

      for (let i = 0; i < chunks.length; i++) {
        logger.info(`Transcribing chunk ${i + 1}/${chunks.length}...`);
        const chunkSRT = await transcribeAudio(client, chunks[i].path, 'srt', options.lang, logger);
        srtContents.push(chunkSRT);
        startTimes.push(chunks[i].startTime);
      }

      srtContent = mergeSRTChunks(srtContents, startTimes);
    } else {
      srtContent = await transcribeAudio(client, audioPath, 'srt', options.lang, logger);
    }

    logger.info('\n[6/8] Optimizing subtitles...');
    srtContent = optimizeSRT(srtContent);

    // Save SRT
    if (options.format === 'srt' || options.format === 'both') {
      const srtPath = path.join(options.out, 'subtitles.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');
      logger.success(`Saved: subtitles.srt`);
    }

    // Save VTT
    if (options.format === 'vtt' || options.format === 'both') {
      const vttContent = srtToVTT(srtContent);
      const vttPath = path.join(options.out, 'subtitles.vtt');
      await fs.writeFile(vttPath, vttContent, 'utf-8');
      logger.success(`Saved: subtitles.vtt`);
    }

    // Save raw transcript
    const rawText = srtToText(srtContent);
    const rawPath = path.join(options.out, 'transcript_raw.txt');
    await fs.writeFile(rawPath, rawText, 'utf-8');
    logger.success(`Saved: transcript_raw.txt`);

    // Step 7: Clean transcript
    if (!options.noClean) {
      logger.info('\n[7/8] Cleaning transcript...');
      
      let cleanedText;
      if (chatClient) {
        cleanedText = await cleanTranscript(chatClient, rawText, logger, {
          safeMode: options.safeMode,
          darijaStrict: options.darijaStrict,
          style: options.style,
          script: options.script
        });
      } else {
        // Basic rule-based cleaning for when no chat API is available
        if (options.style === 'darija') {
          cleanedText = basicDarijaConversion(rawText);
          logger.info('Applied basic Darija conversion (no LLM available)');
        } else if (options.style === 'msa') {
          cleanedText = basicMSANormalization(rawText);
          logger.info('Applied basic MSA normalization (no LLM available)');
        } else {
          cleanedText = basicMixedCleaning(rawText);
          logger.info('Applied basic mixed cleaning (no LLM available)');
        }
        cleanedText = applyScript(sanitizeText(cleanedText, { preserveLatin: true }), options.script);
      }
      
      const transcriptLabel = options.style === 'darija' ? 'darija' : options.style;
      const cleanPath = path.join(options.out, `transcript_clean_${transcriptLabel}.txt`);
      await fs.writeFile(cleanPath, cleanedText, 'utf-8');
      logger.success(`Saved: transcript_clean_${transcriptLabel}.txt`);

      // Generate cleaned SRT by cleaning each subtitle block
      if (chatClient) {
        logger.info(`Generating ${options.style} subtitles...`);
        const styledSRT = await generateStyledSRT(chatClient, srtContent, logger, {
          style: options.style,
          darijaStrict: options.darijaStrict,
          script: options.script
        });
        
        const subtitleLabel = options.style === 'darija' ? 'darija' : options.style;
        const styledSRTPath = path.join(options.out, `subtitles_${subtitleLabel}.srt`);
        await fs.writeFile(styledSRTPath, styledSRT, 'utf-8');
        logger.success(`Saved: subtitles_${subtitleLabel}.srt`);
        
        if (options.format === 'vtt' || options.format === 'both') {
          const styledVTT = srtToVTT(styledSRT);
          const styledVTTPath = path.join(options.out, `subtitles_${subtitleLabel}.vtt`);
          await fs.writeFile(styledVTTPath, styledVTT, 'utf-8');
          logger.success(`Saved: subtitles_${subtitleLabel}.vtt`);
        }
      }

      if (options.diarization && chatClient) {
        let diarizedText = await applyDiarization(chatClient, cleanedText, logger);
        diarizedText = applyScript(diarizedText, options.script);
        const diarizedPath = path.join(options.out, 'transcript_diarized.txt');
        await fs.writeFile(diarizedPath, diarizedText, 'utf-8');
        logger.success(`Saved: transcript_diarized.txt`);
      }

      // Step 7: Generate captions
      if (!options.noCaption && chatClient) {
        logger.info('Generating captions...');
        const { caption, variations } = await generateCaptions(chatClient, cleanedText, logger, {
          style: options.style,
          script: options.script
        });

        const captionLabel = options.style === 'darija' ? 'darija' : options.style;
        const captionPath = path.join(options.out, `caption_${captionLabel}.txt`);
        await fs.writeFile(captionPath, caption, 'utf-8');
        logger.success(`Saved: caption_${captionLabel}.txt`);

        const variationsPath = path.join(options.out, `caption_variations_${captionLabel}.json`);
        await fs.writeFile(variationsPath, JSON.stringify(variations, null, 2), 'utf-8');
        logger.success(`Saved: caption_variations_${captionLabel}.json`);
      }
    }

    logger.info('\n[8/8] Finalizing outputs...');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('\n═══════════════════════════════════════════════════════');
    logger.success(`Pipeline completed in ${elapsed}s`);
    logger.info('═══════════════════════════════════════════════════════');

    console.log(chalk.green('\n✨ Output files:'));
    const files = await fs.readdir(options.out);
    for (const file of files) {
      if (file !== 'run.log') {
        console.log(chalk.cyan(`   → ${path.join(options.out, file)}`));
      }
    }

  } catch (error) {
    logger.error(`Pipeline failed: ${error.message}`);
    console.error(chalk.red('\n❌ Error:'), error.message);
    exitCode = 1;
  } finally {
    await cleanup(tempDir, options.keepTemp, logger);
    await logger.save();
  }

  return exitCode;
}

// ============================================================================
// CLI SETUP
// ============================================================================

const program = new Command();

program
  .name('darija-captions')
  .description('Video → Darija Captions Tool (Supports: Gladia, AssemblyAI, Groq, OpenRouter, Gemini, OpenAI, DeepSeek)')
  .version('2.0.0')
  .option('-i, --input <path>', 'Input video file path')
  .option('-o, --out <path>', 'Output directory', './output')
  .option('-l, --lang <lang>', 'Language (auto, ar)', 'auto')
  .option('-f, --format <format>', 'Subtitle format (srt, vtt, both)', 'both')
  .option('-p, --provider <n>', 'API provider (auto, gladia, assemblyai, groq, openrouter, gemini, openai, deepseek)', 'auto')
  .option('--sttProvider <name>', 'STT provider override (auto, gladia, assemblyai, groq, openrouter, gemini, openai)')
  .option('--chatProvider <name>', 'Chat provider override (auto, groq, openrouter, gemini, openai, deepseek)')
  .option('--noClean', 'Skip transcript cleaning', false)
  .option('--noCaption', 'Skip caption generation', false)
  .option('--safeMode', 'Enable profanity softening', false)
  .option('--chunkMinutes <minutes>', 'Split audio into chunks (0 = off)', '0')
  .option('--keepTemp', 'Keep temporary files', false)
  .option('--diarization', 'Enable speaker diarization', false)
  .option('--sttModel <name>', 'STT model override (provider-specific)')
  .option('--chatModel <name>', 'Chat model override')
  .option('--model <name>', 'Chat model override (alias for --chatModel)')
  .option('--style <style>', 'Cleaning style (mixed, darija, msa)', 'darija')
  .option('--script <script>', 'Output script (arabic, latin)', 'arabic')
  .option('--darijaStrict <boolean>', 'Strict Darija enforcement (default true when style=darija)')
  .option('--listModels', 'List available models for the selected provider and exit', false)
  .action(async (options) => {
    options.chunkMinutes = parseInt(options.chunkMinutes);
    options.style = options.style?.toLowerCase() || 'darija';
    options.script = options.script?.toLowerCase() || 'arabic';
    const defaultDarijaStrict = options.style === 'darija';
    options.darijaStrict = options.darijaStrict === undefined
      ? defaultDarijaStrict
      : normalizeBoolean(options.darijaStrict, defaultDarijaStrict);

    if (!['mixed', 'darija', 'msa'].includes(options.style)) {
      console.error('Invalid --style. Use mixed, darija, or msa.');
      process.exit(1);
    }

    if (!['arabic', 'latin'].includes(options.script)) {
      console.error('Invalid --script. Use arabic or latin.');
      process.exit(1);
    }

    if (!['auto', 'ar'].includes(options.lang)) {
      console.error('Invalid --lang. Use auto or ar.');
      process.exit(1);
    }

    if (options.listModels) {
      let provider = options.provider === 'auto' ? null : options.provider;
      if (!provider) {
        provider = options.sttProvider && options.sttProvider !== 'auto' ? options.sttProvider : null;
      }
      if (!provider) {
        provider = options.chatProvider && options.chatProvider !== 'auto' ? options.chatProvider : null;
      }
      if (!provider) {
        const detectedStt = detectSttProvider(options.sttModel);
        const detectedChat = detectChatProvider();
        provider = detectedStt?.provider || detectedChat?.provider;
      }
      if (!provider) {
        console.error('No provider detected. Set --provider or configure an API key.');
        process.exit(1);
      }

      const envKey = CONFIG.providers[provider]?.envKey;
      const apiKey = process.env[envKey];
      if (!apiKey) {
        console.error(`${envKey} not found for provider ${provider}`);
        process.exit(1);
      }

      const client = new APIClient(provider, apiKey, null, {
        sttModel: options.sttModel,
        chatModel: options.chatModel || options.model
      });
      const { models, source } = await client.listModels();
      if (!models.length) {
        console.log(`No model list available for ${provider} (${source}).`);
      } else {
        console.log(models.sort().join('\n'));
      }
      process.exit(0);
    }

    if (!options.input) {
      console.error('Missing required --input (or use --listModels).');
      process.exit(1);
    }

    const exitCode = await runPipeline(options);
    process.exit(exitCode);
  });

program.parse();
