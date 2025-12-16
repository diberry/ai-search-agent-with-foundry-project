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
    SemanticField
} from '@azure/search-documents';
import { AzureOpenAI } from "openai/index.mjs";


console.log(process.env);

// Configuration - Update these values for your environment
const config = {
    searchEndpoint: process.env.AZURE_SEARCH_ENDPOINT!,
    azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    azureOpenAIGptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!,
    azureOpenAIGptModel: process.env.AZURE_OPENAI_GPT_DEPLOYMENT!,
    azureOpenAIApiVersion: process.env.OPENAI_API_VERSION!,
    azureOpenAIEmbeddingDeployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    azureOpenAIEmbeddingModel: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    azureOpenAIEmbeddingApiVersion: process.env.EMBEDDING_API_VERSION!,
    indexName: 'earth_at_night',
    knowledgeSourceName: 'earth-knowledge-source',
    knowledgeBaseName: 'earth-knowledge-base',
    searchApiVersion: "2025-11-01-preview"
};

// Earth at Night document interface
interface EarthAtNightDocument {
    id: string;
    page_chunk: string;
    page_embedding_text_3_large: number[];
    page_number: number;
}

// Knowledge agent message interface
interface KnowledgeAgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Agentic retrieval response interface
interface AgenticRetrievalResponse {
    response?: string | any[];
    references?: Array<{
        docKey?: string;
        content?: string;
        score?: number;
        referenceType?: string;
        type?: string;
        SourceData?: any;
        Id?: string;
        ActivitySource?: number;
        // Allow any additional properties
        [key: string]: any;
    }>;
    activity?: Array<{
        step?: string;
        description?: string;
        tokensUsed?: number;
        activityType?: string;
        type?: string;
        InputTokens?: number;
        OutputTokens?: number;
        TargetIndex?: string;
        QueryTime?: string;
        Query?: any;
        Count?: number;
        ElapsedMs?: number | null;
        Id?: number;
        // Allow any additional properties
        [key: string]: any;
    }>;
    // Add any other possible response fields
    [key: string]: any;
}

async function prepareSearchService(uploadDocs: boolean): Promise<{
    searchIndexClient: SearchIndexClient;
    credential: DefaultAzureCredential;
    openAIClient: AzureOpenAI;
}> {
    // Initialize Azure credentials using managed identity (recommended)
    const credential = new DefaultAzureCredential();

    // Create search clients
    const searchIndexClient = new SearchIndexClient(config.searchEndpoint, credential);
    const searchClient = new SearchClient<EarthAtNightDocument>(config.searchEndpoint, config.indexName, credential);

    // Create Azure OpenAI client
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    const openAIClient = new AzureOpenAI({
        endpoint: config.azureOpenAIEndpoint,
        apiVersion: config.azureOpenAIApiVersion,
        azureADTokenProvider,
    });

    if (uploadDocs) {
        // Create search index with vector and semantic capabilities
        await createSearchIndex(searchIndexClient);

        // Upload sample documents
        await uploadDocuments(searchClient);
    } else {
        console.log("⏭️ Skipping document upload (UPLOAD_DOCS=false)");
    }

    // Create knowledge source and knowledge base for agentic retrieval
    await createKnowledgeSource(credential);
    await createKnowledgeBase(credential);

    return { searchIndexClient, credential, openAIClient };
}


async function main(): Promise<void> {
    try {
        console.log("🚀 Starting Azure AI Search agentic retrieval quickstart...\n");

        const uploadDocs = process.env.UPLOAD_DOCS !== 'false';
        const cleanupResources = process.env.CLEANUP_RESOURCES !== 'false';

        const { searchIndexClient, credential, openAIClient } = await prepareSearchService(uploadDocs);

        // Run agentic retrieval with conversation
        await runAgenticRetrieval(credential, openAIClient);

        // Clean up resources based on env var
        await cleanupAllResources(searchIndexClient, credential, cleanupResources);

        console.log("✅ Quickstart completed successfully!");

    } catch (error) {
        console.error("❌ Error in main execution:", error);
        throw error;
    }
}

