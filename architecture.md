# Architecture Diagram

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'fontSize':'16px', 'background':'#F5F5F5'}}}%%
graph LR
    subgraph Azure["Azure Subscription"]
        subgraph RG["Resource Group"]
            MI[Managed Identity<br/>User-Assigned]
            
            subgraph Search["Azure AI Search"]
                Index[Search Index]
                KS[Knowledge Source]
                KB[Knowledge Base]
            end
            
            subgraph Foundry["Foundry - AI Project"]
                Services[AI Services]
                GPT[gpt-5-mini]
                Embed[text-embedding-3-large]
            end
            
            MI -->|Authenticates| Search
            MI -->|Authenticates| Foundry
            Search -->|Uses Models| Foundry
        end
    end
    
    App[TypeScript Application<br/>Agentic Retrieval] -->|Queries| Search
    App -->|Uses Identity| MI

    style Azure fill:#0078D4,stroke:#004578,color:#fff
    style RG fill:#0078D4,stroke:#004578,color:#fff
    style Search fill:#50E6FF,stroke:#0078D4,color:#000
    style Foundry fill:#00BCF2,stroke:#0078D4,color:#000
    style MI fill:#FFB900,stroke:#D83B01,color:#000
    style App fill:#E5E5E5,stroke:#605E5C,color:#000
```

## Components

- **Azure AI Search**: Vector search with semantic capabilities, knowledge base management
- **Azure AI Foundry**: AI project hosting GPT and embedding models  
- **Managed Identity**: Secure authentication between services
- **TypeScript App**: Agentic retrieval application using knowledge bases
