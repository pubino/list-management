# List Management

Azure Logic App and Function App for automated processing of email delivery failure notifications (bounces) from Outlook 365.

## Overview

This project monitors Outlook 365 mailboxes for email delivery failures and automatically extracts failed recipient addresses from bounce notifications. It supports multiple bounce formats including:

- RFC 3464 DSN (Delivery Status Notification) format
- X-Failed-Recipients headers
- Common bounce message patterns from various email providers

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Outlook 365   │────▶│   Logic App     │────▶│  Function App   │
│   (Trigger)     │     │  (Orchestrator) │     │  (Processor)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  Email Reports  │
                        │ (Admin/Report)  │
                        └─────────────────┘
```

### Components

- **Logic App** (`azure-logic-lists`): Monitors Outlook folders, triggers processing, sends reports
- **Function App** (`azure-func-lists`): Parses bounce messages, extracts failed addresses

## Prerequisites

- Docker and Docker Compose
- Azure subscription
- Outlook 365 account with appropriate permissions
- Azure CLI (for deployment)
- Azure Functions Core Tools (for deployment)

## Installation

```bash
# Clone the repository
git clone https://github.com/pubino/list-management.git
cd list-management

# Install dependencies
npm install
cd azure-func-lists && npm install && cd ..
```

## Usage

### Input Format

The Function App accepts POST requests with the following JSON structure:

```json
{
  "messageId": "string",
  "subject": "string",
  "body": "string (email body content)",
  "headers": {
    "X-Failed-Recipients": "user@example.com"
  },
  "from": "mailer-daemon@example.com",
  "receivedDateTime": "2024-01-15T10:30:00Z"
}
```

### Output Format

```json
{
  "success": true,
  "messageId": "string",
  "extractedAddresses": [
    {
      "address": "failed@example.com",
      "failureReason": "User not found",
      "diagnosticCode": "550 5.1.1 User unknown",
      "statusCode": "5.1.1",
      "source": "dsn-final-recipient"
    }
  ],
  "processingDetails": "Extracted 1 failed address(es) from message"
}
```

### Supported Failure Reasons

- User not found
- Mailbox full
- Domain not found
- Connection failed
- Blocked or blacklisted
- Invalid address format
- Relay denied
- Message too large

## Examples

### Testing Locally

Start the Function App locally:

```bash
npm run func:install
npm run func:start
```

Send a test request:

```bash
curl -X POST http://localhost:7071/api/processEmail \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "test-123",
    "subject": "Delivery Status Notification (Failure)",
    "body": "Final-Recipient: rfc822; user@example.com\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 5.1.1 User unknown",
    "headers": {}
  }'
```

### Example Bounce Messages

**DSN Format:**
```
Final-Recipient: rfc822; failed@example.com
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 The email account does not exist
```

**Header Format:**
```
X-Failed-Recipients: user1@example.com, user2@example.com
```

**Common Bounce Pattern:**
```
Delivery has failed to the following recipient(s):

failed@example.com

The email account does not exist at the organization this message was sent to.
```

## Testing Suite

All tests run in Docker containers for consistent environments.

### Running Tests

```bash
# Run all tests in Docker
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests locally (requires Node.js)
npm run test:local
```

### Test Structure

```
tests/
├── unit/
│   └── addressExtractor.test.js    # Unit tests for address extraction
├── integration/
│   └── processEmail.test.js        # Integration tests for HTTP endpoint
└── mocks/
    ├── sampleMessages.js           # Sample bounce message fixtures
    └── mockOutlookConnector.js     # Mock Outlook API connector
```

### Test Coverage

Tests cover:
- DSN format parsing (RFC 3464)
- X-Failed-Recipients header extraction
- Common bounce message patterns
- Multiple addresses per message
- Diagnostic code extraction
- Failure reason categorization
- HTTP endpoint error handling

### CI/CD

GitHub Actions automatically runs tests on push/PR to main/master branches:

```yaml
# .github/workflows/ci.yml
- Builds test Docker image
- Runs full test suite
- Generates coverage report
- Uploads coverage artifacts
```

## Deployment

### Configuration

1. Copy the configuration template:

```bash
cp scripts/config.env.template scripts/config.env
```

2. Edit `scripts/config.env` with your values:

```bash
# Resource Group (1-90 chars)
RESOURCE_GROUP=my-resource-group

# Function App name (2-60 chars, alphanumeric and hyphens)
FUNC_APP_NAME=my-func-lists

# Logic App name (1-80 chars)
LOGIC_APP_NAME=my-logic-lists

# Azure region
LOCATION=eastus

# Storage account (3-24 chars, lowercase and numbers only)
STORAGE_ACCOUNT=mystorageacct

# Application Insights (optional)
APP_INSIGHTS_NAME=my-app-insights

# Email settings
REPORT_EMAIL=reports@example.com
ADMIN_EMAIL=admin@example.com
WATCHED_FOLDERS=Inbox,Bounces
```

### Deploy to Azure

```bash
# Interactive setup (optional)
npm run setup

# Deploy to Azure
npm run deploy
```

The deployment script will:
1. Create/use resource group
2. Create storage account
3. Create Application Insights (optional)
4. Create and deploy Function App
5. Create Logic App
6. Output Function App URL and test command

### Post-Deployment Steps

After running the deployment script:

1. **Create Office 365 Connection**
   - Go to Azure Portal > Logic Apps > [Your Logic App]
   - Navigate to API Connections
   - Create new Office 365 connection
   - Authenticate with your Outlook 365 account

2. **Update Logic App Parameters**
   - Edit the Logic App workflow
   - Update the connection reference in the workflow
   - Set `FunctionAppUrl` to your Function App URL with key

3. **Enable the Logic App**
   - Verify all connections are configured
   - Enable the Logic App to start monitoring

### Testing Deployed Function

```bash
curl -X POST 'https://YOUR-FUNC-APP.azurewebsites.net/api/processEmail?code=YOUR-KEY' \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "test",
    "subject": "Test",
    "body": "Final-Recipient: rfc822; test@example.com",
    "headers": {}
  }'
```

## Project Structure

```
list-management/
├── azure-func-lists/           # Azure Function App
│   ├── src/
│   │   ├── functions/
│   │   │   └── processEmail.js # HTTP trigger function
│   │   └── lib/
│   │       └── addressExtractor.js # Address extraction logic
│   ├── package.json
│   ├── host.json
│   └── local.settings.json
├── azure-logic-lists/          # Azure Logic App
│   ├── workflow.json           # Logic App definition
│   ├── parameters.json
│   └── connections.json
├── tests/                      # Test suite
│   ├── unit/
│   ├── integration/
│   └── mocks/
├── scripts/                    # Deployment scripts
│   ├── setup.sh
│   ├── deploy.sh
│   └── config.env.template
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD pipeline
├── Dockerfile.test             # Test container
├── docker-compose.test.yml     # Test orchestration
└── package.json                # Root package with scripts
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run tests in Docker |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:local` | Run tests locally |
| `npm run func:start` | Start Function App locally |
| `npm run func:install` | Install Function App dependencies |
| `npm run setup` | Interactive deployment setup |
| `npm run deploy` | Deploy to Azure |

