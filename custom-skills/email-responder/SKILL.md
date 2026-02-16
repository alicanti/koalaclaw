# Email Responder Skill

## Description
Enables agents to send and receive emails via IMAP/SMTP. Supports reading inbox, sending emails, replying, and managing email threads.

## Capabilities
- Read emails from inbox
- Send emails (text, HTML, attachments)
- Reply to emails
- Forward emails
- Search emails
- Mark as read/unread
- Organize into folders
- Parse email content and attachments

## Configuration
Requires email server credentials:
- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASSWORD`
- `EMAIL_IMAP_HOST`
- `EMAIL_IMAP_PORT`
- `EMAIL_FROM_ADDRESS`

## Usage
```javascript
// Read inbox
const emails = await email.readInbox();

// Send email
await email.send({
  to: "customer@example.com",
  subject: "Re: Your question",
  body: "Thank you for contacting us!"
});

// Reply to email
await email.reply(emailId, "Here's the answer to your question.");
```

## Security
- Credentials stored securely
- Supports TLS/SSL encryption
- Validates email addresses
- Prevents email spoofing

## Best Practices
- Respond within 24 hours
- Use clear, professional language
- Include relevant context
- Follow email etiquette

