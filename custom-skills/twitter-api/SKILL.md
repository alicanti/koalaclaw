# Twitter API Skill

## Description
Enables agents to interact with Twitter/X via the Twitter API v2. Supports posting tweets, reading timelines, searching, and managing Twitter content.

## Capabilities
- Post tweets (text, images, polls)
- Read user timelines
- Search tweets by keywords
- Get trending topics
- Reply to tweets
- Like and retweet
- Follow/unfollow users
- Get user profiles and metrics

## Configuration
Requires Twitter API v2 credentials:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `TWITTER_BEARER_TOKEN`

## Usage
```javascript
// Post a tweet
await twitter.post("Hello from KoalaClaw! 🦞");

// Search tweets
const results = await twitter.search("AI agents");

// Get user timeline
const timeline = await twitter.getTimeline("@username");
```

## Rate Limits
- 300 tweets per 15 minutes (posting)
- 300 requests per 15 minutes (reading)
- Respects Twitter API rate limits automatically

## Security
- API keys stored securely in environment variables
- Never exposes credentials in logs
- Validates content before posting

