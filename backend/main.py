from flask import Flask, request, jsonify
import yt_dlp
import os
import uuid
import traceback
import glob
import pyperclip
import time
import re
import requests
from dotenv import load_dotenv 
import logging
from logging import FileHandler
import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import threading
from werkzeug.serving import make_server
import torch
import whisperx
from youtube_transcript_api import YouTubeTranscriptApi
import subprocess
import numpy as np
import codecs
import socket
import tempfile
import jinja2
import csv
import io

# Set up logging
log_dir = os.path.join(os.environ['PROGRAMDATA'], 'YouTubeTranscriptionService')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'youtube_transcription_service.log')

handler = FileHandler(log_file, mode='w', encoding='utf-8')
formatter = logging.Formatter('%(asctime)s - main - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Add a StreamHandler only if running as a standalone script
if hasattr(sys, 'stdout') and sys.stdout is not None:
    console_handler = logging.StreamHandler(codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict'))
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# At the top of your file, after the imports
script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, '.env')
load_dotenv(dotenv_path)

app = Flask(__name__)
yt_api_Key = os.environ.get('YOUTUBE_API_KEY')
hf_auth_token = os.environ.get('HF_AUTH_TOKEN')

# Add this check right after loading the API key
if not yt_api_Key:
    logger.error("YouTube API key not found. Please set YOUTUBE_API_KEY in .env file")

# Add a global variable to store the last response
last_response_cache = None

# Global variables for models and device
whisper_model = None
whisper_model_name = "base"  # Set default model name to "base"
align_model = None
align_metadata = None
diarize_model = None
device = "cuda" if torch.cuda.is_available() else "cpu"

def load_models(model_name="base"):
    global align_model, align_metadata, diarize_model, device, whisper_model_name
    logger.info(f"Using device: {device}")
    whisper_model_name = model_name
    logger.info("Models will be loaded when needed")

def load_whisper_model():
    global whisper_model, device, whisper_model_name
    logger.info(f"Loading WhisperX model: {whisper_model_name}")
    whisper_model = whisperx.load_model(whisper_model_name, device, compute_type="int8" if device == "cuda" else "float32")
    logger.info("Whisper model loaded successfully")

def load_align_model():
    global align_model, align_metadata, device
    logger.info("Loading alignment model...")
    align_model, align_metadata = whisperx.load_align_model(language_code="en", device=device)
    logger.info("Alignment model loaded successfully")

def load_diarize_model():
    global diarize_model, device
    logger.info("Loading diarization model...")
    diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_auth_token, device=device)
    logger.info("Diarization model loaded successfully")

def unload_models():
    global whisper_model, align_model, align_metadata, diarize_model
    whisper_model = None
    align_model = None
    align_metadata = None
    diarize_model = None
    if device == "cuda":
        torch.cuda.empty_cache()
    logger.info("All models unloaded and GPU memory cleared")

def download_youtube_audio(url, output_path='.'):
    logger.info(f"Downloading audio from URL: {url}")
    unique_filename = f"{uuid.uuid4()}.wav"
    full_path = os.path.join(output_path, unique_filename)
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'outtmpl': full_path,
        'postprocessor_args': [
            '-ar', '16000',
            '-ac', '1',
        ],
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        downloaded_files = glob.glob(f"{full_path}*")
        if downloaded_files:
            return downloaded_files[0]
        else:
            return None
    except Exception as e:
        logger.error(f"An error occurred while downloading the audio: {e}")
        return None

def format_timestamp(seconds):
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{seconds:05.2f}"

def transcribe_audio(audio_path, video_details):
    global whisper_model, align_model, align_metadata, diarize_model, device
    logger.info(f"Transcribing audio file: {audio_path}")
    start_time = time.time()
    
    try:
        load_whisper_model()
        result = whisper_model.transcribe(audio_path, batch_size=16 if device == "cuda" else 1, language=video_details.get('language', 'en'))
        
        if result["language"] == 'en':
            load_align_model()
            result = whisperx.align(result["segments"], align_model, align_metadata, audio_path, device, return_char_alignments=False)

        load_diarize_model()
        diarize_segments = diarize_model(audio_path)
        result = whisperx.assign_word_speakers(diarize_segments, result)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        logger.info(f"Transcription completed in {execution_time:.2f} seconds")
        
        transcription = ""
        for segment in result["segments"]:
            start_time = format_timestamp(segment["start"])
            end_time = format_timestamp(segment["end"])
            text = segment["text"]
            speaker = segment.get("speaker") if isinstance(segment, dict) else None
            transcription += f"[{start_time} - {end_time}] {speaker}: {text}\n"
        
        unload_models()
        
        return transcription
    
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        traceback.print_exc()
        unload_models()
        return None
    
