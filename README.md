# Azure AI Search Agentic Retrieval Quickstart (TypeScript)

This project demonstrates Azure AI Search's **agentic retrieval** capabilities using TypeScript. The application creates a knowledge agent that can intelligently search through NASA's "Earth at Night" e-book content using vector search, semantic ranking, and Azure OpenAI integration.

## 🌟 Features

- **Vector Search**: Uses Azure OpenAI embeddings (text-embedding-3-large) for semantic document retrieval
- **Knowledge Agent**: Creates an AI agent that can intelligently query and synthesize information
- **Multi-turn Conversation**: Supports conversational context across multiple queries
- **Semantic Search**: Leverages Azure AI Search semantic ranking for improved relevance
- **Keyless Authentication**: Uses Azure DefaultAzureCredential for secure, passwordless access

## 📋 Prerequisites

Before running this project, ensure you have:

1. **Node.js** v18.x or later
2. **Azure Subscription** with access to:
   - **Azure AI Search** service (Basic tier or higher)
   - **Azure OpenAI** or **Azure AI Foundry** resource with:
     - `gpt-5-mini` deployment (or similar chat model)
     - `text-embedding-3-large` deployment
3. **Azure CLI** installed and authenticated (`az login`)
4. **Permissions**: Your Azure identity needs:
   - `Search Service Contributor` role on the Azure AI Search service
   - `Cognitive Services OpenAI User` role on the Azure OpenAI resource

## 🚀 Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Navigate to the project directory
cd ai-search-agent-with-foundry-project

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root by copying the example:

```bash
cp .env.example .env
```

Edit `.env` with your Azure resource details:

```env
# Azure AI Search endpoint
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net

# Azure OpenAI endpoint
AZURE_OPENAI_ENDPOINT=https://your-ai-foundry-resource.openai.azure.com/

# Azure OpenAI deployments
AZURE_OPENAI_GPT_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large

# API version (optional - defaults are provided)
OPENAI_API_VERSION=2025-03-01-preview
```

### 3. Authenticate with Azure

```bash
# Login to Azure (if not already logged in)
az login

# Set your subscription (if you have multiple)
az account set --subscription "your-subscription-id"
```

### 4. Assign Required Roles

Ensure your Azure identity has the necessary permissions:

```bash
# Get your user principal ID
USER_ID=$(az ad signed-in-user show --query id -o tsv)

# Assign Search Service Contributor role
az role assignment create \
  --role "Search Service Contributor" \
  --assignee $USER_ID \
  --scope /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.Search/searchServices/{search-service-name}

# Assign Cognitive Services OpenAI User role
az role assignment create \
  --role "Cognitive Services OpenAI User" \
  --assignee $USER_ID \
  --scope /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.CognitiveServices/accounts/{openai-resource-name}
```

## 🏃 Running the Application

### Build the TypeScript code

```bash
npm run build
```

### Run the application

```bash
npm start
```

Or run in development mode with auto-recompilation:

```bash
npm run dev
```

## 📖 What the Application Does

The application performs the following steps:

1. **Creates a search index** (`earth_at_night`) with:
   - Vector search configuration using HNSW algorithm
   - Semantic search configuration for ranking
   - Azure OpenAI vectorizer for embeddings

2. **Uploads documents**: Fetches NASA's "Earth at Night" e-book content from GitHub and indexes it

3. **Creates a knowledge agent**: Configures an AI agent with:
   - Azure OpenAI GPT model for query understanding and synthesis
   - Target index for document retrieval
   - Reranking threshold for relevance filtering

4. **Runs agentic retrieval**: Processes two sample questions:
   - "Why do suburban belts display larger December brightening than urban cores..."
   - "How do I find lava at night?"

5. **Generates answers**: Uses Azure OpenAI to synthesize comprehensive responses based on retrieved documents

6. **Cleans up**: Deletes the knowledge agent and search index after completion

## 🔍 Understanding the Output

The application displays:

- **Agent Responses**: Initial synthesis from the knowledge agent
- **Activities**: Details about query planning, index search, and token usage
- **References**: Source documents used to answer the question with relevance scores
- **Final Answers**: Chat completion responses from Azure OpenAI

## 🛠️ Project Structure

```
ai-search-agent-with-foundry-project/
├── src/
│   └── index.ts          # Main application code
├── dist/                 # Compiled JavaScript (generated)
├── .env                  # Environment configuration (create from .env.example)
├── .env.example          # Environment template
├── .gitignore            # Git ignore patterns
├── package.json          # Node.js dependencies and scripts
├── tsconfig.json         # TypeScript compiler configuration
└── README.md             # This file
```

## 🔧 Troubleshooting

### Authentication Errors

If you see authentication errors:
```bash
# Refresh your Azure login
az login --scope https://cognitiveservices.azure.com/.default

# Verify your token
az account get-access-token --resource https://search.azure.com
```

### Role Assignment Issues

Role assignments can take a few minutes to propagate. Wait 2-3 minutes after assigning roles before running the application.

### Module Not Found Errors

Ensure all dependencies are installed:
```bash
rm -rf node_modules package-lock.json
npm install
```

### API Version Errors

If you encounter API version issues, verify your Azure resources support the preview API versions used in this quickstart:
- Azure AI Search: `2025-05-01-Preview`
- Azure OpenAI: `2025-03-01-preview`

## 📚 Learn More

- [Azure AI Search Documentation](https://learn.microsoft.com/azure/search/)
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [Agentic Retrieval Quickstart](https://learn.microsoft.com/azure/search/search-get-started-agentic-retrieval)
- [Azure SDK for JavaScript](https://github.com/Azure/azure-sdk-for-js)

## 🤝 Contributing

This is a quickstart sample. For production use, consider:
- Error handling improvements
- Logging and monitoring
- Configuration validation
- Rate limiting and retry logic
- Cost optimization for Azure resources

## 📝 License

This sample code is provided as-is for educational purposes.

## ⚠️ Important Notes

- This quickstart uses **preview API versions** that may change
- The knowledge agent feature is in **public preview**
- Running this code will **create and delete Azure resources** (index and agent)
- Ensure you have sufficient quota for Azure OpenAI deployments
- The application fetches sample data from GitHub automatically
