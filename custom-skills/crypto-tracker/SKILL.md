# Crypto Tracker Skill

## Description
Enables agents to track cryptocurrency prices, market data, and portfolio performance using CoinGecko API.

## Capabilities
- Get cryptocurrency prices
- Track multiple cryptocurrencies
- Get market data (volume, market cap, etc.)
- Get historical prices
- Track portfolio value
- Get price alerts
- Compare cryptocurrencies
- Get trending coins

## Configuration
No API key required for basic CoinGecko API. Optional API key for higher rate limits.

## Usage
```javascript
// Get price
const price = await crypto.getPrice("bitcoin");

// Get multiple prices
const prices = await crypto.getPrices(["bitcoin", "ethereum", "solana"]);

// Get market data
const market = await crypto.getMarketData("bitcoin");

// Get historical prices
const history = await crypto.getHistory("bitcoin", "7d");

// Track portfolio
const portfolio = await crypto.trackPortfolio({
  bitcoin: 0.5,
  ethereum: 2.0
});

// Set price alert
await crypto.setAlert("bitcoin", 50000, "above");
```

## Supported Data
- Current prices (USD, EUR, etc.)
- Market capitalization
- Trading volume
- Price changes (24h, 7d, 30d)
- Historical prices
- Market rankings
- Trending coins

## Rate Limits
- Free tier: 10-50 calls/minute
- Pro tier: Higher limits available
- Implements rate limiting and caching

## Best Practices
- Cache prices to reduce API calls
- Use batch requests when possible
- Set appropriate update intervals
- Handle API errors gracefully

