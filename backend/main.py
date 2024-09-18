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
    global whisper_model, align_model, align_metadata, diarize_model, device, whisper_model_name
    logger.info(f"Using device: {device}")
    logger.info(f"Loading WhisperX model: {model_name}")
    whisper_model = whisperx.load_model(model_name, device, compute_type="int8" if device == "cuda" else "float32")
    whisper_model_name = model_name
    logger.info("Loading alignment model...")
    align_model, align_metadata = whisperx.load_align_model(language_code="en", device=device)
    logger.info("Loading diarization model...")
    diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_auth_token, device=device)
    logger.info("All models loaded successfully")

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
        result = whisper_model.transcribe(audio_path, batch_size=16 if device == "cuda" else 1, language=video_details.get('language', 'en'))
        if result["language"] == 'en':
            result = whisperx.align(result["segments"], align_model, align_metadata, audio_path, device, return_char_alignments=False)

        # 3. Assign speaker labels
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
           
        # Clear GPU memory
        if device == "cuda":
            torch.cuda.empty_cache()
            logger.info("GPU memory cleared after transcription")
        return transcription
    
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        traceback.print_exc()
        return None
    
def format_timestamp(seconds):
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"

@app.route('/transcribe', methods=['POST'])
def transcribe():
    global last_response_cache, whisper_model, whisper_model_name
    
    logger.info("Received transcription request")
    
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
            logger.info(f"Requested Whisper model '{whisper_model_requested}' differs from loaded model '{whisper_model_name}'. Reloading...")
            load_models(whisper_model_requested)
        
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
    prompt = f"""1.Read the following video transcript carefully, because you'll be asked to perform series of tasks based on them (especially the transcript!):

<video_details>
Channel name: {video_details.get('channel', 'Unknown')}
Video title: {video_details.get('title', 'Unknown')}
View count: {video_details.get('views', 'Unknown')}
Likes count: {video_details.get('likes', 'Unknown')}
Description: {video_details.get('description', 'Unknown')}
Video URL: {video_url}
Transcript: 
{transcript or 'Transcription failed'}
</video_details>

2. The transcript is in the following format: 
[start_time - end_time] speaker: transcribed text
, where start_time signifies when the first word of the transcribed text is spoken and end time when the last word of the transribed text is spoken. "speaker" is the attempt of the transtription algorithm to separate speakers if there are multiple, but it will just say "SPEAKER_00" or "SPEAKER_01" and so on, it's your job to try to identify the speakers.

3. You are an award-winning journalist, you have a reputation for producing informative and unbiased summaries. Your task is to carefully review the video content and extract the crucial facts, presenting them in a clear and organized manner. Prioritize accuracy and objectivity, allowing the information to speak for itself without editorializing. You know many languages and can provide summaries using both the transcript's original language and English.


4. Make a clear distinction between:
a. presented factual and objective data and information
b. personal experience, opinions and subjective information 
c. information presented as a fact, but might need cross-checking
Report all three, but flag them appropriately so the reader knows which is which. If you are unsure or don't have enough information to provide a confident categorization, simply say "I don't know" or "I'm not sure."

5. Use blended summarization technique combining  abstractive summarization (70-90%) extractive summarization (10-30%). Adjust this ratio as needed based on the type of content. Endeavor to address the full breadth of the transcript without significant omissions. Make sure the extracted quotes are short, important and impactful to the narrative.

6. Aim for a summary length that is approximately 20% of the full video transcript. For example, if the transcript is 5000 words long, target a summary of roughly 1000 words. Try to cover the video in full without gaps. However, if the transcript is exceptionally long (over 10,000 words):
   a. Focus on providing timestamps that cover the entire content.
   b. Use shorter summaries for each section to maintain a comprehensive overview.
   c. Ensure that the overall structure still captures the main points and flow of the video.

7. Break down the summary into a chain of key sections or topics. Use these to logically structure it, creating an H1 heading for each main point in the chain of reasoning. 

8. Under each H1 section heading, write 1-3 sentences concisely summarizing the essential information from that section. Aim for an even coverage of the main points.

9. Organize the summary clearly using H2 and H3 subheadings as appropriate to reinforce the logical flow. Utilize bullet points to enhance readability of longer paragraphs or list items. Selectively bold key terms for emphasis. Use blockquotes to highlight longer verbatim quotations.

10. Generate clickable timestamp links for each section header and key point or quote used. Append them after the relevant text. To calculate the timestamp link follow these steps:

a. Note down the starting point of the relevant part of the video in H:MM:SS format (e.g. 0:14:16) 
b. Convert the hours and minutes portions to seconds (e.g. 14 minutes = 14 * 60 = 840 seconds)
c. Add the remaining seconds (e.g. 840 + 16 = 856 seconds total) 
d. Append "&t=X" to the video URL, replacing X with the final total seconds (e.g. &t=856)
e. Format the full link as: [H:MM:SS]({video_url}&t=X) (e.g. [0:14:18]({video_url}&t=856) )

It is crucial to select precise starting timestamps for the links. For example, consider the following transcript excerpt:

[00:01:10.52 - 00:01:15.68] SPEAKER_00: We train these models to spend more time thinking through problems before they respond, much like a person would.
[00:01:15.84 - 00:01:20.16] SPEAKER_00: Through training, they learn to refine their thinking process, try different strategies and recognize their mistakes.
[00:01:20.54 - 00:01:25.03] SPEAKER_00: In our test, the next model update performs similarly to PhD students
[00:01:25.42 - 00:01:29.55] SPEAKER_00:  on challenging benchmark tasks in physics, chemistry, and biology.
[00:01:29.73 - 00:01:40.47] SPEAKER_00: We also found that it excels in math and coding in a qualifying exam in the International Mathematics Olympiad, GPT-40 correctly solved only 13% of problems while the reasoning model scored 83%.
[00:01:41.25 - 00:01:47.14] SPEAKER_00: That is a massive, massive, multiple-time improvement over GPT-40 in math.
[00:01:47.30 - 00:01:52.92] SPEAKER_00:  Their coding abilities were evaluated in contests and reached the 89th percentile in code forces competitions.
[00:01:52.96 - 00:01:55.28] SPEAKER_00: You can read more about this in our technical research post.
[00:01:55.50 - 00:01:56.67] SPEAKER_00: I'll get to that in a moment.

The correct starting timestamp for the quote "In our test, the next model update performs similarly to PhD students on challenging benchmark tasks in physics, chemistry, and biology." would be [00:01:20.54], because that is when the first word "We" appears in the transcript and we take the starting time. Time calculated to seconds in this case is t=80.

11. Vary the sentence structures throughout to maintain an engaging narrative flow. Ensure smooth transitions between sentences and sections. Adopt a consistent voice aligned with the original video's tone.

12. Revise the full summary, checking for any unintended bias or editorializing. Aim to neutrally represent the content of the original video. Consider engaging in a feedback loop with a human reviewer to iteratively optimize the summary.

13. Provide your final video summary, ready for publication. Use all known Markdown operators to present the output."""
    
    logger.info("Copying prompt to clipboard")
    pyperclip.copy(prompt)

    if prompt:
        logger.info("Updating cache with new response")
        last_response_cache = {"url": video_url, "prompt": str(prompt)}
        
        if process_locally:
            logger.info("Processing prompt locally with Llama 3.1 8B model")
            response = process_with_llama(prompt)
            return jsonify({"response": response, "cached": False})
        else:
            logger.info("Returning prompt for external processing")
            return jsonify({"prompt": str(prompt), "cached": False})
    else:
        logger.error("Failed to generate prompt")
        return jsonify({"error": "Failed to generate prompt"}), 500

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
    logger.info("Processing prompt with Llama 3.1 8B model")
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        run_llama_path = os.path.join(current_dir, "run_llama.py")
        
        logger.info(f"Attempting to run Llama model with script at: {run_llama_path}")
        
        # Pass the log file path as an environment variable
        env = {
            **os.environ,
            'PYTHONPATH': current_dir,
            'LOG_FILE_PATH': log_file  # Assuming log_file is defined earlier in main.py
        }
        
        result = subprocess.run(
            ["python", run_llama_path, prompt],
            capture_output=True,
            text=True,
            check=True,
            env=env
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        logger.error(f"Error processing with Llama model: {e}")
        logger.error(f"Stderr: {e.stderr}")
        return f"Error processing with Llama model: {e.stderr}"
    except Exception as e:
        logger.error(f"Unexpected error in process_with_llama: {e}")
        return f"Unexpected error: {str(e)}"

if __name__ == '__main__':
    if len(sys.argv) > 1:
        win32serviceutil.HandleCommandLine(YouTubeTranscriptionService)
    else:
        print("Running as standalone script...")
        run_server()
