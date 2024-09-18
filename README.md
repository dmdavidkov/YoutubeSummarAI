# YoutubeSummarAI

Generate YouTube summaries using latest AI tech and services

## Description

YoutubeSummarAI is an advanced tool that leverages cutting-edge AI technology to automatically generate concise summaries of YouTube videos. This project aims to save time for users by providing quick, accurate summaries of video content, making it easier to decide whether to watch a full video or get the main points quickly.

## Features

- Extract speech from YouTube videos using local speech recognition via Whisper or use YoutubeToText API
- Generate summaries using local AI models or popular AI services
- Chrome extension for seamless integration with YouTube 
- Support for multiple source languages (summaries currently only support English)
- Customizable summary length and style (planned feature)

## Project Structure

- `YoutubeSummarAI/`: Main project directory
  - `Youtubevpplx/`: Chrome extension directory
  - `YoutubeToText/`: Backend directory

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/YoutubeSummarAI.git
   ```
2. Navigate to the project directory:
   ```bash
   cd YoutubeSummarAI/YoutubeToText
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Create a `.env` file in the `YoutubeToText` directory
   - Add necessary API keys  (refer to `YoutubeSummarAI\YoutubeToText\.env.example`)
   - TODO: Make backend models configurable via file (currently hardcoded Llama 3.1 setup, you can put the llama 3.1 GGUF model file in the `YoutubeToText` directory)
   - Backend can be either run with ad-hoc `python main.py` or installed as windows service with `python main.py install` and uninstalled with `python main.py remove`

*note: if you are using the `python main.py install` option, you will need to run the command prompt with admin privileges*

### Chrome Extension Setup

1. Open Google Chrome/Brave/Edge/etc. and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `Youtubevpplx` directory from the project
4. You can review and change options by clicking on the YoutubeSummarAI extension icon in the Chrome toolbar

## Usage

1. Open a YouTube video in Google Chrome
2. Click on the YoutubeSummarAI extension icon
3. Select desired summary options (if available)
4. Click "Generate Summary" to get a concise summary of the video content

## Technologies Used

- Python 3.10+
  - Speech recognition libraries for text extraction
  - Natural Language Processing (NLP) libraries for summarization
- JavaScript (ES6+) for Chrome extension
- AI Models:
  - Meta-Llama-3.1-8B-Instruct for local summary generation
  - OpenAI Whisper for Youtube video to text transcription
- Chrome Extension APIs

## Development

- Backend: The Python backend handles video processing, text extraction, and summary generation.
- Frontend: The Chrome extension provides the user interface and communicates with the backend.

To contribute to the development:
1. Fork the repository
2. Create a new branch for your feature
3. Implement your changes
4. Submit a pull request with a detailed description of your modifications

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements
- https://github.com/jdepoix/youtube-transcript-api for the Youtube transcript API
- https://github.com/openai/whisper for the Whisper models
- https://github.com/ggerganov/llama.cpp for the local inference capabilites
- Contributors and open-source projects that made this possible

## Roadmap

- Make backend models and setup configurable via parameters
- Add customizable summary lengths and styles
- Integrate with more video platforms/sources

## Contact

For questions, suggestions, or collaborations, please open an issue on this repository or contact the maintainers directly.
