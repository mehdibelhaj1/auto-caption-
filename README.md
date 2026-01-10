# 🎬 Darija Captions

**Video → Darija Captions Tool** - Extract, transcribe, clean and generate social media captions for Moroccan Darija videos.

> تحويل الفيديوهات إلى ترجمات بالدارجة المغربية + captions للسوشل ميديا

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![OpenAI](https://img.shields.io/badge/OpenAI-Whisper%20%2B%20GPT-purple)

## ✨ Features

- 🎯 **Moroccan Darija optimized** - Keeps the authentic Darija vibe, never converts to MSA
- 📝 **Multiple outputs**: SRT, VTT, raw transcript, cleaned transcript, social captions
- 🤖 **AI-powered cleaning** - Removes fillers (aaa, mmm, euh), stutters, and repetitions
- 📱 **Social media ready** - Generates Instagram Reels / TikTok style captions with CTAs
- 🔤 **Bilingual support** - Handles Darija mixed with French naturally
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
├── transcript_clean_darija.txt # Cleaned Darija transcript
├── transcript_diarized.txt    # With speaker labels (if enabled)
├── caption_darija.txt         # Ready-to-use social caption
├── caption_variations.json    # 3 variations: neutral/hype/classy
└── run.log                    # Processing log with timestamps
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **FFmpeg** - Required for audio extraction
3. **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

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

# Create .env file with your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env
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
| `--safeMode` | Soften profanity | `false` |
| `--diarization` | Enable speaker detection | `false` |
| `--noClean` | Skip transcript cleaning | `false` |
| `--noCaption` | Skip caption generation | `false` |
| `--chunkMinutes <n>` | Split audio (for long videos) | `0` (off) |
| `--model <name>` | Chat model override | `gpt-4o-mini` |
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
- ⚙️ Configure options visually
- 📊 Real-time progress tracking
- ⬇️ Download results as ZIP

## 🎯 Example Commands

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
node index.js -i "./video.mp4" --model gpt-4o
```

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

### caption_variations.json
```json
{
  "neutral": "اليوم غادي نهضرو على موضوع مهم، تابعونا 📝",
  "hype": "والله غادي تصدمو! 🔥 شوفو هاد الفيديو للخر 💪",
  "classy": "محتوى حصري ومميز، استمتعوا ✨"
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional
PORT=3000  # Web UI port
```

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
│   Caption   │ ◄── │   GPT-4o    │ ◄── │   Whisper   │
│  Variations │     │   Clean     │     │  Transcribe │
└─────────────┘     └─────────────┘     └─────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
   caption_        transcript_          subtitles.srt
   variations.json clean_darija.txt    subtitles.vtt
```

## 📊 Pipeline Steps

1. **Input Validation** - Check file exists, format supported, readable
2. **Audio Extraction** - FFmpeg extracts mono 16kHz WAV
3. **Transcription** - Whisper API generates SRT with timestamps
4. **SRT Optimization** - Split long lines, merge short blocks
5. **VTT Conversion** - Convert SRT to VTT format
6. **Transcript Cleaning** - GPT removes fillers, fixes spelling
7. **Caption Generation** - GPT creates social-ready captions

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

### "OPENAI_API_KEY not found"
Create a `.env` file with your API key:
```bash
echo "OPENAI_API_KEY=sk-..." > .env
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

- [OpenAI Whisper](https://openai.com/research/whisper) - Speech recognition
- [OpenAI GPT](https://openai.com/gpt-4) - Text processing
- [FFmpeg](https://ffmpeg.org/) - Audio extraction
- Built with ❤️ by **OKTOPIA** for the Moroccan creator community

---

<div align="center">

**🇲🇦 Made for Moroccan Creators 🇲🇦**

دير لايك، شارك، وخلينا نكبرو مع بعض! 🚀

</div>