async function createSearchIndex(indexClient: SearchIndexClient): Promise<void> {
    console.log("📊 Creating search index...");

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

    try {
        await indexClient.createOrUpdateIndex(index);
        console.log(`✅ Index '${config.indexName}' created or updated successfully.`);
    } catch (error) {
        console.error("❌ Error creating index:", error);
        throw error;
    }
}

async function deleteSearchIndex(indexClient: SearchIndexClient): Promise<void> {
    console.log("🗑️ Deleting search index...");

    try {
        await indexClient.deleteIndex(config.indexName);
        console.log(`✅ Search index '${config.indexName}' deleted successfully.`);

    } catch (error: any) {
        if (error?.statusCode === 404 || error?.code === 'IndexNotFound') {
            console.log(`ℹ️ Search index '${config.indexName}' does not exist or was already deleted.`);
            return;
        }
        console.error("❌ Error deleting search index:", error);
        throw error;
    }
}

// Fetch Earth at Night documents from GitHub
async function fetchEarthAtNightDocuments(): Promise<EarthAtNightDocument[]> {
    console.log("📡 Fetching Earth at Night documents from GitHub...");

    const documentsUrl = "https://raw.githubusercontent.com/Azure-Samples/azure-search-sample-data/refs/heads/main/nasa-e-book/earth-at-night-json/documents.json";

    try {
        const response = await fetch(documentsUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
        }

        const documents = await response.json() as any[];
        console.log(`✅ Fetched ${documents.length} documents from GitHub`);

        // Validate and transform documents to match our interface
        const transformedDocuments: EarthAtNightDocument[] = documents.map((doc: any, index: number) => {
            return {
                id: doc.id || String(index + 1),
                page_chunk: doc.page_chunk || doc.content || '',
                page_embedding_text_3_large: doc.page_embedding_text_3_large || new Array(3072).fill(0.1),
                page_number: doc.page_number || index + 1
            };
        });

        return transformedDocuments;

    } catch (error) {
        console.error("❌ Error fetching documents from GitHub:", error);
        console.log("🔄 Falling back to sample documents...");

        // Fallback to sample documents if fetch fails
        return [
            {
                id: "1",
                page_chunk: "The Earth at night reveals the patterns of human settlement and economic activity. City lights trace the contours of civilization, creating a luminous map of where people live and work.",
                page_embedding_text_3_large: new Array(3072).fill(0.1),
                page_number: 1
            },
            {
                id: "2",
                page_chunk: "From space, the aurora borealis appears as shimmering curtains of green and blue light dancing across the polar regions.",
                page_embedding_text_3_large: new Array(3072).fill(0.2),
                page_number: 2
            }
            // Add more fallback documents as needed
        ];
    }
}

