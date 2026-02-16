# Server Monitor Skill

## Description
Enables agents to monitor server health, resources, and performance. Reads system metrics from /proc, ss, df, and other system tools.

## Capabilities
- Monitor CPU usage
- Monitor memory usage
- Monitor disk usage
- Monitor network activity
- Check process status
- Monitor system load
- Check service status
- Monitor uptime
- Alert on thresholds

## Configuration
No API keys required. Requires system access to read /proc and run system commands.

## Usage
```javascript
// Get CPU usage
const cpu = await monitor.getCPU();

// Get memory usage
const memory = await monitor.getMemory();

// Get disk usage
const disk = await monitor.getDisk();

// Get system load
const load = await monitor.getLoad();

// Check service status
const status = await monitor.checkService("docker");

// Monitor with alerts
await monitor.watch({
  cpu: { threshold: 80, alert: true },
  memory: { threshold: 90, alert: true },
  disk: { threshold: 85, alert: true }
});
```

## Metrics Collected
- CPU: usage percentage, load average
- Memory: used, free, cached, buffers
- Disk: usage, I/O, space available
- Network: traffic, connections
- Processes: running, zombie, sleeping
- Services: status, uptime

## Alerting
- Configurable thresholds
- Email/Slack notifications
- Log alerts
- Custom alert handlers

## Best Practices
- Monitor continuously
- Set appropriate thresholds
- Log metrics for analysis
- Alert on critical issues
- Track trends over time

