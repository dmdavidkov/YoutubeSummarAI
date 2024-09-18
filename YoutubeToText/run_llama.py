import sys
from llama_cpp import Llama
import os
from jinja2 import Template

CHAT_TEMPLATE = """<|begin_of_text|>{% for message in messages %}<|start_header_id|>{{ message['role'] }}<|end_header_id|>

{{ message['content'] }}<|eot_id|>{% endfor %}"""

def load_model():
    # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct the full path to the model file
    model_path = os.path.join(current_dir, "Meta-Llama-3.1-8B-Instruct-Q6_K_L.gguf")
  
    print("Loading model...", file=sys.stderr)
    llm = Llama(
        model_path=model_path,
        n_ctx=14336,  # Adjust context size as needed
        n_gpu_layers=-1,  # Use all GPU layers
        n_batch=192,  # Adjust based on your GPU memory
        verbose=False,  # Change this to False to reduce output
        use_mlock=False,
        use_mmap=True,
        n_threads=12,
        n_threads_batch=12,
        flash_attn=True
    )
    print("Model loaded successfully.", file=sys.stderr)
    
    return llm

def generate_response(llm, messages, max_length=4096):
    print("Generating response...", file=sys.stderr)
    
    # Prepare the chat history using the template
    chat_template = Template(CHAT_TEMPLATE)
    prompt = chat_template.render(messages=messages)
    
    response = llm(
        prompt,
        max_tokens=max_length,
        stop=["<|eot_id|>"],  # Stop at the end of turn token
        echo=False
    )
    print("Response generated.", file=sys.stderr)
    return response['choices'][0]['text'].strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_llama.py <prompt>")
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
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)