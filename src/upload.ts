import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
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
    SemanticSearch,
    SemanticConfiguration,
    SemanticPrioritizedFields,
    SemanticField,
    SearchIndexingBufferedSender
} from '@azure/search-documents';

// Configuration - Update these values for your environment
const config = {
    searchEndpoint: process.env.AZURE_SEARCH_ENDPOINT!,
    azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    azureOpenAIGptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!,
    azureOpenAIGptModel: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!,
    azureOpenAIEmbeddingDeployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    azureOpenAIEmbeddingModel: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    indexName: 'earth_at_night',
    knowledgeSourceName: 'earth-knowledge-source',
    knowledgeBaseName: 'earth-knowledge-base',
    searchApiVersion: "2025-11-01-preview"
};
export const documentKeyRetriever: (document: Hotel) => string = (document: Hotel): string => {
  return document.hotelId!;
};

export const WAIT_TIME = 4000;
export function delay(timeInMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeInMs));
}
interface EarthAtNightDocument {
    id: string;
    page_chunk: string;
    page_embedding_text_3_large: number[];
    page_number: number;
}
const index: SearchIndex = {
    name: config.indexName,
    fields: [
        {
            name: "id",
            type: "Edm.String",
            key: true,
            filterable: true,
            sortable: true,
            facetable: true
        } as SearchField,
        {
            name: "page_chunk",
            type: "Edm.String",
            searchable: true,
            filterable: false,
            sortable: false,
            facetable: false
        } as SearchField,
        {
            name: "page_embedding_text_3_large",
            type: "Collection(Edm.Single)",
            searchable: true,
            filterable: false,
            sortable: false,
            facetable: false,
            vectorSearchDimensions: 3072,
            vectorSearchProfileName: "hnsw_text_3_large"
        } as SearchField,
        {
            name: "page_number",
            type: "Edm.Int32",
            filterable: true,
            sortable: true,
            facetable: true
        } as SearchField
    ],
    vectorSearch: {
        profiles: [
            {
                name: "hnsw_text_3_large",
                algorithmConfigurationName: "alg",
                vectorizerName: "azure_openai_text_3_large"
            } as VectorSearchProfile
        ],
        algorithms: [
            {
                name: "alg",
                kind: "hnsw"
            } as HnswAlgorithmConfiguration
        ],
        vectorizers: [
            {
                vectorizerName: "azure_openai_text_3_large",
                kind: "azureOpenAI",
                parameters: {
                    resourceUrl: config.azureOpenAIEndpoint,
                    deploymentId: config.azureOpenAIEmbeddingDeployment,
                    modelName: config.azureOpenAIEmbeddingModel
                } as AzureOpenAIParameters
            } as AzureOpenAIVectorizer
        ]
    } as VectorSearch,
    semanticSearch: {
        defaultConfigurationName: "semantic_config",
        configurations: [
            {
                name: "semantic_config",
                prioritizedFields: {
                    contentFields: [
                        { name: "page_chunk" } as SemanticField
                    ]
                } as SemanticPrioritizedFields
            } as SemanticConfiguration
        ]
    } as SemanticSearch
};

const credential = new DefaultAzureCredential();
const searchTokenProvider = getBearerTokenProvider(credential, "https://search.azure.com/.default");
const openAITokenProvider = getBearerTokenProvider(credential, "https://cognitiveservices.azure.com/.default");


const searchIndexClient = new SearchIndexClient(config.searchEndpoint, credential);
const searchClient = new SearchClient<EarthAtNightDocument>(config.searchEndpoint, config.indexName, credential);

await searchIndexClient.createOrUpdateIndex(index);

// get Documents with vectors
const response = await fetch("https://raw.githubusercontent.com/Azure-Samples/azure-search-sample-data/refs/heads/main/nasa-e-book/earth-at-night-json/documents.json");

if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
}
const documents = await response.json() as any[];

const bufferedClient = new SearchIndexingBufferedSender<EarthAtNightDocument>(
    searchClient,
    documentKeyRetriever,
    {
        autoFlush: true,
    },
);

bufferedClient.on("batchAdded", (response: any) => {
    console.log(`Batch Added Event has been receieved with id: ${response.batchId}`);
});

bufferedClient.on("beforeDocumentSent", (response: any) => {
    console.log(`Before Document Sent Event has been receieved with id: ${response.batchId}`);
});

bufferedClient.on("batchSucceeded", (response: any) => {
    console.log("Batch Succeeded Event has been receieved....");
    console.log(response);
});

bufferedClient.on("batchFailed", (response: any) => {
    console.log("Batch Failed Event has been receieved....");
    console.log(response);
});

await bufferedClient.uploadDocuments(documents);

console.log(`Waiting 40 seconds for indexing to complete...`);
await delay(WAIT_TIME);

let count = await searchClient.getDocumentsCount();
while (count !== documents.length) {
    await delay(WAIT_TIME);
    count = await searchClient.getDocumentsCount();
}