import sys
from llama_cpp import Llama
import os
from jinja2 import Template
import logging

modelname = "Meta-Llama-3.1-8B-Instruct-Q4_K_L.gguf"

# Set up logging
log_file_path = os.environ.get('LOG_FILE_PATH')
logging.basicConfig(filename=log_file_path, level=logging.INFO,
                    format='%(asctime)s - run_llama - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CHAT_TEMPLATE = """{% for message in messages %}<|start_header_id|>{{ message['role'] }}<|end_header_id|>

{{ message['content'] }}<|eot_id|>{% endfor %}"""

def load_model():
        # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct the full path to the model file
    model_path = os.path.join(current_dir, modelname)
    if not os.path.exists(model_path):
        logger.info("Model not found. Downloading from Hugging Face...")
        from huggingface_hub import hf_hub_download
        model_path = hf_hub_download(
            repo_id="bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
            filename=modelname,
            local_dir=current_dir,
            local_dir_use_symlinks=False
        )
        logger.info(f"Model downloaded to {model_path}")

    logger.info("Loading model...")
    llm = Llama(
        model_path=model_path,
        n_ctx=16392,  # Adjust context size as needed
        n_gpu_layers=-1,  # Use all GPU layers
        n_batch=128,  # Adjust based on your GPU memory
        verbose=False,  # Change this to False to reduce output
        use_mlock=False,
        use_mmap=True,
        n_threads=12,
        n_threads_batch=12,
        flash_attn=True
    )
    logger.info("Model loaded successfully.")
    
    return llm

def generate_response(llm, messages, max_length=4096):
    logger.info("Generating response...")
    
    # Prepare the chat history using the template
    chat_template = Template(CHAT_TEMPLATE)
    prompt = chat_template.render(messages=messages)
    
    response = llm(
        prompt,
        max_tokens=max_length,
        stop=["<|eot_id|>"],  # Stop at the end of turn token
        echo=False
    )
    logger.info("Response generated.")
    return response['choices'][0]['text'].strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error("Usage: python run_llama.py <prompt>")
        sys.exit(1)

    user_input = sys.argv[1]
    
    try:
        llm = load_model()
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": user_input}
        ]
        response = generate_response(llm, messages)
        print(response)  # This will be captured by the server
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        sys.exit(1)