async function uploadDocuments(searchClient: SearchClient<EarthAtNightDocument>): Promise<void> {
    console.log("📄 Uploading documents...");

    try {
        // Fetch documents from GitHub
        const documents = await fetchEarthAtNightDocuments();

        const result = await searchClient.uploadDocuments(documents);
        console.log(`✅ Uploaded ${result.results.length} documents successfully.`);

        // Wait for indexing to complete
        console.log("⏳ Waiting for document indexing to complete...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log("✅ Document indexing completed.");

    } catch (error) {
        console.error("❌ Error uploading documents:", error);
        throw error;
    }
}

async function createKnowledgeSource(credential: DefaultAzureCredential): Promise<void> {
    console.log("📚 Creating or getting knowledge source...");

    try {
        const token = await getAccessToken(credential, "https://search.azure.com/.default");
        
        // Check if knowledge source already exists
        const getResponse = await fetch(`${config.searchEndpoint}/knowledgesources/${config.knowledgeSourceName}?api-version=${config.searchApiVersion}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (getResponse.ok) {
            console.log(`ℹ️ Knowledge source '${config.knowledgeSourceName}' already exists. Using existing resource.`);
            return;
        }

        // Create new knowledge source if it doesn't exist
        const knowledgeSourceDefinition = {
            name: config.knowledgeSourceName,
            description: "Knowledge source for Earth at Night e-book content",
            kind: "searchIndex",
            searchIndexParameters: {
                searchIndexName: config.indexName
            }
        };

        const response = await fetch(`${config.searchEndpoint}/knowledgesources?api-version=${config.searchApiVersion}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(knowledgeSourceDefinition)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create knowledge source: ${response.status} ${response.statusText}\n${errorText}`);
        }

        console.log(`✅ Knowledge source '${config.knowledgeSourceName}' created successfully.`);

    } catch (error) {
        console.error("❌ Error creating knowledge source:", error);
        throw error;
    }
}

// Function to create knowledge base
async function createKnowledgeBase(credential: DefaultAzureCredential): Promise<void> {
    console.log("🗄️ Creating or updating knowledge base...");

    const knowledgeBaseDefinition = {
        name: config.knowledgeBaseName,
        knowledgeSources: [
            {
                name: config.knowledgeSourceName
            }
        ],
        models: [
            {
                kind: "azureOpenAI",
                azureOpenAIParameters: {
                    resourceUri: config.azureOpenAIEndpoint,
                    deploymentId: config.azureOpenAIGptDeployment,
                    modelName: config.azureOpenAIGptModel
                }
            }
        ],
        outputMode: "answerSynthesis",
        answerInstructions: "Provide a two sentence concise and informative answer based on the retrieved documents."
    };

    try {
        const token = await getAccessToken(credential, "https://search.azure.com/.default");
        
        // PUT creates or updates - check if it exists first for better logging
        const getResponse = await fetch(`${config.searchEndpoint}/knowledgebases/${config.knowledgeBaseName}?api-version=${config.searchApiVersion}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const exists = getResponse.ok;
        
        const response = await fetch(`${config.searchEndpoint}/knowledgebases/${config.knowledgeBaseName}?api-version=${config.searchApiVersion}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(knowledgeBaseDefinition)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create knowledge base: ${response.status} ${response.statusText}\n${errorText}`);
        }

        if (exists) {
            console.log(`✅ Knowledge base '${config.knowledgeBaseName}' updated successfully.`);
        } else {
            console.log(`✅ Knowledge base '${config.knowledgeBaseName}' created successfully.`);
        }

    } catch (error) {
        console.error("❌ Error creating knowledge base:", error);
        throw error;
    }
}

async function runAgenticRetrieval(credential: DefaultAzureCredential, openAIClient: AzureOpenAI): Promise<void> {
    console.log("🔍 Running agentic retrieval...");

    const messages: KnowledgeAgentMessage[] = [
        {
            role: "system",
            content: `A Q&A agent that can answer questions about the Earth at night.
Sources have a JSON format with a ref_id that must be cited in the answer.
If you do not have the answer, respond with "I don't know".`
        },
        {
            role: "user",
            content: "Why do suburban belts display larger December brightening than urban cores even though absolute light levels are higher downtown? Why is the Phoenix nighttime street grid is so sharply visible from space, whereas large stretches of the interstate between midwestern cities remain comparatively dim?"
        }
    ];

    try {
        // Call agentic retrieval API
        const userMessages = messages.filter(m => m.role !== "system");
        const retrievalResponse = await callAgenticRetrieval(credential, userMessages);

        // Extract the assistant response from agentic retrieval
        let assistantContent = '';
        if (typeof retrievalResponse.response === 'string') {
            assistantContent = retrievalResponse.response;
        } else if (Array.isArray(retrievalResponse.response)) {
            assistantContent = JSON.stringify(retrievalResponse.response);
        }

        // Add assistant response to conversation history
        messages.push({
            role: "assistant",
            content: assistantContent
        });

        console.log(assistantContent);

        // Log activities and results...
        console.log("\nActivities:");
        if (retrievalResponse.activity && Array.isArray(retrievalResponse.activity)) {
            retrievalResponse.activity.forEach((activity) => {
                const activityType = activity.activityType || activity.type || 'UnknownActivityRecord';
                console.log(`Activity Type: ${activityType}`);
                console.log(JSON.stringify(activity, null, 2));
            });
        }

        console.log("Results");
        if (retrievalResponse.references && Array.isArray(retrievalResponse.references)) {
            retrievalResponse.references.forEach((reference) => {
                const referenceType = reference.referenceType || reference.type || 'AzureSearchDoc';
                console.log(`Reference Type: ${referenceType}`);
                console.log(JSON.stringify(reference, null, 2));
            });
        }

        // Now do chat completion with full conversation history
        await generateFinalAnswer(openAIClient, messages);

        // Continue conversation with second question
        await continueConversation(credential, openAIClient, messages);

    } catch (error) {
        console.error("❌ Error in agentic retrieval:", error);
        throw error;
    }
}

async function generateFinalAnswer(
    openAIClient: AzureOpenAI,
    messages: KnowledgeAgentMessage[]
): Promise<void> {

    console.log("\n[ASSISTANT]: ");

    try {
        const completion = await openAIClient.chat.completions.create({
            model: config.azureOpenAIGptDeployment,
            messages: messages.map(m => ({ role: m.role, content: m.content })) as any,
            max_tokens: 1000,
            temperature: 0.7
        });

        const answer = completion.choices[0].message.content;
        console.log(answer?.replace(/\./g, "\n"));

        // Add this response to conversation history
        if (answer) {
            messages.push({
                role: "assistant",
                content: answer
            });
        }

    } catch (error) {
        console.error("❌ Error generating final answer:", error);
        throw error;
    }
}

async function callAgenticRetrieval(
    credential: DefaultAzureCredential,
    messages: KnowledgeAgentMessage[]
): Promise<AgenticRetrievalResponse> {

    // Convert messages to the correct format expected by the Knowledge agent
    const agentMessages = messages.map(msg => ({
        role: msg.role,
        content: [
            {
                type: "text",
                text: msg.content
            }
        ]
    }));

    const retrievalRequest = {
        messages: agentMessages,
        knowledgeSourceParams: [
            {
                knowledgeSourceName: config.knowledgeSourceName,
                kind: "searchIndex",
                includeReferences: true,
                includeReferenceSourceData: true,
                alwaysQuerySource: true,
                rerankerThreshold: 2.5
            }
        ],
        includeActivity: true,
        retrievalReasoningEffort: { kind: "low" }
    };

    const token = await getAccessToken(credential, "https://search.azure.com/.default");
    const response = await fetch(
        `${config.searchEndpoint}/knowledgebases/${config.knowledgeBaseName}/retrieve?api-version=${config.searchApiVersion}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(retrievalRequest)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agentic retrieval failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return await response.json() as AgenticRetrievalResponse;
}

async function cleanupAllResources(
    searchIndexClient: SearchIndexClient,
    credential: DefaultAzureCredential,
    cleanup: boolean
): Promise<void> {
    if (!cleanup) {
        console.log("⏭️ Skipping resource cleanup (CLEANUP_RESOURCES=false)");
        return;
    }

    console.log("\n🧹 Cleaning up resources...");

    // Delete in reverse order of creation
    await deleteKnowledgeBase(credential);
    await deleteKnowledgeSource(credential);
    await deleteSearchIndex(searchIndexClient);
}

async function deleteKnowledgeBase(credential: DefaultAzureCredential): Promise<void> {
    console.log("🗑️ Deleting knowledge base...");

    try {
        const token = await getAccessToken(credential, "https://search.azure.com/.default");
        const response = await fetch(`${config.searchEndpoint}/knowledgebases/${config.knowledgeBaseName}?api-version=${config.searchApiVersion}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log(`ℹ️ Knowledge base '${config.knowledgeBaseName}' does not exist or was already deleted.`);
                return;
            }
            const errorText = await response.text();
            throw new Error(`Failed to delete knowledge base: ${response.status} ${response.statusText}\n${errorText}`);
        }

        console.log(`✅ Knowledge base '${config.knowledgeBaseName}' deleted successfully.`);

    } catch (error) {
        console.error("❌ Error deleting knowledge base:", error);
        throw error;
    }
}

