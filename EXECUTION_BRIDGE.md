# Autonomous Action & Control Layer (Execution Bridge)

## Overview

The Execution Bridge is a secure, event-driven automation infrastructure that enables the AI system to directly control external applications, read/write data, and execute multi-step workflows without manual intervention (except at human safety gates).

**This is NOT a login system** — it's a control + execution infrastructure layer for automation using API tokens, webhooks, and service-level authentication.

---

## Core Architecture

### 1. Intent Detection Pipeline

```
User Input → Intent Classification → Data Extraction → Validation → Tool Planning → Execution
```

**Flow:**
1. **Intent Classification**: Analyze user message to classify into 8 allowed intents
2. **Data Extraction**: Extract structured fields (name, email, date, time, etc.)
3. **Validation Gate**: Check if required data is present; STOP if missing
4. **Tool Planning**: LLM generates ordered list of tools to execute
5. **Human Safety Gate**: If high-risk, request approval before execution
6. **Execution Engine**: Execute tools sequentially with retry logic
7. **Verification**: Confirm each action succeeded
8. **Logging**: Record every action for audit trail

---

## Supported Intents

| Intent | Description | Required Fields | Example |
|--------|-------------|-----------------|---------|
| **Booking** | Schedule meeting/call/appointment | name, email, date, time | "Book Alice for tomorrow at 3pm" |
| **Task Creation** | Create task/reminder/to-do | title | "Create task: Follow up with leads" |
| **Lead Inquiry** | New prospect/customer inquiry | email OR phone | "Lead from john@company.com interested in demo" |
| **Data Update** | Modify existing records/data | depends on context | "Update Alice's phone to +1-555-1234" |
| **Support** | Handle customer support request | message | "Customer has billing issue" |
| **Information Request** | Fetch reports/data/status | context | "Show me today's bookings" |
| **System Action** | Execute workflow/automation | context | "Trigger backup process" |
| **Follow-up Action** | Cancel/delete/reject | target resource | "Cancel the 3pm meeting" |

---

## API Connectors (Service Access Layer)

### Token-Based Authentication (No OAuth)

Each service uses server-side API tokens stored in `.env`:

```env
# Email
GMAIL_API_TOKEN=sk_test_...

# Calendar
GOOGLE_CALENDAR_API_TOKEN=sk_test_...

# Spreadsheets
GOOGLE_SHEETS_API_TOKEN=sk_test_...

# Notes & Databases
NOTION_INTEGRATION_TOKEN=nid_...

# Project Management
TRELLO_API_KEY=...
TRELLO_API_TOKEN=...

# Messaging
SLACK_BOT_TOKEN=xoxb-...
TELEGRAM_BOT_TOKEN=123456789:ABCDefg...
```

### Connection Status Endpoint

Check which services are connected:

```bash
GET /api/assistants/:id/execution-bridge/status
```

Response:
```json
{
  "connections": [
    {
      "name": "Gmail API",
      "key": "gmail",
      "status": "connected",
      "type": "Service Access"
    },
    {
      "name": "Google Calendar API",
      "key": "google_calendar",
      "status": "connected",
      "type": "Service Access"
    }
  ]
}
```

---

## Tool Gateway (Function Calling Interface)

The AI never calls external APIs directly. All operations go through the **ToolGateway** service:

### Email Tools

- **send_email** - Send email message
  ```
  send_email({to, subject, body})
  ```

- **read_email** - Fetch messages from inbox
  ```
  read_email({query?, messageId?})
  ```

- **filter_email** - Search emails by criteria
  ```
  filter_email({query, maxResults?})
  ```

- **archive_email** - Move email to archive
  ```
  archive_email({messageId})
  ```

- **label_email** - Add labels/tags to email
  ```
  label_email({messageId, labels[]})
  ```

- **draft_email** - Create email draft
  ```
  draft_email({to, subject, body})
  ```

### Calendar Tools

- **create_calendar_event** - Schedule new event
  ```
  create_calendar_event({title, startTime, endTime, attendees[]})
  ```

- **update_calendar_event** - Modify event details
  ```
  update_calendar_event({eventId, title?, startTime?, endTime?, attendees?})
  ```

- **detect_calendar_conflicts** - Check availability
  ```
  detect_calendar_conflicts({startTime, endTime, attendees?})
  ```

### Spreadsheets Tools

- **read_sheets** - Fetch data from sheets
  ```
  read_sheets({spreadsheetId, range})
  ```

