# Vulnerability Scanner Skill

## Description
Enables agents to scan for security vulnerabilities using nmap, SSL checks, and other security tools. Identifies potential security issues.

## Capabilities
- Port scanning
- SSL/TLS certificate checking
- Service version detection
- Vulnerability detection
- Security configuration review
- Open port identification
- Service enumeration
- Security best practices checking

## Configuration
Requires system tools: nmap, openssl, and other security utilities.

## Usage
```javascript
// Scan ports
const ports = await scanner.scanPorts("example.com");

// Check SSL certificate
const ssl = await scanner.checkSSL("example.com");

// Scan for vulnerabilities
const vulns = await scanner.scanVulnerabilities("example.com");

// Check service versions
const services = await scanner.checkServices("example.com");

// Security audit
const audit = await scanner.audit({
  host: "example.com",
  ports: [80, 443, 22],
  ssl: true,
  services: true
});
```

## Security Checks
- Open ports identification
- SSL/TLS configuration
- Service versions
- Known vulnerabilities
- Security headers
- Configuration issues
- Best practices compliance

## Best Practices
- Only scan systems you own or have permission
- Respect rate limits
- Document findings
- Prioritize critical vulnerabilities
- Follow responsible disclosure

## Legal Considerations
- Always get permission before scanning
- Don't scan systems you don't own
- Follow responsible disclosure practices
- Comply with local laws

## Output Format
- JSON reports
- Severity ratings (Critical, High, Medium, Low)
- Remediation suggestions
- Risk assessment

