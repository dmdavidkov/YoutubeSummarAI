import sys
from llama_cpp import Llama
import os
from jinja2 import Template
import logging

repo="Qwen/Qwen2-7B-Instruct-GGUF"
modelname = "Meta-Llama-3.1-8B-Instruct-Q4_K_L.gguf"

CHAT_TEMPLATE= """{% for message in messages %}<|start_header_id|>{{ message['role'] }}<|end_header_id|>
#{{ message['content'] }}<|eot_id|>{% endfor %}"""

# Set up logging
log_file_path = os.environ.get('LOG_FILE_PATH')
logging.basicConfig(filename=log_file_path, level=logging.INFO,
                    format='%(asctime)s - run_llama - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

#CHAT_TEMPLATE_QWEN = """{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n' }}{% endif %}{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"""

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
        n_ctx=14336,#14336, #16392,  # Adjust context size as needed
        n_gpu_layers=-1,  # Use all GPU layers
        n_batch=256,  # Adjust based on your GPU memory
        verbose=False,  # Change this to False to reduce output
        use_mlock=False,
        use_mmap=True,
        n_threads=12,
        n_threads_batch=12,
        flash_attn=True,
        top_p=1.0,
        temperature=0.65,
        repeat_penalty=1.0,
        top_k=0
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