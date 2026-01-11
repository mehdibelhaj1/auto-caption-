# 🎬 Darija Captions

**Video → Darija Captions Tool** - Extract, transcribe, clean and generate social media captions for Moroccan Darija videos.

> تحويل الفيديوهات إلى ترجمات بالدارجة المغربية + captions للسوشل ميديا

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Providers](https://img.shields.io/badge/Providers-Multi--STT%20%2B%20LLM-purple)

## ✨ Features

- 🎯 **Moroccan Darija optimized (default)** - Keeps the authentic Darija vibe with real code-switching (Darija + French + English)
- 🧼 **Darija strict mode** - Two-pass cleaning with MSA blockers while preserving non-Arabic words
- 🧩 **Style control** - `mixed`, `darija`, or `msa` cleaning modes
- 🔤 **Script control** - Arabic script or Arabizi (Latin + digits 2/3/7/9)
- 📝 **Multiple outputs**: SRT, VTT, raw transcript, cleaned transcript, social captions
- 🤖 **AI-powered cleaning** - Removes fillers (aaa, mmm, euh), stutters, and repetitions
- 📱 **Social media ready** - Generates Instagram Reels / TikTok style captions with CTAs
- 🌍 **Provider + model selection** - Pick STT/Chat providers and models per run
- 🛡️ **Safe mode** - Optional profanity softening
- 👥 **Speaker detection** - Heuristic-based speaker diarization
- ⏱️ **Long video support** - Chunk mode for videos over 25MB
- 🌐 **Web UI included** - Optional drag & drop interface

## 📦 Output Files

```
output/
├── subtitles.srt              # Timed subtitles (SRT format)
├── subtitles.vtt              # Timed subtitles (VTT format)
├── transcript_raw.txt         # Raw transcript (no timestamps)
├── transcript_clean_darija.txt # Cleaned transcript (style-dependent)
├── transcript_diarized.txt    # With speaker labels (if enabled)
├── subtitles_darija.srt       # Cleaned subtitles (style-dependent)
├── subtitles_darija.vtt       # Cleaned subtitles (style-dependent)
├── caption_darija.txt         # Ready-to-use social caption (style-dependent)
├── caption_variations_darija.json # 3 variations: neutral/hype/classy
└── run.log                    # Processing log with timestamps
```

> ✅ If `--style` is `mixed` or `msa`, the cleaned outputs use the same naming pattern:
> `transcript_clean_mixed.txt`, `subtitles_mixed.srt`, `caption_mixed.txt`, etc.

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **FFmpeg** - Required for audio extraction
3. **API Key** for one provider (Gladia, AssemblyAI, Groq, OpenRouter, Gemini, OpenAI, or DeepSeek)

### Install FFmpeg

<details>
<summary><b>🪟 Windows</b></summary>

**Option 1: Using winget (recommended)**
```bash
winget install ffmpeg
```

**Option 2: Using Chocolatey**
```bash
choco install ffmpeg
```

**Option 3: Manual**
1. Download from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH
</details>

<details>
<summary><b>🍎 macOS</b></summary>

```bash
brew install ffmpeg
```
</details>

<details>
<summary><b>🐧 Linux</b></summary>

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Fedora:**
```bash
sudo dnf install ffmpeg
```

**Arch:**
```bash
sudo pacman -S ffmpeg
```
</details>

### Install the Tool

```bash
# Clone or download the project
cd darija-captions

# Install dependencies
npm install

# Create .env file with your API key (see .env.example)
echo "GROQ_API_KEY=gsk-your-key-here" > .env
```

### Run

```bash
# Basic usage
node index.js --input "./video.mp4"

# With all options
node index.js \
  --input "./video.mp4" \
  --out "./my-output" \
  --lang auto \
  --style darija \
  --script arabic \
  --format both \
  --safeMode \
  --diarization \
  --chunkMinutes 10
```

## 📋 CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input <path>` | Input video file **(required)** | - |
| `-o, --out <path>` | Output directory | `./output` |
| `-l, --lang <lang>` | Language: `auto` or `ar` | `auto` |
| `-f, --format <fmt>` | Output: `srt`, `vtt`, or `both` | `both` |
| `-p, --provider <name>` | Provider (`auto`, `gladia`, `assemblyai`, `groq`, `openrouter`, `gemini`, `openai`, `deepseek`) | `auto` |
| `--sttProvider <name>` | STT provider override | defaults to `--provider` or auto |
| `--chatProvider <name>` | Chat provider override | defaults to `--provider` or best available |
| `--safeMode` | Soften profanity | `false` |
| `--diarization` | Enable speaker detection | `false` |
| `--style <style>` | Cleaning style: `mixed`, `darija`, `msa` | `darija` |
| `--script <script>` | Script: `arabic` or `latin` (Arabizi) | `arabic` |
| `--darijaStrict <bool>` | Strict Darija enforcement | `true` only when `style=darija` |
| `--noClean` | Skip transcript cleaning | `false` |
| `--noCaption` | Skip caption generation | `false` |
| `--chunkMinutes <n>` | Split audio (for long videos) | `0` (off) |
| `--sttModel <name>` | STT model override | provider default |
| `--chatModel <name>` | Chat model override | provider default |
| `--model <name>` | Chat model override (alias) | provider default |
| `--listModels` | List models for provider and exit | `false` |
| `--keepTemp` | Keep temp files for debugging | `false` |

## 🌐 Web UI (Optional)

Start the local web server:

```bash
npm run server
# or
node server.js
```

Then open http://localhost:3000 in your browser.

Features:
- 📤 Drag & drop video upload
- ⚙️ Configure providers, style, script, and language visually
- 🔁 Override STT vs Chat providers separately
- 📊 Real-time progress tracking
- ⬇️ Download results as ZIP
- 🔍 Fetch provider models via the UI

### Provider Auto-Detection Priority

When you leave `--provider` unset (or choose **auto** in the UI), the CLI picks the first available **STT-capable** provider in this order:

`GLADIA` → `AssemblyAI` → `Groq` → `OpenAI` → `Gemini` → `OpenRouter` (only if the selected model accepts audio)

> DeepSeek is chat-only and is never auto-selected for STT.

## 🎯 Example Commands

### OpenAI with explicit models
```bash
node index.js --input "./video.mp4" --provider openai --sttModel whisper-1 --chatModel gpt-4o-mini --format srt
```

### Split STT + Chat providers (Gladia STT + Groq Chat)
```bash
node index.js --input "./video.mp4" --sttProvider gladia --chatProvider groq --style mixed
```

### Mixed style with Arabizi output
```bash
node index.js --input "./video.mp4" --style mixed --script latin
```

### MSA cleanup (keep French/English words)
```bash
node index.js --input "./video.mp4" --style msa --darijaStrict false
```

### List models for a provider
```bash
node index.js --provider openai --listModels
```

### Darija strict on (default)
```bash
node index.js --input "./video.mp4" --darijaStrict true
```

### Basic transcription
```bash
node index.js -i "./my-video.mp4"
```

### Safe mode + speaker detection
```bash
node index.js -i "./podcast.mp4" --safeMode --diarization
```

### Long video (chunked processing)
```bash
node index.js -i "./long-video.mp4" --chunkMinutes 10
```

### SRT only, Arabic forced
```bash
node index.js -i "./video.mp4" --format srt --lang ar
```

### Using a different model
```bash
node index.js -i "./video.mp4" --chatModel gpt-4o
```

## 🧬 Style + Script Behavior

### Styles
- **mixed**: preserves Darija/French/English code-switching exactly as spoken (no translation).
- **darija**: enforces Moroccan Darija while keeping French/English words untouched.
- **msa**: normalizes to Modern Standard Arabic (MSA) without changing non-Arabic words.

### Scripts
- **arabic**: keep Arabic in Arabic script; keep French/English in Latin.
- **latin**: transliterate Arabic Darija into Moroccan Arabizi (Latin + digits 2/3/7/9) and keep French/English as-is.

> Script selection affects cleaned transcripts, cleaned subtitles, and generated captions (raw transcripts stay untouched).

### STT Language Control
- **auto**: do not force language detection (omits the language parameter).
- **ar**: force Arabic language for STT.

## 📄 Output Examples

### subtitles.srt
```srt
1
00:00:00,000 --> 00:00:03,500
السلام عليكم، كيداير الخوت؟

2
00:00:03,500 --> 00:00:07,200
اليوم غادي نهضرو على شي حاجة مهمة
```

### caption_darija.txt
```
اليوم غادي نشارك معاكم شي حاجة مهمة بزاف 🔥
شنو رايكم؟ كتبو لينا فالكومونت 👇
```

### caption_variations_darija.json
```json
{
  "neutral": "اليوم غادي نهضرو على موضوع مهم، تابعونا 📝",
  "hype": "والله غادي تصدمو! 🔥 شوفو هاد الفيديو للخر 💪",
  "classy": "محتوى حصري ومميز، استمتعوا ✨"
}
```

## 🧪 Darija / Mixed Smoke Test Script

Run a tiny offline check to verify timestamps remain untouched, mixed style preserves French/English tokens, and Darija strict removes MSA blockers:

```bash
node scripts/test-darija-strict.js
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
# Required (at least one STT-capable key)
GLADIA_API_KEY=
ASSEMBLYAI_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# Optional chat-only provider
DEEPSEEK_API_KEY=

# Optional
PORT=3000  # Web UI port
```

## 🧠 How to choose models

Models are selected **per request**. You can list models at any time with:

- CLI: `node index.js --provider openai --listModels`
- API: `GET /api/models?provider=openai` (UI backend)

Use `--sttModel` to choose the transcription model and `--chatModel`/`--model` to choose the chat model. For UI users, click **“جلب الموديلات”** to populate the model dropdowns.

### Supported Video Formats

- MP4 (`.mp4`)
- MOV (`.mov`)
- MKV (`.mkv`)
- WebM (`.webm`)
- AVI (`.avi`)
- M4V (`.m4v`)
- FLV (`.flv`)

## 🏗️ Build Standalone Executable (Optional)

Create a standalone executable that doesn't require Node.js:

```bash
# Install pkg globally
npm install -g pkg

# Build for all platforms
npm run build

# Output in dist/
# - darija-captions-linux
# - darija-captions-macos
# - darija-captions-win.exe
```

## 🧠 How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Video     │ ──► │   FFmpeg    │ ──► │    WAV      │
│  (mp4/mov)  │     │  Extract    │     │  16kHz Mono │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Caption   │ ◄── │   LLM Chat  │ ◄── │   STT API   │
│  Variations │     │   Clean     │     │ Transcribe │
└─────────────┘     └─────────────┘     └─────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
   caption_        transcript_          subtitles.srt
   variations.json clean_darija.txt    subtitles.vtt
```

## 📊 Pipeline Steps

1. **Input Validation** - Check file exists, format supported, readable
2. **Audio Extraction** - FFmpeg extracts mono 16kHz WAV
3. **Transcription** - STT provider generates SRT with timestamps
4. **SRT Optimization** - Split long lines, merge short blocks
5. **Darija Strict Cleanup** - Two-pass Darija enforcement (no MSA drift)
6. **VTT Conversion** - Convert SRT to VTT format
7. **Transcript Cleaning** - Chat provider removes fillers, fixes spelling
8. **Caption Generation** - Chat provider creates social-ready captions

## 🔒 Privacy & Security

- ✅ All processing is local (except API calls)
- ✅ Temp files are automatically deleted
- ✅ API key stored in `.env` (never committed)
- ✅ Web UI is local-only (localhost)

## 🐛 Troubleshooting

### "FFmpeg not found"
Make sure FFmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### "No API key configured"
Create a `.env` file with one of the supported provider keys:
```bash
echo "GROQ_API_KEY=gsk-..." > .env
```

### "File too large"
For videos > 25MB, use chunk mode:
```bash
node index.js -i video.mp4 --chunkMinutes 10
```

### Arabic script not displaying correctly
Make sure your terminal supports RTL and Arabic fonts.

## 📝 License

MIT License - Feel free to use in your projects!

## 🙏 Credits

- STT Providers: Gladia, AssemblyAI, Groq, OpenAI, Gemini, OpenRouter
- LLM Providers: Groq, OpenAI, Gemini, OpenRouter, DeepSeek
- [FFmpeg](https://ffmpeg.org/) - Audio extraction
- Built with ❤️ by **OKTOPIA** for the Moroccan creator community

---

<div align="center">

**🇲🇦 Made for Moroccan Creators 🇲🇦**

دير لايك، شارك، وخلينا نكبرو مع بعض! 🚀

</div>
