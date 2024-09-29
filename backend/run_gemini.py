import os
import sys
import logging
import google.generativeai as genai
from dotenv import load_dotenv

# Set up logging
log_file_path = os.environ.get('LOG_FILE_PATH')
if log_file_path:
    logging.basicConfig(filename=log_file_path, level=logging.INFO,
                        format='%(asctime)s - run_gemini - %(levelname)s - %(message)s')
else:
    logging.basicConfig(level=logging.INFO,
                        format='%(asctime)s - run_gemini - %(levelname)s - %(message)s')

logger = logging.getLogger(__name__)

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, '.env')
load_dotenv(dotenv_path)

# Configure Google AI
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    logger.error("GEMINI_API_KEY not found in environment variables")
    sys.exit(1)

genai.configure(api_key=api_key)

def process_with_gemini(prompt):
    try:
        # Create the model
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 8192,
            "response_mime_type": "text/plain",
        }

        model = genai.GenerativeModel(
            model_name='gemini-1.5-pro-exp-0827',#'gemini-1.5-flash-8b-exp-0924',#"gemini-1.5-pro-002",
            generation_config=generation_config,
        )

        chat_session = model.start_chat(history=[])

        # Send the prompt to the model
        response = chat_session.send_message(prompt)

        return response.text

    except Exception as e:
        logger.error(f"Error processing with Gemini model: {e}")
        return f"Error processing with Gemini model: {str(e)}"

if __name__ == "__main__":
    # Read the prompt from the file specified in the environment variable
    prompt_file_path = os.environ.get('PROMPT_FILE_PATH')
    if not prompt_file_path:
        logger.error("PROMPT_FILE_PATH not found in environment variables")
        sys.exit(1)

    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as file:
            prompt = file.read()
    except Exception as e:
        logger.error(f"Error reading prompt file: {e}")
        sys.exit(1)

    # Process the prompt and print the result
    result = process_with_gemini(prompt)
    print(result)