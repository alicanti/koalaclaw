# ElevenLabs TTS Skill

## Description
Enables agents to generate high-quality text-to-speech audio using ElevenLabs API. Supports multiple voices, languages, and audio formats.

## Capabilities
- Convert text to speech
- Multiple voice options
- Adjust voice settings (stability, similarity, style)
- Generate audio in various formats (MP3, WAV, etc.)
- Clone voices (with permission)
- Generate long-form audio
- Batch text-to-speech conversion

## Configuration
Requires ElevenLabs API key:
- `ELEVENLABS_API_KEY`

## Usage
```javascript
// Generate speech
const audio = await elevenlabs.textToSpeech({
  text: "Hello from KoalaClaw!",
  voice: "Rachel", // or custom voice ID
  model: "eleven_multilingual_v2"
});

// With custom settings
const audio = await elevenlabs.textToSpeech({
  text: "Custom voice settings",
  voice: "custom_voice_id",
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0
});
```

## Voice Options
- Pre-built voices (Rachel, Adam, etc.)
- Custom cloned voices
- Multilingual support
- Different speaking styles

## Audio Formats
- MP3 (default)
- WAV
- PCM
- OGG

## Rate Limits
- Depends on ElevenLabs subscription
- Character limits per request
- Respects API rate limits

## Cost Management
- Tracks character usage
- Estimates cost before generation
- Supports usage limits

