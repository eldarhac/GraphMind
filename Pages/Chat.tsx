import { useState, useEffect, useRef } from "react";
import { Person, Connection, ChatMessage } from "@/Entities/all";
import { supabaseClient } from "@/integrations/supabase-client";
import { transformSupabaseData } from "@/services/dataTransformer";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "@/Components/chat/MessageBubble";
import ChatInput from "@/Components/chat/ChatInput";
import GraphCanvas from "@/Components/graph/GraphCanvas";
import QueryProcessor from "@/Components/analytics/QueryProcessor";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Person[], connections: Connection[] }>({ nodes: [], connections: [] });
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedConnections, setHighlightedConnections] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<Person | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
    addWelcomeMessage();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [participants, connections, avatars] = await Promise.all([
        supabaseClient.getAllParticipants(),
        supabaseClient.getConnections(),
        supabaseClient.getAvatars(),
      ]);

      const { nodes, connections: links } = transformSupabaseData(
        participants || [],
        connections || [],
        avatars || []
      );

      setGraphData({ nodes, connections: links });
      if (nodes.length > 0) {
        setCurrentUser(nodes[0]);
      }
    } catch (error) {
      console.error('Error loading graph data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      message: `Welcome to GraphMind! 🧠✨

I'm your intelligent network assistant. I can help you:
• Find connections between people
• Discover influential figures in specific fields  
• Get personalized recommendations
• Identify similar professionals
• Explore network bridges and key connectors

Try asking: "How am I connected to Dr. Smith?" or "Who are the top AI researchers?"`,
      sender: 'assistant',
      timestamp: new Date(),
      query_type: 'general'
    };
    setMessages([welcomeMessage]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !currentUser) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      message: messageText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Process the query using our AI engine
      const result = await QueryProcessor.processQuery(
        messageText, 
        currentUser,
        graphData
      );

      // Create assistant response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: result.response,
        sender: 'assistant',
        timestamp: new Date(),
        query_type: result.intent,
        processing_time: result.processingTime
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Apply graph visualization action
      if (result.graphAction) {
        applyGraphAction(result.graphAction);
      }

      // Save to database
      await ChatMessage.create(userMessage);
      await ChatMessage.create(assistantMessage);

    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        sender: 'assistant',
        timestamp: new Date(),
        query_type: 'general'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyGraphAction = (action: any) => {
    if (!action) return;

    switch (action.type) {
      case 'highlight_path':
      case 'highlight_nodes':
        setHighlightedNodes(action.node_ids || []);
        setHighlightedConnections(action.connection_ids || []);
        break;
      
      case 'zoom_to':
        // Zoom functionality would be implemented in GraphCanvas
        setHighlightedNodes(action.node_ids || []);
        break;
      
      default:
        break;
    }
  };

  const clearHighlights = () => {
    setHighlightedNodes([]);
    setHighlightedConnections([]);
  };

  return (
    <div className="h-screen flex">
      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 glass-effect">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <h1 className="text-xl font-bold text-white">Network Assistant</h1>
              <p className="text-sm text-slate-400">
                Connected to {graphData.nodes.length} people, {graphData.connections.length} connections
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message.message}
                isUser={message.sender === 'user'}
                timestamp={message.timestamp}
                processingTime={message.processing_time}
              />
            ))}
          </AnimatePresence>
          
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>Analyzing network...</span>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-slate-700/50 glass-effect">
          <ChatInput 
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* Graph Panel */}
      <div className="w-1/2 p-6 flex flex-col">
        {/* Graph Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Network Visualization</h2>
            <p className="text-sm text-slate-400">Interactive graph exploration</p>
          </div>
          {(highlightedNodes.length > 0 || highlightedConnections.length > 0) && (
            <button
              onClick={clearHighlights}
              className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
            >
              Clear Highlights
            </button>
          )}
        </div>

        {/* Graph Canvas */}
        <div className="flex-1 min-h-0">
          <GraphCanvas
            nodes={graphData.nodes}
            connections={graphData.connections}
            highlightedNodes={highlightedNodes}
            highlightedConnections={highlightedConnections}
            onNodeClick={(nodeId: string) => {
              const node = graphData.nodes.find(n => n.id === nodeId);
              if (node) {
                handleSendMessage(`Tell me about ${node.name}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
