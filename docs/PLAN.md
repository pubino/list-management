# Azure Logic App and Function App Integration Plan

## Overview
This project creates an Azure Logic App and Function App pair for processing Outlook 365 email delivery failure notifications.

## Architecture

### Components
1. **Logic App** (`azure-logic-lists`)
   - Monitors Outlook 365 folders for new messages
   - Triggers Function App for processing
   - Reports results to ReportEmail parameter
   - Reports failures to AdminEmail parameter

2. **Function App** (`azure-func-lists`)
   - Processes email messages from Logic App
   - Extracts delivery failure notifications
   - Identifies failed destination addresses
   - Returns extracted addresses with status

## Deployment Configuration

### Customizable Names
All resource names are configurable at deployment time via setup scripts:

| Resource | Default Local Name | Deployment Parameter | Azure Constraints |
|----------|-------------------|---------------------|-------------------|
| Resource Group | N/A | `RESOURCE_GROUP` | 1-90 chars, alphanumeric, underscores, hyphens, periods |
| Function App | azure-func-lists | `FUNC_APP_NAME` | 2-60 chars, alphanumeric and hyphens only |
| Logic App | azure-logic-lists | `LOGIC_APP_NAME` | 1-80 chars, alphanumeric, hyphens, underscores, periods |

### Setup Scripts
- `scripts/setup.sh` - Interactive setup with prompts
- `scripts/deploy.sh` - Deploy to Azure with parameters
- `scripts/config.env.template` - Configuration template

### Example Deployment
```bash
# Copy and configure
cp scripts/config.env.template scripts/config.env

# Edit config.env with your values:
# RESOURCE_GROUP=orfe-dept-azure
# FUNC_APP_NAME=orfe-dept-azure-func-lists
# LOGIC_APP_NAME=orfe-dept-azure-logic-lists
# LOCATION=eastus

# Deploy
./scripts/deploy.sh
```

## Logic App Workflow

### Parameters
- `WatchedFolders`: Array of Outlook folder paths to monitor
- `ReportEmail`: Email address for processing results
- `AdminEmail`: Email address for system failures
- `FunctionAppUrl`: URL of the Function App endpoint

### Flow
1. **Trigger**: When email arrives in any watched folder
2. **Action**: Call Function App with message data
3. **Condition**: Check Function App response
   - Success: Send report to ReportEmail
   - Failure: Send alert to AdminEmail

## Function App Processing

### Input Schema
```json
{
  "messageId": "string",
  "subject": "string",
  "body": "string",
  "headers": {
    "Content-Type": "string",
    "X-Failed-Recipients": "string"
  },
  "from": "string",
  "receivedDateTime": "string"
}
```

### Output Schema
```json
{
  "success": boolean,
  "messageId": "string",
  "extractedAddresses": [
    {
      "address": "string",
      "failureReason": "string",
      "diagnosticCode": "string"
    }
  ],
  "processingDetails": "string",
  "error": "string"
}
```

### Extraction Logic
1. Check `X-Failed-Recipients` header
2. Parse DSN (Delivery Status Notification) format
3. Extract from common bounce message patterns
4. Support multiple failed addresses per message

## Testing

All tests run via Docker to ensure consistent environments.

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Email parsing, address extraction, DSN format handling
- **Integration Tests**: Function App HTTP endpoint with sample messages
- **Mocks**: Sample bounce messages, mock Outlook connector

### CI/CD
GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests automatically on push/PR to main/master.

## Prerequisites
- Docker
- Azure subscription
- Outlook 365 account with appropriate permissions
- Azure CLI installed

## File Structure
```
list-cleanup/
├── azure-func-lists/
│   ├── src/
│   │   ├── functions/
│   │   │   └── processEmail.js
│   │   └── lib/
│   │       ├── emailParser.js
│   │       └── addressExtractor.js
│   ├── package.json
│   ├── host.json
│   └── local.settings.json
├── azure-logic-lists/
│   ├── workflow.json
│   ├── parameters.json
│   └── connections.json
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── config.env.template
├── tests/
│   ├── unit/
│   ├── integration/
│   └── mocks/
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile.test
├── docker-compose.test.yml
└── docs/
    └── PLAN.md
```
