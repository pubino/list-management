#!/bin/bash

# Destroy Azure Logic App and Function App deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.env"

# Load configuration
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

source "$CONFIG_FILE"

# Validate required variables
required_vars="RESOURCE_GROUP FUNC_APP_NAME LOGIC_APP_NAME STORAGE_ACCOUNT"
for var in $required_vars; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in $CONFIG_FILE"
        exit 1
    fi
done

echo "==================================="
echo "Destroying Azure Deployment"
echo "==================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Function App:   $FUNC_APP_NAME"
echo "Logic App:      $LOGIC_APP_NAME"
echo "Storage:        $STORAGE_ACCOUNT"
echo "==================================="
echo
echo "WARNING: This will permanently delete these resources!"
echo

# Confirm destruction
read -p "Are you sure you want to destroy these resources? (yes/no) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    echo "Aborted."
    exit 0
fi

# Delete Logic App
echo "Deleting Logic App: $LOGIC_APP_NAME"
az logic workflow delete \
    --name "$LOGIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --yes \
    2>/dev/null && echo "  Logic App deleted" || echo "  Logic App not found or already deleted"

# Delete Function App
echo "Deleting Function App: $FUNC_APP_NAME"
az functionapp delete \
    --name "$FUNC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    2>/dev/null && echo "  Function App deleted" || echo "  Function App not found or already deleted"

# Delete Application Insights (auto-created with Function App)
echo "Deleting Application Insights: $FUNC_APP_NAME"
az monitor app-insights component delete \
    --app "$FUNC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    2>/dev/null && echo "  Application Insights deleted" || echo "  Application Insights not found or already deleted"

# Delete Storage Account
echo "Deleting Storage Account: $STORAGE_ACCOUNT"
az storage account delete \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --yes \
    2>/dev/null && echo "  Storage Account deleted" || echo "  Storage Account not found or already deleted"

echo
echo "==================================="
echo "Destruction Complete"
echo "==================================="
echo
echo "Note: The resource group '$RESOURCE_GROUP' was NOT deleted."
echo "To delete the resource group and ALL its contents, run:"
echo "  az group delete --name $RESOURCE_GROUP --yes"
echo
