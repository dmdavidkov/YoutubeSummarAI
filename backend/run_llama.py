# -*- coding: utf-8 -*-

import sys
from llama_cpp import Llama
import os
from jinja2 import Template
import logging
import traceback

repo = "bartowski/Qwen2.5-7B-Instruct-GGUF"
modelname = "Qwen2.5-7B-Instruct-Q5_K_M.gguf"

CHAT_TEMPLATE = """{%- if tools %}\n    {{- '<|im_start|>system\\n' }}\n    {%- if messages[0]['role'] == 'system' %}\n        {{- messages[0]['content'] }}\n    {%- else %}\n        {{- 'You are a helpful assistant.' }}\n    {%- endif %}\n    {{- \"\\n\\n# Tools\\n\\nYou may call one or more functions to assist with the user query.\\n\\nYou are provided with function signatures within <tools></tools> XML tags:\\n<tools>\" }}\n    {%- for tool in tools %}\n        {{- \"\\n\" }}\n        {{- tool | tojson }}\n    {%- endfor %}\n    {{- \"\\n</tools>\\n\\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\\n<tool_call>\\n{\\\"name\\\": <function-name>, \\\"arguments\\\": <args-json-object>}\\n</tool_call><|im_end|>\\n\" }}\n{%- else %}\n    {%- if messages[0]['role'] == 'system' %}\n        {{- '<|im_start|>system\\n' + messages[0]['content'] + '<|im_end|>\\n' }}\n    {%- else %}\n        {{- '<|im_start|>system\\nYou are a helpful assistant.<|im_end|>\\n' }}\n    {%- endif %}\n{%- endif %}\n{%- for message in messages %}\n    {%- if (message.role == \"user\") or (message.role == \"system\" and not loop.first) or (message.role == \"assistant\" and not message.tool_calls) %}\n        {{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>' + '\\n' }}\n    {%- elif message.role == \"assistant\" %}\n        {{- '<|im_start|>' + message.role }}\n        {%- if message.content %}\n            {{- '\\n' + message.content }}\n        {%- endif %}\n        {%- for tool_call in message.tool_calls %}\n            {%- if tool_call.function is defined %}\n                {%- set tool_call = tool_call.function %}\n            {%- endif %}\n            {{- '\\n<tool_call>\\n{\"name\": \"' }}\n            {{- tool_call.name }}\n            {{- '\", \"arguments\": ' }}\n            {{- tool_call.arguments | tojson }}\n            {{- '}\\n</tool_call>' }}\n        {%- endfor %}\n        {{- '<|im_end|>\\n' }}\n    {%- elif message.role == \"tool\" %}\n        {%- if (loop.index0 == 0) or (messages[loop.index0 - 1].role != \"tool\") %}\n            {{- '<|im_start|>user' }}\n        {%- endif %}\n        {{- '\\n<tool_response>\\n' }}\n        {{- message.content }}\n        {{- '\\n</tool_response>' }}\n        {%- if loop.last or (messages[loop.index0 + 1].role != \"tool\") %}\n            {{- '<|im_end|>\\n' }}\n        {%- endif %}\n    {%- endif %}\n{%- endfor %}\n{%- if add_generation_prompt %}\n    {{- '<|im_start|>assistant\\n' }}\n{%- endif %}\n"""

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

def generate_response(llm, messages, max_length=4096):
    logger.info("Generating response...")
    
    # Prepare the chat history using the template
    chat_template = Template(CHAT_TEMPLATE)
    prompt = chat_template.render(messages=messages)
    
    response = llm(
        prompt,
        max_tokens=max_length,
        stop=["<|endoftext|>"],
        echo=False
    )
    logger.info("Response generated.")
    return response['choices'][0]['text'].strip()

if __name__ == "__main__":
    try:
        # Log the environment variables
        logger.debug(f"LOG_FILE_PATH: {os.environ.get('LOG_FILE_PATH')}")
        logger.debug(f"PROMPT_FILE_PATH: {os.environ.get('PROMPT_FILE_PATH')}")

        # Read the prompt from the temporary file
        prompt_file_path = os.environ.get('PROMPT_FILE_PATH')
        logger.debug(f"Reading prompt from: {prompt_file_path}")
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            user_input = f.read()

        llm = load_model()
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": user_input}
        ]
        response = generate_response(llm, messages)
        logger.debug(f"Generated response: {response}")
        
        # Use sys.stdout.buffer.write() to handle Unicode characters
        sys.stdout.buffer.write(response.encode('utf-8'))
        sys.stdout.buffer.write(b'\n')
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)