def format_timestamp(seconds):
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"

@app.route('/transcribe', methods=['POST'])
def transcribe():
    global last_response_cache, whisper_model_name
    
    logger.info("Received transcription request")
    
    # Add this check at the start of the route
    if not yt_api_Key:
        error_msg = "YouTube API key not configured. Please set YOUTUBE_API_KEY in the .env file"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 500
    
    video_url = request.json.get('url')
    transcription_method = request.json.get('transcriptionMethod')
    process_locally = request.json.get('processLocally', False)
    
    if not video_url:
        logger.error("No URL provided in the request")
        return jsonify({"error": "No URL provided"}), 400
    
    if not transcription_method:
        logger.error("No transcriptionMethod provided in the request")
        return jsonify({"error": "transcriptionMethod is required"}), 400
    
    logger.info(f"Processing video URL: {video_url}")
    logger.info(f"Transcription method: {transcription_method}")
    logger.info(f"Process locally: {process_locally}")
    
    # Check if the cached response exists and the URL matches
    if last_response_cache and last_response_cache['url'] == video_url:
        logger.info("Returning cached response")
        return jsonify({"prompt": last_response_cache['prompt'], "cached": True})
    
    logger.info("Extracting video ID")
    video_id = extract_video_id(video_url)
    
    logger.info("Fetching video details from YouTube API")
    video_details = get_video_details(video_id, transcription_method)
    
    if video_details is None:
        logger.error("Failed to retrieve video details")
        return jsonify({"error": "Failed to retrieve video details"}), 500
    
    if transcription_method == 'whisper':
        whisper_model_requested = request.json.get('whisperModel', 'base')
        if whisper_model_requested != whisper_model_name:
            logger.info(f"Requested Whisper model '{whisper_model_requested}' differs from current model name '{whisper_model_name}'. Updating...")
            whisper_model_name = whisper_model_requested
        
        logger.info("Using local transcription with WhisperX")
        logger.info("Downloading YouTube audio")
        audio_path = download_youtube_audio(video_url)
        if not audio_path:
            logger.error("Failed to download audio")
            return jsonify({"error": "Failed to download audio"}), 500
        
        logger.info("Transcribing audio")
        transcript = transcribe_audio(audio_path, video_details)
        
        try:
            logger.info("Removing temporary audio file")
            os.remove(audio_path)
        except Exception as e:
            logger.error(f"Error removing temporary file: {e}")
    elif transcription_method == 'youtube':
        logger.info("Using transcript from YouTube API")
        transcript = video_details.get('transcript')
        if not transcript:
            logger.error("Failed to fetch transcript from YouTube API")
            return jsonify({"error": "Failed to fetch transcript from YouTube API"}), 500
    else:
        logger.error(f"Invalid transcription method: {transcription_method}")
        return jsonify({"error": "Invalid transcription method"}), 400

    logger.info("Generating prompt")
    prompt_template = load_prompt_template()
    if not prompt_template:
        return jsonify({"error": "Failed to load prompt template"}), 500

    template = jinja2.Template(prompt_template)
    prompt = template.render(
        channel=video_details.get('channel', 'Unknown'),
        title=video_details.get('title', 'Unknown'),
        views=video_details.get('views', 'Unknown'),
        likes=video_details.get('likes', 'Unknown'),
        description=video_details.get('description', 'Unknown'),
        video_url=video_url,
        transcript=transcript or 'Transcription failed'
    )

    logger.info("Copying prompt to clipboard")
    pyperclip.copy(prompt)

    if prompt:
        logger.info("Updating cache with new response")
        last_response_cache = {"url": video_url, "prompt": str(prompt)}
        
        if process_locally:
            logger.info("Processing prompt locally with Llama 3.1 8B model")
            response = process_with_llama(prompt)
            # Save the prompt and result immediately for local processing
            save_prompt_and_result_to_csv(prompt, response)
            return jsonify({"response": response, "cached": False})
        else:
            logger.info("Returning prompt for external processing")
            return jsonify({"prompt": str(prompt), "cached": False, "video_url": video_url})
    else:
        logger.error("Failed to generate prompt")
        return jsonify({"error": "Failed to generate prompt"}), 500

