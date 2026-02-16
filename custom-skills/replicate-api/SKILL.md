# Replicate API Skill

## Description
Enables agents to generate images, videos, and other media using Replicate's AI models. Supports various image generation, video processing, and AI model APIs.

## Capabilities
- Generate images from text prompts
- Upscale images
- Remove backgrounds
- Generate videos
- Run AI models (Stable Diffusion, etc.)
- Process media files
- Batch operations

## Configuration
Requires Replicate API key:
- `REPLICATE_API_TOKEN`

## Usage
```javascript
// Generate image
const image = await replicate.generateImage({
  prompt: "A koala with claws coding on a computer",
  model: "stability-ai/stable-diffusion"
});

// Upscale image
const upscaled = await replicate.upscale(imageUrl);

// Remove background
const noBg = await replicate.removeBackground(imageUrl);
```

## Supported Models
- Stable Diffusion (image generation)
- Real-ESRGAN (image upscaling)
- Background removal models
- Video generation models
- Custom fine-tuned models

## Rate Limits
- Depends on Replicate subscription tier
- Implements queue for batch operations
- Respects API rate limits

## Cost Management
- Tracks API usage and costs
- Estimates cost before running
- Supports cost limits

