# YoutubeSummarAI

Generate YouTube summaries using latest AI tech and services

## Description

YoutubeSummarAI is an advanced tool that leverages cutting-edge AI technology to automatically generate concise summaries of YouTube videos. This project aims to save time for users by providing quick, accurate summaries of video content, making it easier to decide whether to watch a full video or get the main points quickly.

## Features

- Extract speech from YouTube videos using:
  - YouTube's built-in transcript API
  - Local speech recognition via Whisper models
- Generate summaries using:
  - Local AI models (currently setup for Qwen 2.5 7B)
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
   git clone https://github.com/dmdavidkov/YoutubeSummarAI
   ```
2. Navigate to the project directory:
   ```bash
   cd YoutubeSummarAI/backend
   ```
3. (Optional) For support of Cuda in local summarization model:
  ```bash
  set CMAKE_ARGS="-DGGML_CUDA=on"
  ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Set up environment variables:
   - Create a `.env` file in the `backend` directory
   - Add necessary API keys (refer to `backend/.env.example`)
   - For local AI processing, place the Llama 3.1 GGUF model file in the `backend` directory

6. Run the backend service:
   - Ad-hoc mode: `python main.py`
   - Windows service:
     - Install (requires admin): `python main.py install` then `python main.py start`
     - Remove: `python main.py remove`

### Chrome Extension Setup

1. Open Chrome/Brave/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` directory
4. Configure options via the extension icon

## Configuration

### Extension Options

1. **Backend URL**: Server address for video processing (default: http://localhost:5000)
   - Service logs location: `C:\ProgramData\YouTubeTranscriptionService\youtube_transcription_service.log`
   - When running in ad-hoc mode (`python main.py`), logs will be output directly to the console

2. **Transcription Method**:
   - YouTube API (fastest)
   - Whisper models (possibly more accurate and includes speaker diarization):
     - Base
     - Tiny
     - Large
     - Turbo (Recommended)

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

**View and set options with right click on the extension icon and chosing "Options"**

## Considerations for Local Transcription

1. You'll need ffmpeg installed and added to PATH. Download build from https://github.com/yt-dlp/FFmpeg-Builds?tab=readme-ov-file and add bin folder to to PATH in System Environment Variables
orOn windows you can also use Chocolatey (https://chocolatey.org/):
choco install ffmpeg

2. You need additional setup in Hugging Face for the access of the models. See https://github.com/m-bain/whisperX?tab=readme-ov-file#speaker-diarization

3. The first time it will download models and will take some time. You can check progress in the log file or terminal output.

4. For Nvidia GPU acceleration make sure Cuda and cuDNN are installed and you have the appropriate PyTorch version utilizing them. 

## Considerations for Local summarization using llama.cpp

1. You can place the model in the /backend folder in gguf format or let the code download the model from HF. 

2. Currently the setup is for Qwen2.5 7B model. If you want you can use another model, but you need to go to run_llama.py and update the repo/modelname, response (the stop token) and chat template variables. 

3. The project utilizes https://github.com/abetlen/llama-cpp-python library. If you want a NVIDIA/CUDA GPU acceleration refer to https://github.com/abetlen/llama-cpp-python?tab=readme-ov-file#supported-backends

## Development

### Backend
- Python 3.10+ required
- Key dependencies:
  - youtube-transcript-api
  - yt-dlp
  - whisperx
  - llama-cpp-python 
  - ffmpeg

### Extension
- Chrome Extension Manifest V3
- Key features:
  - Service worker (background.js)
  - Content script injection
  - Cross-origin communication
  - Provider-specific handling

**Note: This project has been developed and tested on Windows only. Linux/Mac support is not currently implemented. It will probably work, but the most glaring issue will be the use of Windows OS specific logging and service approach in backend/main.py.**

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [whisperX](https://github.com/m-bain/whisperX)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python)

## Roadmap

- [ ] Configurable backend models via parameters
- [ ] Summary length and style options
- [ ] Additional video platform support
- [ ] Multi-language summary support
- [ ] Enhanced provider management
- [ ] Improved error handling and recovery

## Contact

For questions, suggestions, or collaborations, please open an issue on this repository.

