curl https://hip-gw.hessian.ai/v1/chat/completions \
  -H "Authorization: Bearer $HAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vllm/Kolibri-1",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'
