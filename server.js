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

// HTML Template
const HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Darija Captions 🎬</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);min-height:100vh;color:#fff;padding:20px}
    .container{max-width:900px;margin:0 auto}
    h1{text-align:center;margin-bottom:10px;font-size:2.5rem;background:linear-gradient(90deg,#e94560,#ff6b6b);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .subtitle{text-align:center;color:#888;margin-bottom:30px}
    .dashboard{background:rgba(255,255,255,0.05);border-radius:15px;padding:20px;margin-bottom:30px;border:1px solid rgba(255,255,255,0.1)}
    .dash-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px}
    .dash-title{font-size:1.1rem;color:#ccc}
    .dash-actions{display:flex;gap:10px}
    .btn-sm{background:rgba(255,255,255,0.1);border:none;color:#fff;padding:8px 15px;border-radius:8px;cursor:pointer;font-size:0.9rem}
    .btn-sm:hover{background:rgba(255,255,255,0.2)}
    .btn-add{background:linear-gradient(90deg,#4ade80,#22c55e)}
    .btn-add:hover{transform:scale(1.05)}
    .api-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:15px}
    .api-card{background:rgba(0,0,0,0.3);border-radius:12px;padding:15px;border:2px solid transparent}
    .api-card.ok{border-color:#4ade80;background:rgba(74,222,128,0.1)}
    .api-card.err{border-color:#f87171}
    .api-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .api-name{font-weight:bold;font-size:1.1rem}
    .badge{font-size:0.75rem;padding:4px 10px;border-radius:12px;background:#4ade80;color:#000;font-weight:bold}
    .badge.paid{background:#fbbf24}
    .api-status{font-size:0.9rem;display:flex;align-items:center;gap:8px;margin:10px 0}
    .dot{width:12px;height:12px;border-radius:50%;background:#666}
    .dot.ok{background:#4ade80}
    .dot.err{background:#f87171}
    .api-key{font-size:0.8rem;color:#888;font-family:monospace;background:rgba(0,0,0,0.3);padding:5px 10px;border-radius:5px;margin-top:8px}
    .api-feat{font-size:0.85rem;color:#aaa;margin-top:8px}
    .no-api{text-align:center;padding:30px}
    .no-api h3{color:#fbbf24;margin-bottom:15px}
    .no-api p{color:#888;margin-bottom:20px}
    .btn-big{background:linear-gradient(90deg,#4ade80,#22c55e);border:none;color:#fff;padding:15px 30px;font-size:1.1rem;border-radius:30px;cursor:pointer}
    .btn-big:hover{transform:scale(1.05);box-shadow:0 10px 30px rgba(74,222,128,0.3)}
    .modal-bg{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:1000;justify-content:center;align-items:center}
    .modal-bg.show{display:flex}
    .modal{background:#1a1a2e;border-radius:20px;padding:30px;max-width:500px;width:90%;border:1px solid rgba(255,255,255,0.1)}
    .modal h2{margin-bottom:20px;text-align:center}
    .modal-close{float:left;background:none;border:none;color:#888;font-size:1.5rem;cursor:pointer}
    .form-group{margin-bottom:20px}
    .form-group label{display:block;margin-bottom:8px;color:#ccc}
    .form-group select,.form-group input{width:100%;padding:12px;border-radius:10px;border:1px solid #444;background:rgba(255,255,255,0.05);color:#fff;font-size:1rem}
    .info-box{background:rgba(96,165,250,0.1);border:1px solid #60a5fa;border-radius:10px;padding:15px;margin:15px 0;font-size:0.9rem}
    .info-box a{color:#60a5fa;text-decoration:none}
    .btn-save{width:100%;padding:15px;background:linear-gradient(90deg,#4ade80,#22c55e);border:none;border-radius:10px;color:#fff;font-size:1.1rem;cursor:pointer}
    .btn-save:disabled{opacity:0.5}
    .result{margin-top:15px;padding:10px;border-radius:8px;text-align:center;display:none}
    .result.ok{display:block;background:rgba(74,222,128,0.2);color:#4ade80}
    .result.err{display:block;background:rgba(248,113,113,0.2);color:#f87171}
    .upload-zone{border:3px dashed #e94560;border-radius:20px;padding:60px;text-align:center;cursor:pointer;background:rgba(233,69,96,0.05);transition:all 0.3s}
    .upload-zone:hover,.upload-zone.over{background:rgba(233,69,96,0.15);transform:scale(1.02)}
    .upload-zone.off{opacity:0.5;cursor:not-allowed;pointer-events:none}
    .upload-icon{font-size:4rem;margin-bottom:20px}
    .upload-text{font-size:1.2rem;color:#ccc}
    .upload-text span{color:#e94560;text-decoration:underline}
    .options{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:30px 0;background:rgba(255,255,255,0.05);padding:20px;border-radius:15px}
    .option{display:flex;align-items:center;gap:10px}
    .option input[type="checkbox"]{width:18px;height:18px;accent-color:#e94560}
    select{background:rgba(255,255,255,0.1);border:1px solid #444;color:#fff;padding:8px 12px;border-radius:8px}
    .btn{background:linear-gradient(90deg,#e94560,#ff6b6b);border:none;color:#fff;padding:15px 40px;font-size:1.1rem;border-radius:30px;cursor:pointer;display:block;width:100%;max-width:300px;margin:20px auto}
    .btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 30px rgba(233,69,96,0.4)}
    .btn:disabled{opacity:0.5;cursor:not-allowed}
    .status{background:rgba(255,255,255,0.05);border-radius:15px;padding:20px;margin-top:30px;display:none}
    .status.show{display:block}
    .status-head{display:flex;justify-content:space-between;margin-bottom:15px}
    .progress{height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden}
    .progress-fill{height:100%;background:linear-gradient(90deg,#e94560,#ff6b6b);width:0%;transition:width 0.5s}
    .logs{margin-top:15px;font-family:monospace;font-size:0.85rem;background:#0a0a15;padding:15px;border-radius:10px;max-height:300px;overflow-y:auto;direction:ltr;text-align:left}
    .log{margin:5px 0;color:#aaa}
    .log.ok{color:#4ade80}
    .log.err{color:#f87171}
    .log.info{color:#60a5fa}
    .btn-dl{background:linear-gradient(90deg,#10b981,#34d399);margin-top:20px}
    .file-info{background:rgba(233,69,96,0.1);padding:15px;border-radius:10px;margin:20px 0;display:none;justify-content:space-between;align-items:center}
    .file-info.show{display:flex}
    .file-name{font-weight:bold;color:#e94560}
    .file-size{color:#888}
    .file-rm{background:none;border:none;color:#e94560;cursor:pointer;font-size:1.5rem}
    #fileIn{display:none}
    footer{text-align:center;margin-top:50px;color:#555;font-size:0.9rem}
    footer a{color:#e94560;text-decoration:none}
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 Darija Captions</h1>
    <p class="subtitle">أداة ترجمة الفيديوهات بالدارجة المغربية</p>
    
    <div class="dashboard">
      <div class="dash-header">
        <span class="dash-title">⚙️ حالة الـ API</span>
        <div class="dash-actions">
          <button class="btn-sm" onclick="refresh()">🔄 تحديث</button>
          <button class="btn-sm btn-add" onclick="showModal()">➕ إضافة API</button>
        </div>
      </div>
      <div id="cards" class="api-cards"><div style="text-align:center;padding:20px;color:#888">⏳ جاري التحقق...</div></div>
    </div>
    
    <div class="upload-zone off" id="upZone">
      <div class="upload-icon">📹</div>
      <div class="upload-text">اسحب الفيديو هنا أو <span>اختر ملف</span></div>
      <p style="color:#666;margin-top:10px;font-size:0.9rem">MP4, MOV, MKV, WebM</p>
    </div>
    
    <input type="file" id="fileIn" accept=".mp4,.mov,.mkv,.webm,.avi">
    
    <div class="file-info" id="fileInfo">
      <div><div class="file-name" id="fName"></div><div class="file-size" id="fSize"></div></div>
      <button class="file-rm" id="fRm">×</button>
    </div>
    
    <div class="options">
      <div class="option"><input type="checkbox" id="safe"><label for="safe">🛡️ Safe Mode</label></div>
      <div class="option"><input type="checkbox" id="diar"><label for="diar">👥 تمييز المتكلمين</label></div>
      <div class="option"><label>📝 الصيغة:</label><select id="fmt"><option value="both">SRT + VTT</option><option value="srt">SRT</option><option value="vtt">VTT</option></select></div>
      <div class="option"><label>🔌 API:</label><select id="prov"><option value="auto">تلقائي</option></select></div>
    </div>
    
    <button class="btn" id="goBtn" disabled>🚀 ابدأ الترجمة</button>
    
    <div class="status" id="status">
      <div class="status-head"><span id="sTxt">جاري المعالجة...</span><span id="sPct">0%</span></div>
      <div class="progress"><div class="progress-fill" id="pFill"></div></div>
      <div class="logs" id="logs"></div>
    </div>
    
    <button class="btn btn-dl" id="dlBtn" style="display:none">⬇️ تحميل النتائج</button>
  </div>
  
  <div class="modal-bg" id="modal">
    <div class="modal">
      <button class="modal-close" onclick="hideModal()">×</button>
      <h2>➕ إضافة API Key</h2>
      <div class="form-group">
        <label>Provider:</label>
        <select id="newProv" onchange="updateInfo()">
          <option value="gladia">Gladia (⭐ الأفضل! 10h مجاناً/شهر)</option>
          <option value="assemblyai">AssemblyAI ($50 مجاناً)</option>
          <option value="groq">Groq (مجاني)</option>
          <option value="openrouter">OpenRouter (مجاني)</option>
          <option value="gemini">Gemini (مجاني)</option>
          <option value="openai">OpenAI (مدفوع)</option>
          <option value="deepseek">DeepSeek (رخيص)</option>
        </select>
      </div>
      <div class="info-box" id="provInfo"></div>
      <div class="form-group">
        <label>API Key:</label>
        <input type="text" id="newKey" placeholder="gsk_xxx أو sk-xxx" dir="ltr">
      </div>
      <button class="btn-save" id="saveBtn" onclick="saveKey()">💾 حفظ و تجربة</button>
      <div class="result" id="saveRes"></div>
    </div>
  </div>
  
  <footer><p>صُنع بـ ❤️ بواسطة <a href="#">OKTOPIA</a></p></footer>
  
  <script>
    const upZone=document.getElementById('upZone'),fileIn=document.getElementById('fileIn'),fileInfo=document.getElementById('fileInfo'),
          fName=document.getElementById('fName'),fSize=document.getElementById('fSize'),fRm=document.getElementById('fRm'),
          goBtn=document.getElementById('goBtn'),status=document.getElementById('status'),sTxt=document.getElementById('sTxt'),
          sPct=document.getElementById('sPct'),pFill=document.getElementById('pFill'),logs=document.getElementById('logs'),
          dlBtn=document.getElementById('dlBtn'),cards=document.getElementById('cards'),prov=document.getElementById('prov'),
          modal=document.getElementById('modal'),newProv=document.getElementById('newProv'),provInfo=document.getElementById('provInfo'),
          newKey=document.getElementById('newKey'),saveBtn=document.getElementById('saveBtn'),saveRes=document.getElementById('saveRes');
    
    let file=null,working=false;
    
    refresh();
    
    function showModal(){modal.classList.add('show');updateInfo();saveRes.className='result';newKey.value=''}
    function hideModal(){modal.classList.remove('show')}
    
    function updateInfo(){
      const p=newProv.value;
      const info={
        gladia:'<strong>⭐ الأفضل للهجات! 10 ساعات مجاناً/شهر</strong><br><a href="https://app.gladia.io/auth/signup" target="_blank">👉 سجّل مجاناً</a><br><small style="color:#4ade80">✨ Code-switching = دارجة + فرنسية!</small>',
        assemblyai:'<strong>💰 $50 مجاناً = ~135 ساعة</strong><br><a href="https://www.assemblyai.com/dashboard/signup" target="_blank">👉 سجّل</a>',
        groq:'<strong>🆓 مجاني 100%</strong><br><a href="https://console.groq.com/keys" target="_blank">👉 احصل على Key</a><br><small style="color:#888">للتحويل للدارجة</small>',
        openrouter:'<strong>🆓 مجاني</strong><br><a href="https://openrouter.ai/keys" target="_blank">👉 احصل على Key</a><br><small style="color:#fbbf24">⚠️ Rate limits</small>',
        gemini:'<strong>🆓 مجاني</strong><br><a href="https://aistudio.google.com/apikey" target="_blank">👉 احصل على Key</a><br><small style="color:#fbbf24">⚠️ Rate limits صارمة</small>',
        openai:'<strong>💰 مدفوع</strong><br><a href="https://platform.openai.com/api-keys" target="_blank">👉 احصل على Key</a><br><small style="color:#888">يبدأ بـ: sk-</small>',
        deepseek:'<strong>💵 رخيص</strong><br><a href="https://platform.deepseek.com/" target="_blank">👉 احصل على Key</a><br><small style="color:#f87171">⚠️ لا يدعم الترجمة الصوتية</small>'
      };
      provInfo.innerHTML=info[p];
    }
    
    async function saveKey(){
      const p=newProv.value,k=newKey.value.trim();
      if(!k){saveRes.className='result err';saveRes.textContent='❌ أدخل الـ Key';return}
      
      saveBtn.disabled=true;saveBtn.textContent='⏳ جاري...';saveRes.className='result';
      
      try{
        const r=await fetch('/api/save-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:p,key:k})});
        const d=await r.json();
        if(r.ok){
          saveRes.className='result ok';saveRes.textContent='✅ تم! API يعمل';
          setTimeout(()=>{hideModal();refresh()},1500);
        }else{
          saveRes.className='result err';saveRes.textContent='❌ '+(d.error||'خطأ');
        }
      }catch(e){saveRes.className='result err';saveRes.textContent='❌ خطأ'}
      
      saveBtn.disabled=false;saveBtn.textContent='💾 حفظ و تجربة';
    }
    
    async function refresh(){
      cards.innerHTML='<div style="text-align:center;padding:20px;color:#888">⏳ جاري التحقق...</div>';
      working=false;
      
      try{
        const r=await fetch('/api/status');
        const d=await r.json();
        
        prov.innerHTML='<option value="auto">تلقائي</option>';
        
        if(!d.apis.length){
          cards.innerHTML='<div class="no-api"><h3>⚠️ لا يوجد API</h3><p>أضف API Key للبدء</p><button class="btn-big" onclick="showModal()">➕ إضافة API Key</button></div>';
          upZone.classList.add('off');goBtn.disabled=true;
          return;
        }
        
        let html='';
        for(const a of d.apis){
          const ok=a.status==='success';
          if(ok)working=true;
          
          const opt=document.createElement('option');
          opt.value=a.name;opt.textContent=a.label+(ok?' ✓':' ✗');opt.disabled=!ok;
          prov.appendChild(opt);
          
          html+='<div class="api-card '+(ok?'ok':'err')+'"><div class="api-head"><span class="api-name">'+a.label+'</span><span class="badge '+(a.free?'':'paid')+'">'+(a.free?'✨ مجاني':'💰 مدفوع')+'</span></div><div class="api-status"><span class="dot '+(ok?'ok':'err')+'"></span><span>'+a.statusMessage+'</span></div><div class="api-key">🔑 '+a.key+'</div><div class="api-feat">'+(a.hasWhisper?'✅ يدعم Whisper':'❌ بدون Whisper')+'</div></div>';
        }
        cards.innerHTML=html;
        
        if(working){upZone.classList.remove('off');updateBtn()}
        else{upZone.classList.add('off');goBtn.disabled=true}
      }catch(e){cards.innerHTML='<div style="color:#f87171;text-align:center">❌ خطأ</div>'}
    }
    
    function updateBtn(){goBtn.disabled=!file||!working}
    
    upZone.onclick=()=>{if(!upZone.classList.contains('off'))fileIn.click()};
    upZone.ondragover=e=>{e.preventDefault();if(!upZone.classList.contains('off'))upZone.classList.add('over')};
    upZone.ondragleave=()=>upZone.classList.remove('over');
    upZone.ondrop=e=>{e.preventDefault();upZone.classList.remove('over');if(!upZone.classList.contains('off')&&e.dataTransfer.files.length)setFile(e.dataTransfer.files[0])};
    fileIn.onchange=()=>{if(fileIn.files.length)setFile(fileIn.files[0])};
    fRm.onclick=()=>{file=null;fileInfo.classList.remove('show');updateBtn();fileIn.value=''};
    
    function setFile(f){file=f;fName.textContent=f.name;fSize.textContent=fmt(f.size);fileInfo.classList.add('show');updateBtn()}
    function fmt(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';if(b<1073741824)return(b/1048576).toFixed(1)+' MB';return(b/1073741824).toFixed(2)+' GB'}
    function log(m,t=''){const e=document.createElement('div');e.className='log '+t;e.textContent=m;logs.appendChild(e);logs.scrollTop=logs.scrollHeight}
    
    goBtn.onclick=async()=>{
      if(!file||!working)return;
      goBtn.disabled=true;status.classList.add('show');dlBtn.style.display='none';logs.innerHTML='';
      
      const fd=new FormData();
      fd.append('video',file);
      fd.append('safeMode',document.getElementById('safe').checked);
      fd.append('diarization',document.getElementById('diar').checked);
      fd.append('format',document.getElementById('fmt').value);
      fd.append('provider',prov.value);
      
      log('📤 جاري الرفع...','info');
      
      try{
        const r=await fetch('/api/upload',{method:'POST',body:fd});
        const d=await r.json();
        if(d.error){log('❌ '+d.error,'err');goBtn.disabled=false;return}
        log('✅ تم الرفع!','ok');
        poll(d.jobId);
      }catch(e){log('❌ '+e.message,'err');goBtn.disabled=false}
    };
    
    async function poll(id){
      try{
        const r=await fetch('/api/job/'+id);
        const d=await r.json();
        sTxt.textContent=d.message||'جاري...';
        sPct.textContent=d.progress+'%';
        pFill.style.width=d.progress+'%';
        
        if(d.logs&&d.logs.length>logs.children.length){
          for(let i=logs.children.length;i<d.logs.length;i++)log(d.logs[i].message,d.logs[i].type);
        }
        
        if(d.status==='completed'){
          log('✨ تم بنجاح!','ok');
          dlBtn.style.display='block';
          dlBtn.onclick=()=>location.href='/api/download/'+id;
          goBtn.disabled=false;
        }else if(d.status==='error'){
          log('❌ '+d.error,'err');
          goBtn.disabled=false;
        }else{
          setTimeout(()=>poll(id),2000);
        }
      }catch(e){setTimeout(()=>poll(id),5000)}
    }
    
    modal.onclick=e=>{if(e.target===modal)hideModal()};
  </script>
</body>
</html>`;

// Routes
app.get('/', (req, res) => res.send(HTML));

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
        provider: req.body.provider !== 'auto' ? req.body.provider : null
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
    
    log('🚀 بدء المعالجة...', 'info');
    job.progress = 10;
    
    const proc = spawn('node', args, { cwd: __dirname, env: process.env });
    
    proc.stdout.on('data', data => {
      const line = data.toString().trim();
      if (line) {
        log(line, 'info');
        if (line.includes('[2/7]')) job.progress = 20;
        else if (line.includes('[3/7]')) job.progress = 30;
        else if (line.includes('[4/7]')) job.progress = 40;
        else if (line.includes('[5/7]')) job.progress = 60;
        else if (line.includes('[6/7]')) job.progress = 80;
        else if (line.includes('[7/7]')) job.progress = 90;
        else if (line.includes('completed')) job.progress = 100;
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
