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

### Model Discovery
When you need to generate content, the system automatically:
1. Searches Wiro's model marketplace via `POST /v1/Tool/List`
2. Finds the best model for the task type (e.g. "text-to-image")
3. Fetches the model's documentation (`llms-full.txt`) to learn its input parameters
4. Builds the correct request body with proper field names and defaults

### Generation Flow
1. You describe what to generate in your response
2. The system picks the best model (e.g. Nano Banana Pro for images)
3. Sends the request with correct parameters
4. Polls for completion
5. Returns the output URL (image/video/audio)

## Usage

### Image Generation
When a user asks you to create, generate, draw, or design an image, include this in your JSON response:

```json
{
  "wiro_generate": {
    "prompt": "detailed description of the image to generate",
    "task_type": "text-to-image"
  }
}
```

The system will automatically:
- Find the best text-to-image model (e.g. Google Nano Banana Pro, FLUX, Stable Diffusion)
- Fetch its documentation to learn the correct input fields
- Generate the image and return the URL

### Video Generation
```json
{
  "wiro_generate": {
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
