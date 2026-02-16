# Calendar Sync Skill

## Description
Enables agents to sync with calendars via CalDAV or Google Calendar API. Supports reading events, creating events, and managing schedules.

## Capabilities
- Read calendar events
- Create events
- Update events
- Delete events
- Search events
- Get availability
- Sync multiple calendars
- Handle timezones
- Set reminders

## Configuration
Requires calendar credentials:
- Google Calendar: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`
- CalDAV: `CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD`

## Usage
```javascript
// Read events
const events = await calendar.getEvents({
  start: "2024-01-01",
  end: "2024-01-31"
});

// Create event
const event = await calendar.createEvent({
  title: "Team Meeting",
  start: "2024-01-15T10:00:00Z",
  end: "2024-01-15T11:00:00Z",
  description: "Weekly team sync"
});

// Update event
await calendar.updateEvent(eventId, {
  title: "Updated Meeting"
});

// Check availability
const available = await calendar.checkAvailability({
  start: "2024-01-15T10:00:00Z",
  end: "2024-01-15T11:00:00Z"
});
```

## Supported Calendars
- Google Calendar
- CalDAV-compatible calendars
- iCloud Calendar
- Outlook Calendar (via CalDAV)

## Features
- Timezone handling
- Recurring events
- Attendee management
- Reminders and notifications
- Event search and filtering
- Availability checking
- Conflict detection

## Best Practices
- Always handle timezones correctly
- Validate event data
- Check for conflicts
- Set appropriate reminders
- Sync regularly

