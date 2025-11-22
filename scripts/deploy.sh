#!/bin/bash

# Deploy Azure Logic App and Function App

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/config.env"

# Load configuration
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

source "$CONFIG_FILE"

# Validate required variables
required_vars="RESOURCE_GROUP FUNC_APP_NAME LOGIC_APP_NAME LOCATION STORAGE_ACCOUNT"
for var in $required_vars; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in $CONFIG_FILE"
        exit 1
    fi
done

echo "==================================="
echo "Deploying to Azure"
echo "==================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Function App:   $FUNC_APP_NAME"
echo "Logic App:      $LOGIC_APP_NAME"
echo "Location:       $LOCATION"
echo "==================================="
echo

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "Creating resource group: $RESOURCE_GROUP"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
else
    echo "Using existing resource group: $RESOURCE_GROUP"
fi

# Create storage account
echo "Creating storage account: $STORAGE_ACCOUNT"
az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    2>/dev/null || echo "Storage account already exists"

# Create Application Insights
if [ -n "$APP_INSIGHTS_NAME" ]; then
    echo "Creating Application Insights: $APP_INSIGHTS_NAME"
    az monitor app-insights component create \
        --app "$APP_INSIGHTS_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --application-type web \
        2>/dev/null || echo "Application Insights already exists"

    APP_INSIGHTS_KEY=$(az monitor app-insights component show \
        --app "$APP_INSIGHTS_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query instrumentationKey -o tsv)
fi

# Create Function App
echo "Creating Function App: $FUNC_APP_NAME"
az functionapp create \
    --name "$FUNC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --storage-account "$STORAGE_ACCOUNT" \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version 24 \
    --functions-version 4 \
    2>/dev/null || echo "Function App already exists"

# Configure Application Insights for Function App
if [ -n "$APP_INSIGHTS_KEY" ]; then
    az functionapp config appsettings set \
        --name "$FUNC_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$APP_INSIGHTS_KEY" \
        > /dev/null
fi

# Deploy Function App code
echo "Deploying Function App code..."
cd "$PROJECT_DIR/azure-func-lists"
npm install --production
func azure functionapp publish "$FUNC_APP_NAME"

# Get Function App URL
FUNC_APP_URL="https://${FUNC_APP_NAME}.azurewebsites.net/api/processEmail"
FUNC_APP_KEY=$(az functionapp keys list \
    --name "$FUNC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query functionKeys.default -o tsv)

FUNC_APP_URL_WITH_KEY="${FUNC_APP_URL}?code=${FUNC_APP_KEY}"

# Create Logic App
echo "Creating Logic App: $LOGIC_APP_NAME"

# Prepare Logic App parameters
LOGIC_APP_PARAMS=$(cat << EOF
{
  "WatchedFolders": {
    "value": $(echo "$WATCHED_FOLDERS" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";""))')
  },
  "ReportEmail": {
    "value": "$REPORT_EMAIL"
  },
  "AdminEmail": {
    "value": "$ADMIN_EMAIL"
  },
  "FunctionAppUrl": {
    "value": "$FUNC_APP_URL_WITH_KEY"
  }
}
EOF
)

# Deploy Logic App
az logic workflow create \
    --name "$LOGIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --definition "@$PROJECT_DIR/azure-logic-lists/workflow.json" \
    2>/dev/null || echo "Logic App already exists, updating..."

# Note: The Office 365 connection needs to be created manually in Azure Portal
# because it requires OAuth authentication

echo
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo
echo "Function App URL: $FUNC_APP_URL"
echo "Function App URL (with key): $FUNC_APP_URL_WITH_KEY"
echo
echo "IMPORTANT: Next Steps"
echo "1. Go to Azure Portal > Logic Apps > $LOGIC_APP_NAME"
echo "2. Create an Office 365 connection (requires authentication)"
echo "3. Update the workflow parameters with the correct connection reference"
echo "4. Enable the Logic App"
echo
echo "Test the Function App:"
echo "curl -X POST '$FUNC_APP_URL_WITH_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"messageId\":\"test\",\"subject\":\"Test\",\"body\":\"Test\",\"headers\":{}}'"
echo
