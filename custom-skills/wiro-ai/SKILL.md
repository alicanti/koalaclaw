# Wiro AI Skill

## Description
Enables agents to generate images, videos, and audio using Wiro AI's model marketplace. The agent automatically discovers the best model for the task, reads its documentation, builds the correct parameters, and returns the generated output.

## Capabilities
- Generate images from text prompts (text-to-image)
- Edit images with text instructions (image-to-image)
- Generate videos from text or image
- Generate speech from text (text-to-speech)
- Automatically discover and select the best model for the task
- Read model documentation to use correct parameters

## Configuration
Requires Wiro AI credentials (set via KoalaClaw Settings UI or CLI):
- `WIRO_API_KEY` — Your Wiro API key
- `WIRO_API_SECRET` — Your Wiro API secret

Get credentials at: https://wiro.ai/dashboard

## How It Works

### Two-Step Flow: Suggest Then Generate
When a user asks to generate content:

**Step 1 — Suggest models:** Use `wiro_suggest` to show 2-3 model options with cost and speed info. The system searches Wiro's marketplace, ranks models, and returns options for the user to pick.

**Step 2 — Generate:** After the user picks a model (by number or name), use `wiro_generate` with the chosen model. The system fetches the model's documentation (`llms-full.txt`), builds correct parameters, generates, and returns the output URL.

### Model Discovery
The system automatically:
1. Searches Wiro's model marketplace via `POST /v1/Tool/List`
2. Ranks models by speed (fast-inference tag), popularity, and provider reputation
3. Fetches the chosen model's documentation to learn its exact input parameters
4. Builds the correct request body with proper field names and defaults

## Usage

### Step 1: Suggest Models (first time)
When a user asks to generate something, first suggest models:

```json
{
  "wiro_suggest": {
    "prompt": "detailed description of what to generate",
    "task_type": "text-to-image"
  }
}
```

The system will return 2-3 model options with name, cost, and speed. The user picks one.

### Step 2: Generate with chosen model
After the user picks a model (e.g. "1" or "nano banana"):

```json
{
  "wiro_generate": {
    "prompt": "detailed description",
    "task_type": "text-to-image",
    "model": "google/nano-banana-pro"
  }
}
```

If no model specified, the system auto-selects the best one.

### Video Generation
```json
{
  "wiro_suggest": {
    "prompt": "description of the video to generate",
    "task_type": "text-to-video"
  }
}
```

### Audio/Speech Generation
```json
{
  "wiro_generate": {
    "prompt": "text to convert to speech",
    "task_type": "text-to-speech"
  }
}
```

## Available Model Categories
The system searches Wiro's marketplace which includes 100+ models:
- **Image**: Nano Banana Pro (Gemini 3 Pro), FLUX, Stable Diffusion, Ideogram, Recraft
- **Video**: Seedance, Kling, MiniMax, Hailuo
- **Audio**: ElevenLabs, Fish Speech

## Best Practices
- Write detailed, descriptive prompts for better results
- Specify style, mood, lighting, composition in image prompts
- The system handles model selection — you focus on the creative description
- For image editing, describe what changes to make clearly
- Results are returned as URLs — include them in your response to the user
- The chat UI auto-renders images, videos (with player controls), and audio inline with a download button

## Rate Limits
- Depends on Wiro subscription tier
- Generation typically takes 5-30 seconds depending on model
- The system polls automatically until complete

## Cost
- Each generation has a small cost based on the model used
- Cost is shown in Wiro dashboard
- Typical image generation: $0.003-0.01 per image