- **write_sheets** - Append/update rows
  ```
  write_sheets({spreadsheetId, range, values[][]})
  ```

- **generate_sheets_report** - Create report from data
  ```
  generate_sheets_report({spreadsheetId, range, groupBy?})
  ```

### Notion Tools

- **create_notion_page** - Create database page
  ```
  create_notion_page({databaseId, title, properties})
  ```

- **update_notion_page** - Update page properties
  ```
  update_notion_page({pageId, properties})
  ```

### Trello Tools

- **create_trello_card** - Create task card
  ```
  create_trello_card({listId, name, desc?})
  ```

- **move_trello_card** - Move card between lists
  ```
  move_trello_card({cardId, listId})
  ```

- **assign_trello_card** - Assign card to member
  ```
  assign_trello_card({cardId, memberId})
  ```

### Messaging Tools

- **notify_slack** - Post Slack message
  ```
  notify_slack({channel, text})
  ```

- **send_telegram** - Send Telegram message
  ```
  send_telegram({chatId, message})
  ```

### Webhook Tools

- **trigger_webhook** - Send HTTP POST to webhook
  ```
  trigger_webhook({url, payload})
  ```

---

## Webhook Event System (Real-Time Triggers)

External apps send events via webhooks → AI responds automatically:

### Webhook Endpoints

Each service has a dedicated webhook endpoint:

```
POST /api/assistants/:id/execution-bridge/webhooks/:service
```

Supported services:
- `gmail` - New email received
- `google_calendar` - Calendar event updated
- `trello` - Task card moved
- `notion` - Database page created/updated
- `crm` - Customer record changed

### Example: Gmail Webhook

External system sends:
```json
{
  "from": "client@example.com",
  "subject": "Booking Request",
  "body": "I want to book a call tomorrow at 2pm"
}
```

AI automatically:
1. Parses intent: "Booking"
2. Extracts data: {email, date, time}
3. Creates calendar event
4. Sends confirmation email
5. Logs action

### Webhook Signature Verification

For secure webhooks, verify request signature:

```typescript
import { WebhookSecurityHelper } from "@archmind/api/services";

const isValid = WebhookSecurityHelper.verifySignature(
  requestBody,
  req.headers["x-webhook-signature"],
  process.env.WEBHOOK_SECRET
);
```

---

## Execution Pipeline

### Step 1: Intent Detection

**Input:** User message or webhook event

**Process:** LLM classifies intent and extracts structured data

**Example:**
```
Input: "Can we book a call tomorrow at 3pm? My name is John, email is john@example.com"

Output:
{
  "intent": "Booking",
  "extractedData": {
    "name": "John",
    "email": "john@example.com",
    "date": "2026-06-01",
    "time": "15:00"
  },
  "missingRequiredFields": [],
  "toolPlan": [
    {
      "tool": "detect_calendar_conflicts",
      "params": {"startTime": "2026-06-01T15:00:00", "endTime": "2026-06-01T15:30:00"}
    },
    {
      "tool": "create_calendar_event",
      "params": {"title": "Call with John", "startTime": "2026-06-01T15:00:00", "attendees": ["john@example.com"]}
    }
  ]
}
```

### Step 2: Validation Gate

**Check:**
- All required fields present?
- Data format valid?
- Dates/times in future?
- Business logic valid?

**If missing data:**
```json
{
  "status": "failed",
  "errorMessage": "Missing required fields: date, time",
  "responseMessage": "I'd love to help with that booking, but I need to know the date and time. When would you like to schedule?"
}
```

### Step 3: High-Risk Action Detection

**High-risk tools that need approval:**
- `trigger_webhook` - Might notify external systems
- `update_calendar_event` - If canceling event
- `archive_email` - Deleting email
- `write_sheets` - If overwriting existing data

**If high-risk detected:**
1. Save execution log
2. Create approval record
3. Return to user for confirmation

```json
{
  "status": "pending_approval",
  "approvalRequired": "Confirm before I cancel this meeting at 3 PM?"
}
```

### Step 4: Tool Execution

**For each tool in plan:**
1. Execute tool through ToolGateway
2. Capture response (success/failure)
3. Log execution details

**Retry Logic:**
- Attempt 1: Immediate retry
- Attempt 2: After 5 seconds
- Attempt 3: After 30 seconds
- If all fail: Trigger rollback

### Step 5: Verification

