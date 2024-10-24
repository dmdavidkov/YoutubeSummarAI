# -*- coding: utf-8 -*-

import sys
from llama_cpp import Llama
import os
from jinja2 import Template
import logging
import traceback

repo = "bartowski/qwen2.5-7b-ins-v3-GGUF"
modelname = "qwen2.5-7b-ins-v3-Q5_K_M.gguf"

CHAT_TEMPLATE = """{% set system_message = 'You are a helpful assistant.' %}{% if messages[0]['role'] == 'system' %}{% set loop_messages = messages[1:] %}{% set system_message = messages[0]['content'] %}{% else %}{% set loop_messages = messages %}{% endif %}{% if system_message is defined %}{{ '<|im_start|>system\n' + system_message + '<|im_end|>\n' }}{% endif %}{% for message in loop_messages %}{% set content = message['content'] %}{% if message['role'] == 'user' %}{{ '<|im_start|>user\n' + content + '<|im_end|>\n<|im_start|>assistant\n' }}{% elif message['role'] == 'assistant' %}{{ content + '<|im_end|>' + '\n' }}{% endif %}{% endfor %}"""

# Set up logging
log_file_path = os.environ.get('LOG_FILE_PATH')
logging.basicConfig(filename=log_file_path, level=logging.DEBUG,
                    format='%(asctime)s - run_llama - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_model():
    # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct the full path to the model file
    model_path = os.path.join(current_dir, modelname)
    if not os.path.exists(model_path):
        logger.info("Model not found. Downloading from Hugging Face...")
        from huggingface_hub import hf_hub_download
        model_path = hf_hub_download(
            repo_id=repo,
            filename=modelname,
            local_dir=current_dir
        )
        logger.info(f"Model downloaded to {model_path}")

    logger.info("Loading model...")
    llm = Llama(
        model_path=model_path,
        n_ctx=32784,
        n_batch=512,
        n_gpu_layers=-1,
        flash_attn=True,
        n_threads=12,
        n_threads_batch=12   
    )
    logger.info("Model loaded successfully.")
    
    return llm

def generate_response(llm, messages, max_length=8192):
    logger.info("Generating response...")
    
    # Prepare the chat history using the template
    chat_template = Template(CHAT_TEMPLATE)
    prompt = chat_template.render(messages=messages)
    
    response = llm(
        prompt,
        max_tokens=max_length,
        stop=["<|im_end|>"],
        echo=False
    )
    logger.info("Response generated.")
    return response['choices'][0]['text'].strip()

if __name__ == "__main__":
    try:
        # Log the environment variables
        # logger.debug(f"LOG_FILE_PATH: {os.environ.get('LOG_FILE_PATH')}")
        # logger.debug(f"PROMPT_FILE_PATH: {os.environ.get('PROMPT_FILE_PATH')}")

        # Read the prompt from the temporary file
        prompt_file_path = os.environ.get('PROMPT_FILE_PATH')
        logger.debug(f"Reading prompt from: {prompt_file_path}")
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            user_input = f.read()

        llm = load_model()
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant. Do not say what you will do, just output the end result."},
            {"role": "user", "content": user_input}
        ]
        response = generate_response(llm, messages)
        # logger.debug(f"Generated response: {response}")
        
        # Use sys.stdout.buffer.write() to handle Unicode characters
        sys.stdout.buffer.write(response.encode('utf-8'))
        sys.stdout.buffer.write(b'\n')
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)