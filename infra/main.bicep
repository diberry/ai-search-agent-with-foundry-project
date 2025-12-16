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
          name: 'gpt-4o'
          version: '2024-11-20'
        }
        name: 'gpt-4o'
        sku: {
          capacity: 1
          name: 'Standard'
        }
      }
    ]
    location: location
    includeAssociatedResources: false
    aiFoundryConfiguration: {
      roleAssignments: [
        {
          principalId: managedIdentity.outputs.principalId
          roleDefinitionIdOrName: 'Azure AI Developer'
          principalType: 'ServicePrincipal'
        }
        {
          principalId: principalId
          roleDefinitionIdOrName: 'Azure AI Developer'
          principalType: principalType
        }
        // Grant AI Search service access to Azure OpenAI models for embeddings, query planning, and answer generation
        {
          principalId: aiSearch.outputs.systemAssignedMIPrincipalId!
          roleDefinitionIdOrName: 'Cognitive Services User'
          principalType: 'ServicePrincipal'
        }
      ]
    }
  }
}

/*


  (✓) Done: Resource group: rg-dibproj (3.301s)
  (✓) Done: Search service: gm767p5jbjaie-search (846ms)
  |      =| Creating/Updating resources
ERROR: error executing step command 'provision': deployment failed: error deploying infrastructure: deploying to subscription: 

Deployment Error Details:
InvalidTemplate: Unable to process template language expressions for resource '/subscriptions/aa94d689-ef39-45c8-9434-0d9efb62b456/resourceGroups/rg-dibproj/providers/Microsoft.Resources/deployments/azure-ai-foundry-project' at line '1' and column '88107'. 'The language expression property 'value' doesn't exist, available properties are 'type'.'

TraceID: 05a5d77f91f35548579c609b33180ccc

*/


// Resources
output AZURE_RESOURCE_GROUP string = resourceGroupName

// Endpoints
output AZURE_AI_PROJECT_ENDPOINT string = aiProject.outputs.aiProjectName
output AZURE_AI_PROJECT_NAME string = aiProject.outputs.aiProjectName
output AZURE_AI_SEARCH_SERVICE_NAME string = aiSearch.outputs.name
output AZURE_AI_SERVICES_NAME string = aiProject.outputs.aiServicesName
