# CSV Analyzer Skill

## Description
Enables agents to analyze CSV files and datasets. Supports data processing, statistical analysis, and visualization generation using Python/Node.js.

## Capabilities
- Read and parse CSV files
- Basic statistics (mean, median, mode, etc.)
- Data cleaning and preprocessing
- Filter and sort data
- Aggregate operations (group by, sum, count)
- Generate visualizations (charts, graphs)
- Export processed data
- Handle large datasets

## Configuration
No API keys required. Uses Python pandas or Node.js csv-parser.

## Usage
```javascript
// Load CSV
const data = await csv.load("data.csv");

// Basic statistics
const stats = await csv.analyze("data.csv");

// Filter data
const filtered = await csv.filter("data.csv", {
  column: "age",
  operator: ">",
  value: 18
});

// Generate chart
await csv.visualize("data.csv", {
  type: "line",
  x: "date",
  y: "value"
});

// Aggregate
const aggregated = await csv.aggregate("data.csv", {
  groupBy: "category",
  operations: ["sum", "avg", "count"]
});
```

## Supported Operations
- Statistical analysis
- Data filtering and sorting
- Aggregation and grouping
- Data visualization
- Data cleaning
- Export to various formats

## File Formats
- CSV (comma-separated)
- TSV (tab-separated)
- Excel files (via conversion)

## Performance
- Handles large files efficiently
- Streaming for very large datasets
- Memory-efficient processing
- Parallel processing when possible

