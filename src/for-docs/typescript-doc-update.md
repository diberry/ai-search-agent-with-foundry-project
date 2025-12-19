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

2. Initialize package.json for ECMAScript modules:

```bash
npm init -y
npm pkg set type=module
```

3. Install the required Azure SDK packages:

```bash
npm install @azure/search-documents@^12.3.0-beta.1
npm install @azure/identity
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
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

6. Create a `.env` file with your Azure resource information:

```
# Azure AI Search Configuration
AZURE_SEARCH_ENDPOINT=https://<your-search-service-name>.search.windows.net

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://<your-ai-foundry-resource-name>.openai.azure.com/
AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
```

## Code the Application

Create an `index.ts` in the `src` folder. Use code from ./index-typescript.ts

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