@app.route('/save_result', methods=['POST'])
def save_result():
    data = request.json
    prompt = data.get('prompt')
    result = data.get('result')

    if not all([prompt, result]):
        logger.error("Missing required data in save_result request")
        return jsonify({"error": "Missing required data"}), 400

    try:
        save_prompt_and_result_to_csv(prompt, result)
        return jsonify({"message": "Result saved successfully"}), 200
    except Exception as e:
        logger.error(f"Error saving result: {e}")
        return jsonify({"error": "Failed to save result"}), 500

def extract_video_id(url):
    logger.info(f"Extracting video ID from URL: {url}")
    video_id = re.findall(r"v=(\S{11})", url)[0]
    return video_id
# Function to get video details from YouTube Data API
def get_video_details(video_id, transcription_method):
    logger.info(f"Fetching video details for video ID: {video_id}")
    api_url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={video_id}&key={yt_api_Key}"
    
    # Log the API key (partially masked)
    masked_key = yt_api_Key[:4] + '*' * (len(yt_api_Key) - 8) + yt_api_Key[-4:] if yt_api_Key else 'Not set'
    logger.info(f"Using API key: {masked_key}")
    logger.info(f"Full API URL: {api_url.replace(yt_api_Key, masked_key)}")
    
    try:
        json_url = requests.get(api_url)
        json_url.raise_for_status()  # This will raise an exception for HTTP errors
        data = json_url.json()
        
        # Log the response status and content (be careful not to log sensitive information)
        logger.info(f"API Response Status: {json_url.status_code}")
        logger.info(f"API Response Content: {json_url.text[:500]}...")  # Log first 500 characters

        if 'items' in data and data['items']:
            video_data = data['items'][0]
            snippet = video_data['snippet']
            statistics = video_data['statistics']
            
            channel_title = snippet['channelTitle']
            video_title = snippet['title']  
            view_count = statistics['viewCount']
            like_count = statistics.get('likeCount', None)
            description = snippet['description']
            try:
                language = snippet['defaultLanguage'][:2] if isinstance(snippet, dict) else 'en'
            except Exception as e:
                logger.error(f"No default language, defaulting to EN.")
                language = 'en'           
            
            # Fetch transcript if not using local transcription
            transcript = None
            if transcription_method == 'youtube':
                try:
                    logger.info("Fetching transcript from YouTube API")
                    transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
                    transcript = format_youtube_transcript(transcript_data)
                except Exception as e:
                    logger.error(f"Error fetching transcript from YouTube API: {e}")
                    transcript = None
            
            return {
                "channel": channel_title,
                "title": video_title,
                "views": view_count,
                "likes": like_count,
                "description": description,
                "language": language,
                "transcript": transcript
            }
        else:
            logger.error(f"No items found in API response for video ID: {video_id}")
            return None
    except requests.RequestException as e:
        logger.error(f"Error fetching video details: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in get_video_details: {e}")
        return None

def format_youtube_transcript(transcript_data):
    formatted_transcript = ""
    for entry in transcript_data:
        start_time = format_timestamp(entry['start'])
        end_time = format_timestamp(entry['start'] + entry['duration'])
        text = entry['text']
        formatted_transcript += f"[{start_time} - {end_time}] SPEAKER_00: {text}\n"
    return formatted_transcript

def shutdown_server():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()

