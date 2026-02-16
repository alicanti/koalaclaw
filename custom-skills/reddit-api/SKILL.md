# Reddit API Skill

## Description
Enables agents to interact with Reddit via the Reddit API. Supports posting, commenting, reading subreddits, and managing Reddit content.

## Capabilities
- Post to subreddits (text, links, images)
- Comment on posts
- Read subreddit feeds
- Search Reddit
- Get post details and comments
- Upvote/downvote
- Get user profiles
- Monitor subreddits for mentions

## Configuration
Requires Reddit OAuth credentials:
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USERNAME`
- `REDDIT_PASSWORD`
- `REDDIT_USER_AGENT` (required by Reddit API)

## Usage
```javascript
// Post to subreddit
await reddit.post("r/programming", "Check out this new AI tool!");

// Read subreddit
const posts = await reddit.getSubreddit("r/MachineLearning");

// Comment on post
await reddit.comment("post_id", "Great post! Thanks for sharing.");
```

## Rate Limits
- 60 requests per minute (default)
- Respects Reddit API rate limits
- Implements exponential backoff

## Security
- OAuth tokens stored securely
- Validates subreddit rules before posting
- Never posts spam or low-quality content