async function deleteKnowledgeSource(credential: DefaultAzureCredential): Promise<void> {
    console.log("🗑️ Deleting knowledge source...");

    try {
        const token = await getAccessToken(credential, "https://search.azure.com/.default");
        const response = await fetch(`${config.searchEndpoint}/knowledgesources/${config.knowledgeSourceName}?api-version=${config.searchApiVersion}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log(`ℹ️ Knowledge source '${config.knowledgeSourceName}' does not exist or was already deleted.`);
                return;
            }
            const errorText = await response.text();
            throw new Error(`Failed to delete knowledge source: ${response.status} ${response.statusText}\n${errorText}`);
        }

        console.log(`✅ Knowledge source '${config.knowledgeSourceName}' deleted successfully.`);

    } catch (error) {
        console.error("❌ Error deleting knowledge source:", error);
        throw error;
    }
}

async function continueConversation(
    credential: DefaultAzureCredential,
    openAIClient: AzureOpenAI,
    messages: KnowledgeAgentMessage[]
): Promise<void> {
    console.log("\n💬 === Continuing Conversation ===");

    // Add follow-up question
    const followUpQuestion = "How do I find lava at night?";
    console.log(`❓ Follow-up question: ${followUpQuestion}`);

    messages.push({
        role: "user",
        content: followUpQuestion
    });

    try {
        // Don't include system messages in this retrieval
        const userAssistantMessages = messages.filter((m: KnowledgeAgentMessage) => m.role !== "system");
        const newRetrievalResponse = await callAgenticRetrieval(credential, userAssistantMessages);

        // Extract assistant response and add to conversation
        let assistantContent = '';
        if (typeof newRetrievalResponse.response === 'string') {
            assistantContent = newRetrievalResponse.response;
        } else if (Array.isArray(newRetrievalResponse.response)) {
            assistantContent = JSON.stringify(newRetrievalResponse.response);
        }

        // Add assistant response to conversation history
        messages.push({
            role: "assistant",
            content: assistantContent
        });

        console.log(assistantContent);

        // Log activities and results like the first retrieval
        console.log("\nActivities:");
        if (newRetrievalResponse.activity && Array.isArray(newRetrievalResponse.activity)) {
            newRetrievalResponse.activity.forEach((activity) => {
                const activityType = activity.activityType || activity.type || 'UnknownActivityRecord';
                console.log(`Activity Type: ${activityType}`);
                console.log(JSON.stringify(activity, null, 2));
            });
        }

        console.log("Results");
        if (newRetrievalResponse.references && Array.isArray(newRetrievalResponse.references)) {
            newRetrievalResponse.references.forEach((reference) => {
                const referenceType = reference.referenceType || reference.type || 'AzureSearchDoc';
                console.log(`Reference Type: ${referenceType}`);
                console.log(JSON.stringify(reference, null, 2));
            });
        }

        // Generate final answer for follow-up
        await generateFinalAnswer(openAIClient, messages);

        console.log("\n🎉 === Conversation Complete ===");

    } catch (error) {
        console.error("❌ Error in conversation continuation:", error);
        throw error;
    }
}

async function getAccessToken(credential: DefaultAzureCredential, scope: string): Promise<string> {
    const tokenResponse = await credential.getToken(scope);
    return tokenResponse.token;
}

// Error handling wrapper
async function runWithErrorHandling(): Promise<void> {
    try {
        await main();
    } catch (error) {
        console.error("💥 Application failed:", error);
        process.exit(1);
    }
}

// Execute the application - ES module style
runWithErrorHandling();

export {
    main,
    createSearchIndex,
    deleteSearchIndex,
    fetchEarthAtNightDocuments,
    uploadDocuments,
    createKnowledgeSource,
    createKnowledgeBase,
    deleteKnowledgeBase,
    deleteKnowledgeSource,
    runAgenticRetrieval,
    EarthAtNightDocument,
    KnowledgeAgentMessage,
    AgenticRetrievalResponse
};