After execution, verify:
- Calendar event exists
- Email delivered
- Data stored correctly
- Notifications sent

### Step 6: Logging & Audit Trail

Every action recorded:

```bash
GET /api/assistants/:id/execution-bridge/logs
```

Response:
```json
{
  "logs": [
    {
      "id": "log_abc123",
      "timestamp": "2026-05-31T14:00:00Z",
      "request": "Book John for tomorrow at 3pm",
      "intent": "Booking",
      "extractedData": {"name": "John", "email": "john@example.com", "date": "2026-06-01", "time": "15:00"},
      "toolsPlanned": ["detect_calendar_conflicts", "create_calendar_event", "send_email"],
      "toolsExecuted": [
        {
          "name": "detect_calendar_conflicts",
          "success": true,
          "response": {"hasConflicts": false},
          "durationMs": 234,
          "retryCount": 0
        }
      ],
      "status": "success",
      "executionTimeMs": 2345
    }
  ],
  "approvals": [
    {
      "id": "approval_xyz",
      "actionType": "trigger_webhook",
      "actionDescription": "Trigger webhook to https://example.com/webhook",
      "status": "pending",
      "createdAt": "2026-05-31T14:05:00Z"
    }
  ]
}
```

---

## Human Safety Gates

### Manual Approval Flow

1. **User requests action**
2. **System detects high-risk**
3. **Present approval dialog**
4. **Wait for confirmation**
5. **Resume execution if approved**

### Approval Endpoint

Confirm or reject pending action:

```bash
POST /api/assistants/:id/execution-bridge/approvals/:approvalId/confirm
Content-Type: application/json

{"decision": "approved"}
```

Example request:
```json
{
  "decision": "approved"
}
```

Responses:
- `"approved"` - Execute the action
- `"rejected"` - Cancel and cleanup

---

## Error Handling & Recovery

### Retry Strategy

Tools use exponential backoff:
```
Attempt 1: Immediate
Attempt 2: Wait 5 seconds
Attempt 3: Wait 30 seconds
Fail: Trigger rollback
```

### Rollback System

If execution fails, automatically undo completed steps:

Example:
```
Created calendar event → Failed to send email → Cancel event (rollback)
```

Rollback actions recorded in audit log.

### Fallback Actions

If tool fails, suggest alternative:

| Failed Tool | Fallback |
|------------|----------|
| send_email | Notify via Slack |
| create_calendar_event | Create reminder task |
| trigger_webhook | Log and retry later |
| write_sheets | Store temporarily, sync later |

---

## Security Model

### Token Management

- ✅ No hardcoded credentials
- ✅ All secrets in `.env`
- ✅ Rotate tokens regularly
- ✅ Use service-level tokens (not user auth)

### Webhook Security

- ✅ Verify webhook signatures (HMAC-SHA256)
- ✅ Check timestamp (must be recent)
- ✅ Validate source IP if needed
- ✅ Rate limit webhook endpoints

### Access Control

- ✅ User can only access own assistants
- ✅ Assistant owner can see all logs
- ✅ Admin can audit all executions
- ✅ Actions logged with user ID and timestamp

### Data Privacy

- ✅ Minimal data stored (extract only needed info)
- ✅ PII encrypted in database
- ✅ Logs retention policy (30/90 days)
- ✅ Compliance with GDPR/CCPA

---

## Usage Examples

### Example 1: Booking Workflow

**User request:**
```
"Can we schedule a call with John from Acme Inc? He's interested in the demo. 
His email is john@acmeinc.com. Available tomorrow afternoon, maybe 3pm?"
```

**AI execution flow:**
1. Detect intent: `Booking`
2. Extract: name="John", email="john@acmeinc.com", date="tomorrow" (2026-06-01), time="3pm" (15:00)
3. Validate: All required fields present ✓
4. Plan tools: 
   - Check calendar conflicts
   - Create calendar event
   - Log to CRM spreadsheet
   - Send confirmation email
   - Create follow-up task
5. Execute each tool
6. Log successful execution

**Result:** Booking created, emails sent, task created. Full audit trail stored.

### Example 2: Webhook Integration

**Gmail sends webhook:**
```json
{
  "from": "lead@startup.io",
  "subject": "Product demo request",
  "body": "Hi, we're interested in using your platform. Can you schedule a demo call?"
}
```

**AI automatically:**
1. Recognize intent: `Lead Inquiry`
2. Extract: email="lead@startup.io"
3. Add to CRM
4. Send welcome email
5. Create follow-up task
6. Schedule sales call

