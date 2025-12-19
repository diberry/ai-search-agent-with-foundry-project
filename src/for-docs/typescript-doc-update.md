# Quickstart: Use agentic retrieval in Azure AI Search (TypeScript)

## Prerequisites

- An Azure account with an active subscription
- An Azure AI Search service in any region that provides agentic retrieval
- A Microsoft Foundry project with deployed models:
  - An embedding model (e.g., `text-embedding-3-large`)
  - An LLM for query planning and answer generation (e.g., `gpt-4o-mini`)
- The Azure CLI for keyless authentication with Microsoft Entra ID

## Set up the environment

1. Create a new folder for your application:

```bash
mkdir quickstart-agentic-retrieval && cd quickstart-agentic-retrieval
```

2. Initialize package.json:

```bash
npm init -y
npm pkg set type=module
```

3. Install the required Azure SDK packages:

```bash
npm install @azure/search-documents@^12.3.0-beta.1
npm install @azure/identity@^4.5.0
```

4. Install TypeScript as a dev dependency:

```bash
npm install --save-dev typescript @types/node
```

5. Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "node",
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

6. Create a `.env` file with your Azure resource information:

```
AZURE_OPENAI_ENDPOINT=https://<your-ai-foundry-resource-name>.openai.azure.com/
AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
AZURE_SEARCH_ENDPOINT=https://<your-search-service-name>.search.windows.net
```

## Imports and Setup

The Azure Search Documents SDK provides all the functionality needed for agentic retrieval:

```typescript
import { DefaultAzureCredential } from '@azure/identity';
import {
    SearchIndexClient,
    SearchClient,
    SearchIndex,
    SearchField,
    VectorSearch,
    VectorSearchProfile,
    HnswAlgorithmConfiguration,
    AzureOpenAIVectorizer,
    AzureOpenAIParameters,
    KnowledgeRetrievalClient,
    SemanticSearch,
    SemanticConfiguration,
    SemanticPrioritizedFields,
    SemanticField,
    SearchIndexingBufferedSender,
    KnowledgeRetrievalOutputMode,
    IndexDocumentsAction
} from '@azure/search-documents';
import type { IndexDocumentsResult } from '@azure/search-documents';
```

Note: All functionality is provided by `@azure/search-documents`. The SDK handles Azure OpenAI integration internally, so no separate OpenAI packages are needed.

## Environment Variables

Use Node.js built-in environment file support (no dotenv package required):

```bash
node --env-file ./.env dist/index.js
```

## Create Knowledge Source and Knowledge Base

Create a knowledge source that points to your search index:

```typescript
await searchIndexClient.createKnowledgeSource({
    name: 'earth-knowledge-source',
    description: "Knowledge source for Earth at Night e-book content",
    kind: "searchIndex",
    searchIndexParameters: {
        searchIndexName: 'earth_at_night',
        sourceDataFields: [
            { name: "id" },
            { name: "page_number" }
        ]
    }
});
```

Create a knowledge base that uses the knowledge source:

```typescript
await searchIndexClient.createKnowledgeBase({
    name: 'earth-knowledge-base',
    knowledgeSources: [
        {
            name: 'earth-knowledge-source'
        }
    ],
    models: [
        {
            kind: "azureOpenAI",
            azureOpenAIParameters: {
                resourceUrl: process.env.AZURE_OPENAI_ENDPOINT!,
                deploymentId: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!,
                modelName: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!
            }
        }
    ],
    outputMode: "answerSynthesis" as KnowledgeRetrievalOutputMode,
    answerInstructions: "Provide a two sentence concise and informative answer based on the retrieved documents."
});
```

## Knowledge Retrieval Client

Use the `KnowledgeRetrievalClient` for querying:

```typescript
const knowledgeRetrievalClient = new KnowledgeRetrievalClient(
    process.env.AZURE_SEARCH_ENDPOINT!,
    'earth-knowledge-base',
    credential
);

const retrievalRequest = {
    messages: [
        {
            role: "user",
            content: [
                {
                    type: "text" as const,
                    text: query1
                }
            ]
        }
    ],
    knowledgeSourceParams: [
        {
            kind: "searchIndex" as const,
            knowledgeSourceName: 'earth-knowledge-source',
            includeReferences: true,
            includeReferenceSourceData: true,
            alwaysQuerySource: true,
            rerankerThreshold: 2.5
        }
    ],
    includeActivity: true,
    retrievalReasoningEffort: { kind: "low" as const }
};

const result = await knowledgeRetrievalClient.retrieveKnowledge(retrievalRequest);
```

## Document Upload with Buffered Sender

Use `SearchIndexingBufferedSender` for efficient document upload with monitoring:

```typescript
const bufferedClient = new SearchIndexingBufferedSender<EarthAtNightDocument>(
    searchClient,
    documentKeyRetriever,
    {
        autoFlush: true,
    },
);

// Event handlers for monitoring upload progress
bufferedClient.on("batchAdded", (batch) => {
    console.log(`Batch Added Event: action=${batch.action}, documents=${batch.documents?.length || 0}`);
});

bufferedClient.on("batchSucceeded", (response) => {
    console.log(`Successfully indexed ${response.results.length} documents`);
});

await bufferedClient.uploadDocuments(documents);
await bufferedClient.flush();
await bufferedClient.dispose();
```

## Display Results

Display the answer, activity, and references:

```typescript
console.log("\n📝 ANSWER:");
console.log("─".repeat(80));
if (result.response && result.response.length > 0) {
    result.response.forEach((msg) => {
        if (msg.content && msg.content.length > 0) {
            msg.content.forEach((content) => {
                if (content.type === "text" && 'text' in content) {
                    console.log(content.text);
                }
            });
        }
    });
}
console.log("─".repeat(80));

if (result.activity) {
    console.log("\nActivities:");
    result.activity.forEach((activity) => {
        console.log(`Activity Type: ${activity.type}`);
        console.log(JSON.stringify(activity, null, 2));
    });
}

if (result.references) {
    console.log("\nReferences:");
    result.references.forEach((reference) => {
        console.log(`Reference Type: ${reference.type}`);
        console.log(JSON.stringify(reference, null, 2));
    });
}

// Clean up resources
await searchIndexClient.deleteKnowledgeBase('earth-knowledge-base');
await searchIndexClient.deleteKnowledgeSource('earth-knowledge-source');
await searchIndexClient.deleteIndex('earth_at_night');
```

## Run the Application

1. Compile TypeScript:

```bash
tsc
```

2. Sign in to Azure:

```bash
az login
```

3. Run the application:

```bash
node --env-file ./.env dist/index.js
```