class ServerThread(threading.Thread):
    def __init__(self, app):
        threading.Thread.__init__(self)
        self.server = make_server('0.0.0.0', 5000, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        # Add this log message
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()

class YouTubeTranscriptionService(win32serviceutil.ServiceFramework):
    _svc_name_ = "YouTubeTranscriptionService"
    _svc_display_name_ = "YouTube Transcription Service"
    _svc_description_ = "A service for transcribing YouTube videos"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.is_alive = True
        self.thread = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        self.is_alive = False
        if self.thread:
            self.thread.join(timeout=10)  # Wait for up to 10 seconds for the thread to finish
        self.ReportServiceStatus(win32service.SERVICE_STOPPED)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ''))
        
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")
        
        # Reload environment variables
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dotenv_path = os.path.join(script_dir, '.env')
        load_dotenv(dotenv_path)
        
        global yt_api_Key, hf_auth_token
        yt_api_Key = os.environ.get('YOUTUBE_API_KEY')
        hf_auth_token = os.environ.get('HF_AUTH_TOKEN')
        if not yt_api_Key:
            logger.error(f"YouTube API key not found in environment variables. Checked .env file at: {dotenv_path}")
        else:
            logger.info("YouTube API key loaded successfully")
        if not hf_auth_token:
            logger.error(f"Hugging Face auth token not found in environment variables. Checked .env file at: {dotenv_path}")
        else:
            logger.info("Hugging Face auth token loaded successfully")
        
        # Load models before starting the server thread
        load_models()
        
        self.thread = threading.Thread(target=self.main)
        self.thread.start()
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)

    def main(self):
        ip_address = get_local_ip()
        port = 5000  # You can change this if needed
        logger.info(f"Starting server. API will be accessible at http://{ip_address}:{port}")
        server = ServerThread(app)
        server.start()
        while self.is_alive:
            time.sleep(1)
        server.shutdown()

def get_local_ip():
    try:
        # This method gets the IP address the machine uses to connect to the internet
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        logger.error(f"Error getting local IP: {e}")
        return '127.0.0.1'  # Return localhost if an error occurs
    
def run_server():
    load_models("base")  # Explicitly load the "base" model on startup
    
    # Get the actual IP address of the machine
    ip_address = get_local_ip()
    
    # Add this log message with the correct IP address
    logger.info(f"Starting server. API will be accessible at http://{ip_address}:5000")
    app.run(host='0.0.0.0', port=5000)

def process_with_llama(prompt):
    logger.info("Processing prompt with Local model")
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        run_local_path = os.path.join(current_dir, "run_llama.py")
        
        logger.info(f"Attempting to run Local model with script at: {run_local_path}")
        
        # Create a temporary file to store the prompt
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, encoding='utf-8') as temp_file:
            temp_file.write(prompt)
            temp_file_path = temp_file.name

        # Pass the log file path and temp file path as environment variables
        env = {
            **os.environ,
            'PYTHONPATH': current_dir,
            'LOG_FILE_PATH': log_file,
            'PROMPT_FILE_PATH': temp_file_path
        }
        
        # Set a timeout for the subprocess (e.g., 10 minutes)
        timeout = 600  # seconds
        
        result = subprocess.run(
            ["python", run_local_path],
            capture_output=True,
            text=True,
            check=True,
            env=env,
            timeout=timeout
        )

        # Remove the temporary file
        os.unlink(temp_file_path)

        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.error("Local model processing timed out")
        return "The Local model processing timed out. Please try again with a shorter prompt or simplify your request."
    except subprocess.CalledProcessError as e:
        logger.error(f"Error processing with Local model: {e}")
        logger.error(f"Stderr: {e.stderr}")
        return f"Error processing with Local model: {e.stderr}"
    except Exception as e:
        logger.error(f"Unexpected error in process_with_llama: {e}")
        return f"Unexpected error: {str(e)}"

def load_prompt_template():
    template_path = os.path.join(script_dir, 'prompt_template.txt')
    try:
        with open(template_path, 'r', encoding='utf-8') as file:
            return file.read()
    except FileNotFoundError:
        logger.error(f"Prompt template file not found at {template_path}")
        return None

def save_prompt_and_result_to_csv(prompt, result):
    csv_file_path = os.path.join(script_dir, 'generated_prompts_and_results.csv')
    file_exists = os.path.isfile(csv_file_path)
    
    try:
        with open(csv_file_path, 'a', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['prompt', 'result']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, 
                                    quoting=csv.QUOTE_ALL, 
                                    escapechar='\\', 
                                    doublequote=True)
            
            if not file_exists:
                writer.writeheader()
            
            # Escape any existing double quotes in the content
            prompt = prompt.replace('"', '""')
            result = result.replace('"', '""')
            
            writer.writerow({
                'prompt': prompt,
                'result': result
            })
        
        logger.info(f"Prompt and result saved to CSV file: {csv_file_path}")
    except Exception as e:
        logger.error(f"Error saving prompt and result to CSV: {e}")
        raise

if __name__ == '__main__':
    if len(sys.argv) > 1:
        win32serviceutil.HandleCommandLine(YouTubeTranscriptionService)
    else:
        print("Running as standalone script...")
        run_server()