**Zero manual effort!**

### Example 3: High-Risk Action with Approval

**User request:**
```
"Cancel tomorrow's 3pm meeting with John"
```

**AI action:**
1. Detect intent: `Follow-up Action` (cancel)
2. Extract: date="2026-06-01", time="15:00"
3. Identify high-risk: Canceling calendar event
4. Request approval: "Confirm before I cancel this meeting at 3 PM?"
5. Wait for user response
6. On approval: Execute cancellation

---

## Advanced Features

### Conflict Detection

Automatically detect calendar conflicts:
```
User: "Schedule John for tomorrow at 3pm"

System checks:
- Is 3pm free? 
- Any attendee conflicts?
- Consider timezone differences?

Response: "3pm has a conflict with 'Team Standup'. 
Available times: 2pm, 4pm, or next day 10am"
```

### Multi-Step Workflows

Coordinate across multiple systems:
```
Booking → Calendar + Email + CRM + Slack + Trello
All in proper sequence with verification
```

### Intelligent Scheduling

Parse natural language dates/times:
- "tomorrow" → 2026-06-01
- "next Tuesday" → 2026-06-03
- "3pm" → 15:00
- "after 5pm" → >= 17:00

### Data Extraction & Validation

Automatically extract from unstructured text:
- Names from email body
- Phone numbers
- Email addresses
- Company names
- Deal values

---

## Testing & Simulation

### Webhook Simulation Endpoint

Test workflows without real webhook:

```bash
POST /api/assistants/:id/execution-bridge/webhooks/simulate
Content-Type: application/json

{
  "service": "gmail",
  "payload": {
    "from": "test@example.com",
    "subject": "Test booking request",
    "body": "I'd like to book a call tomorrow at 2pm"
  }
}
```

### Manual Automation Run

Execute workflow manually:

```bash
POST /api/assistants/:id/execution-bridge/run
Content-Type: application/json

{"message": "Book Alice for tomorrow at 3pm"}
```

### Mock Mode

When service tokens are not configured (contain "mock"):
- Tools return simulated responses
- No real API calls made
- Perfect for testing and development

---

## Monitoring & Observability

### Audit Log Schema

```json
{
  "id": "log_id",
  "assistantId": "assistant_id",
  "userId": "user_id",
  "timestamp": "ISO8601",
  "request": "Original user message",
  "intent": "Detected intent",
  "extractedData": {...},
  "toolsPlanned": ["tool1", "tool2"],
  "toolsExecuted": [
    {
      "name": "tool_name",
      "params": {...},
      "success": true/false,
      "response": {...},
      "timestamp": "ISO8601",
      "durationMs": 234,
      "retryCount": 0
    }
  ],
  "status": "success|failed|pending_approval",
  "errorMessage": "Optional error",
  "executionTimeMs": 5000
}
```

### Metrics to Track

- Execution success rate
- Average execution time
- Tool failure rates
- Most common intents
- Approval acceptance rate
- Rollback frequency

---

## Configuration

### Environment Variables

```env
# Service Tokens
GMAIL_API_TOKEN=sk_...
GOOGLE_CALENDAR_API_TOKEN=sk_...
GOOGLE_SHEETS_API_TOKEN=sk_...
NOTION_INTEGRATION_TOKEN=nid_...
TRELLO_API_KEY=...
TRELLO_API_TOKEN=...
SLACK_BOT_TOKEN=xoxb-...
TELEGRAM_BOT_TOKEN=...

# Webhook Security
WEBHOOK_SECRET=your_secret_key

# Execution Settings
MAX_EXECUTION_TIME_MS=30000
MAX_RETRIES=3
RETRY_DELAY_MS=5000

# Logging
LOG_EXECUTION_DETAILS=true
AUDIT_LOG_RETENTION_DAYS=90
```

---

## Summary

The Execution Bridge is a **complete automation infrastructure** that:

✅ Reads data from external apps  
✅ Writes and updates records  
✅ Triggers actions in real-time  
✅ Monitors changes via webhooks  
✅ Validates all operations  
✅ Coordinates multi-app workflows  
✅ Logs everything for compliance  
✅ Includes human safety gates  
✅ Self-corrects on errors  
✅ Maintains full audit trails

**No manual intervention except at approval gates.**

Ready to scale from demos to full production automation! 🚀
