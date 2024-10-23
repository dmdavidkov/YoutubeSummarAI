# YoutubeSummarAI

Generate YouTube summaries using latest AI tech and services

## Description

YoutubeSummarAI is an advanced tool that leverages cutting-edge AI technology to automatically generate concise summaries of YouTube videos. This project aims to save time for users by providing quick, accurate summaries of video content, making it easier to decide whether to watch a full video or get the main points quickly.

## Features

- Extract speech from YouTube videos using:
  - YouTube's built-in transcript API
  - Local speech recognition via Whisper models (Base, Base English, Tiny)
- Generate summaries using:
  - Local AI models (Meta-Llama-3.1-8B-Instruct)
  - Popular AI services (You.com, Perplexity, Phind, Google Gemini, ChatGPT)
  - Custom AI provider support
- Chrome extension features:
  - Dockable summary panel that integrates with YouTube's interface
  - Click-to-seek functionality for timestamped references
  - Customizable provider settings
  - Markdown rendering support
- Support for multiple source languages (summaries currently only in English)
- Optional conversation logging for tracking summary history

## Project Structure

- `YoutubeSummarAI/`: Main project directory
  - `backend/`: Backend Python service
  - `extension/`: Chrome extension
    - `background.js`: Service worker for extension functionality
    - `content.js`: YouTube page integration
    - `popup.html`: Extension UI
    - Other extension resources

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/YoutubeSummarAI.git
   ```
2. Navigate to the project directory:
   ```bash
   cd YoutubeSummarAI/backend
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Create a `.env` file in the `backend` directory
   - Add necessary API keys (refer to `backend/.env.example`)
   - For local AI processing, place the Llama 3.1 GGUF model file in the `backend` directory

5. Run the backend service:
   - Ad-hoc mode: `python main.py`
   - Windows service:
     - Install (requires admin): `python main.py install`
     - Remove: `python main.py remove`

### Chrome Extension Setup

1. Open Chrome/Brave/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` directory
4. Configure options via the extension icon

## Configuration

### Extension Options

1. **Backend URL**: Server address for video processing (default: http://localhost:5000)
   - Service logs: `C:\ProgramData\YouTubeTranscriptionService\youtube_transcription_service.log`

2. **Transcription Method**:
   - YouTube API (fastest)
   - Whisper models (more accurate):
     - Base
     - Tiny
     - Large
     - Turbo
     
3. **Processing Mode**:
   - Local (uses backend AI model)
   - Remote (uses AI provider)

4. **AI Providers**:
   - Built-in support:
     - You.com
     - Perplexity
     - Phind
     - Google Gemini
     - ChatGPT
   - Custom provider support with configurable:
     - URL
     - Input field selector
     - Submit button selector
     - Confirmation button selector (optional)
     - Result selector

5. **Additional Settings**:
   - Conversation logging toggle
   - Provider-specific configurations

## Usage

1. Click the extension icon on any YouTube video
2. Use the docked panel or popup interface
3. Click "Generate Summary"
4. For timestamped references, click the timestamp to seek in the video

## Development

### Backend
- Python 3.10+ required
- Key dependencies:
  - youtube-transcript-api
  - whisper
  - llama.cpp

### Extension
- Chrome Extension Manifest V3
- Key features:
  - Service worker (background.js)
  - Content script injection
  - Cross-origin communication
  - Provider-specific handling

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [Whisper](https://github.com/openai/whisper)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [marked.js](https://marked.js.org/) for Markdown rendering

## Roadmap

- [ ] Configurable backend models via parameters
- [ ] Summary length and style options
- [ ] Additional video platform support
- [ ] Multi-language summary support
- [ ] Enhanced provider management
- [ ] Improved error handling and recovery

## Contact

For questions, suggestions, or collaborations, please open an issue on this repository.
