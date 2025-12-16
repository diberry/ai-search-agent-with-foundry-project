targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@maxLength(90)
@description('Name of the resource group to use or create')
param resourceGroupName string = 'rg-${environmentName}'

// Restricted locations to match list from
// https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key#region-availability
@minLength(1)
@description('Primary location for all resources')
@allowed([
  // 'australiaeast'
  // 'brazilsouth'
  // 'canadacentral'
  // 'canadaeast'
  // 'eastus'
  'eastus2'
  // 'francecentral'
  // 'germanywestcentral'
  // 'italynorth'
  // 'japaneast'
  // 'koreacentral'
  // 'northcentralus'
  // 'norwayeast'
  // 'polandcentral'
  // 'southafricanorth'
  // 'southcentralus'
  // 'southeastasia'
  // 'southindia'
  // 'spaincentral'
  // 'swedencentral'
  // 'switzerlandnorth'
  // 'uaenorth'
  // 'uksouth'
  // 'westus'
  // 'westus2'
  // 'westus3'
])
param location string

@metadata({
  azd: {
    type: 'location'
    usageName: [
      'OpenAI.GlobalStandard.gpt-4o-mini,10'
    ]
  }
})
@description('Id of the user or app to assign application roles')
param principalId string

@description('Principal type of user or app')
param principalType string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Tags that should be applied to all resources.
// 
// Note that 'azd-service-name' tags should be applied separately to service host resources.
// Example usage:
//   tags: union(tags, { 'azd-service-name': <service name in azure.yaml> })
var tags = {
  'azd-env-name': environmentName
}

// Check if resource group exists and create it if it doesn't
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// User-assigned managed identity f
module managedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.0' = {
  name: 'solutionIdentity'
  scope: resourceGroup
  params: {
    name: '${resourceToken}-identity'
    location: location
    tags: tags
  }
}

module aiSearch 'br/public:avm/res/search/search-service:0.11.1' = {
  name: 'aiSearch'
  scope: resourceGroup
  params: {
    name: '${resourceToken}-search'
    location: location
    sku: 'basic'
    tags: tags
    semanticSearch: 'standard'
    partitionCount: 1
    replicaCount: 1
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    managedIdentities: {
      systemAssigned: true
    }
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
    roleAssignments: [
      {
        principalId: principalId
        roleDefinitionIdOrName: 'Search Index Data Contributor'
        principalType: principalType
      }
      {
        principalId: principalId
        roleDefinitionIdOrName: 'Search Index Data Reader'
        principalType: principalType
      }
      {
        principalId: principalId
        roleDefinitionIdOrName: 'Search Service Contributor'
        principalType: principalType
      } 
      {
        principalId: principalId
        roleDefinitionIdOrName: 'Contributor'
        principalType: principalType
      }
      // Managed Identity needs full permissions to create index and upload documents
      {
        principalId: managedIdentity.outputs.principalId
        roleDefinitionIdOrName: 'Search Index Data Contributor'
        principalType: 'ServicePrincipal'
      }
      {
        principalId: managedIdentity.outputs.principalId
        roleDefinitionIdOrName: 'Search Index Data Reader'
        principalType: 'ServicePrincipal'
      }
      {
        principalId: managedIdentity.outputs.principalId
        roleDefinitionIdOrName: 'Search Service Contributor'
        principalType: 'ServicePrincipal'
      }
    ]
  }
}

module aiProject 'br/public:avm/ptn/ai-ml/ai-foundry:0.6.0' = {
  scope: resourceGroup
  name: 'azure-ai-foundry-project'
  params: {
    // Required parameters
    baseName: 'dibproj'
    // Non-required parameters
    aiModelDeployments: [
      {
        model: {
          format: 'OpenAI'
          name: 'gpt-5-mini'
          version: '2025-08-07'
        }
        name: 'gpt-5-mini'
        sku: {
          capacity: 50
          name: 'GlobalStandard'
        }
      }
      {
        model: {
          format: 'OpenAI'
          name: 'text-embedding-3-large'
          version: '1'
        }
        name: 'text-embedding-3-large'
        sku: {
          capacity: 50
          name: 'Standard'
        }
      }
    ]
    location: location
    includeAssociatedResources: false
    aiFoundryConfiguration: {
      roleAssignments: [
        // Managed Identity - for application runtime
        {
          principalId: managedIdentity.outputs.principalId
          roleDefinitionIdOrName: 'Azure AI Developer'
          principalType: 'ServicePrincipal'
        }
        {
          principalId: managedIdentity.outputs.principalId
          roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
          principalType: 'ServicePrincipal'
        }
        // User/Local Identity - for development and testing
        {
          principalId: principalId
          roleDefinitionIdOrName: 'Azure AI Developer'
          principalType: principalType
        }
        {
          principalId: principalId
          roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
          principalType: principalType
        }
        // AI Search system identity - for vectorization and embeddings
        {
          principalId: aiSearch.outputs.systemAssignedMIPrincipalId!
          roleDefinitionIdOrName: 'Cognitive Services User'
          principalType: 'ServicePrincipal'
        }
      ]
    }
    aiSearchConfiguration:{existingResourceId: aiSearch.outputs.resourceId}
  }
}


// Resources
output AZURE_RESOURCE_GROUP string = resourceGroupName

// Search Service
output AZURE_SEARCH_ENDPOINT string = 'https://${aiSearch.outputs.name}.search.windows.net'
output AZURE_AI_SEARCH_SERVICE_NAME string = aiSearch.outputs.name

// Azure OpenAI / Foundry
// The AI Services endpoint is in format: https://<ai-services-name>.cognitiveservices.azure.com/
output AZURE_OPENAI_ENDPOINT string = 'https://${aiProject.outputs.aiServicesName}.cognitiveservices.azure.com/'
output AZURE_OPENAI_GPT_DEPLOYMENT string = 'gpt-5-mini'
output AZURE_OPENAI_EMBEDDING_DEPLOYMENT string = 'text-embedding-3-large'
output OPENAI_API_VERSION string = '2025-01-01-preview'
output EMBEDDING_API_VERSION string = '2023-05-15'

// AI Project
output AZURE_AI_PROJECT_NAME string = aiProject.outputs.aiProjectName
output AZURE_AI_SERVICES_NAME string = aiProject.outputs.aiServicesName

