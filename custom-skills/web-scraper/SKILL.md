# Web Scraper Skill

## Description
Enables agents to scrape and extract content from websites. Uses Readability for clean text extraction and supports various content types.

## Capabilities
- Scrape web pages
- Extract clean text content
- Extract images and media
- Parse HTML structure
- Extract metadata (title, description, etc.)
- Handle JavaScript-rendered content
- Follow links and crawl sites
- Extract structured data (tables, lists)

## Configuration
No API keys required. Uses browser automation and Readability library.

## Usage
```javascript
// Scrape single page
const content = await scraper.scrape("https://example.com/article");

// Extract text only
const text = await scraper.extractText("https://example.com");

// Extract images
const images = await scraper.extractImages("https://example.com");

// Crawl multiple pages
const pages = await scraper.crawl("https://example.com", {
  maxPages: 10,
  followLinks: true
});
```

## Features
- Respects robots.txt
- Handles rate limiting
- Extracts clean, readable text
- Preserves article structure
- Handles dynamic content (via browser)
- Supports authentication

## Best Practices
- Respect website terms of service
- Implement delays between requests
- Cache results when appropriate
- Handle errors gracefully
- Respect rate limits

## Legal Considerations
- Always check robots.txt
- Respect website terms of service
- Don't overload servers
- Use for legitimate purposes only

