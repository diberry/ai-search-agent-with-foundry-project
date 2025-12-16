#!/bin/sh
#SUBSCRIPTION_ID=`az account show --query id -o tsv`

SUBSCRIPTION_ID="aa94d689-ef39-45c8-9434-0d9efb62b456"

echo "🗑️  Purging deleted Cognitive Services accounts..."
az rest --method get \
  --uri "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/deletedAccounts?api-version=2023-05-01" \
  --query "value[].id" -o tsv | xargs -r az resource delete --ids

echo ""
echo "✅ Verifying all resources have been purged..."
REMAINING=$(az rest --method get \
  --uri "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/deletedAccounts?api-version=2023-05-01" \
  --query "value[].id" -o tsv | wc -l)

if [ "$REMAINING" -eq 0 ]; then
  echo "✅ All deleted accounts have been purged successfully."
else
  echo "⚠️  Warning: $REMAINING deleted account(s) still remain."
  az rest --method get \
    --uri "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/deletedAccounts?api-version=2023-05-01" \
    --query "value[].[name, location]" -o table
fi