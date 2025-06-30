# GraphMind: Intelligent Network Assistant

GraphMind is a smart, graph-based chat assistant designed to help users explore and understand complex networks of people. Leveraging a powerful Large Language Model (LLM), users can ask questions in natural language to uncover connections, identify key influencers, and gain insights into the relationships within their data.

This project was built from the ground up, starting with a collection of React components and evolving into a fully functional, AI-powered application.

## Core Features

-   **Natural Language Queries:** Ask complex questions in plain English (e.g., "Find a path from me to Dr. Li").
-   **Intelligent Entity Recognition:** The system uses an LLM to perform fuzzy matching, correcting user typos and mapping queries to the entities within the graph data.
-   **Advanced Graph Algorithms:** Implements Breadth-First Search (BFS) for efficient, accurate pathfinding between nodes.
-   **Interactive Graph Visualization:** A dynamic, canvas-based graph visualization that allows users to explore the network, with highlighting for paths and nodes.
-   **Real-time AI Integration:** Connects to the OpenAI API to process user queries and generate responses.
-   **@Mention Handling:** Queries may include names prefixed with `@`. These symbols MUST BE removed before
    the AI analyzes the text so entity extraction works reliably.
-   **Onboarding Assistance:** Provides users with clickable prompt suggestions to showcase the assistant's capabilities.
-   **Modern, Type-Safe Codebase:** Built with TypeScript, Vite, and React, ensuring the code is robust, maintainable, and performant.

## Tech Stack

-   **Frontend:** React, Vite, Tailwind CSS
-   **Language:** TypeScript
-   **AI:** OpenAI API (gpt-4-turbo)
-   **State Management:** React Hooks (`useState`, `useEffect`, etc.)
-   **Routing:** React Router
-   **UI Components:** Custom components, inspired by shadcn/ui
-   **Animation:** Framer Motion

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   Node.js (v18 or later)
-   npm

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/graphmind.git
    cd graphmind
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up your environment variables:**
    -   Create a new file named `.env` in the root of the project.
    -   Add your OpenAI API key to this file:
        ```
        VITE_OPENAI_API_KEY="YOUR_API_KEY_HERE"
        ```

4.  **Run the development server:**
    ```sh
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

## Project Structure

The project is organized into several key directories:

-   `src/`
    -   `Components/`: Contains reusable React components.
        -   `analytics/`: Core logic for query processing and graph algorithms.
        -   `chat/`: Components for the chat interface (`ChatInput`, `MessageBubble`).
        -   `graph/`: The `GraphCanvas` visualization component.
        -   `ui/`: Base UI elements like `Button`, `Card`, etc.
    -   `Entities/`: Data models and mock data (`Person.json`, `Connection.json`).
    -   `integrations/`: Modules for connecting to external services.
        -   `invoke-llm/`: The complete client-side simulation of the LLM invocation system, including the OpenAI API connection.
    -   `Pages/`: Top-level page components for different routes (`Chat`, `Network`, etc.).
-   `.env`: Stores environment variables (not checked into git).
-   `README.md`: This file.
-   `package.json`: Project dependencies and scripts.
-   `vite.config.js`: Vite configuration.
-   `tsconfig.json`: TypeScript configuration.

## Graph Intelligence Agent

GraphMind now includes a LangChain-powered agent that can analyze your Neo4j database. It supports two modes:

1. **Cypher Pathfinding** – Uses Neo4j's `shortestPath` to explain how two people are directly connected.
2. **Inference Engine** – Leverages vector embeddings stored in Neo4j to suggest potential relationships based on semantic similarity.

Try questions like:

```text
Show me the shortest path between Alice Doe and Bob Smith.
Are there any potential connections between Scott Harris and Jennifer Smith based on their careers?
```

---

This README provides a comprehensive overview of the GraphMind project. 