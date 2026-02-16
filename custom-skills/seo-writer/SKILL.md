# SEO Writer Skill

## Description
Enables agents to write SEO-optimized content by researching keywords, analyzing search intent, and optimizing content for search engines.

## Capabilities
- Research keywords
- Analyze search intent
- Generate SEO-optimized content
- Optimize existing content
- Suggest meta descriptions
- Generate title tags
- Analyze keyword density
- Check content readability
- Suggest internal linking

## Configuration
Optional: Google Search API key for advanced features. Basic functionality works without API key.

## Usage
```javascript
// Research keywords
const keywords = await seo.researchKeywords("AI agents");

// Generate SEO content
const content = await seo.writeContent({
  topic: "AI agents",
  keywords: ["AI", "agents", "automation"],
  targetLength: 1000
});

// Optimize existing content
const optimized = await seo.optimize(content, {
  targetKeyword: "AI agents",
  keywordDensity: 1.5
});

// Generate meta description
const meta = await seo.generateMeta({
  title: "AI Agents Guide",
  content: content,
  maxLength: 160
});
```

## Features
- Keyword research and analysis
- Content optimization
- Readability scoring
- Keyword density analysis
- Meta tag generation
- Internal linking suggestions
- Competitor analysis

## Best Practices
- Focus on user intent
- Natural keyword usage
- High-quality, valuable content
- Proper heading structure
- Mobile-friendly content
- Fast loading times

## SEO Factors
- Keyword optimization
- Content quality and length
- Readability
- Internal/external linking
- Meta tags
- Heading structure
- Image optimization

