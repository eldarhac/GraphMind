import React, { useState, useEffect, useRef } from "react";
import { Person, Connection, ChatMessage } from "@/Entities/all";
import { getHybridGraphData } from "@/services/hybridDataService";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MessageBubble from "@/Components/chat/MessageBubble";
import ChatInput from "@/Components/chat/ChatInput";
import GraphCanvas from "@/Components/graph/GraphCanvas";
import QueryProcessor from "@/Components/analytics/QueryProcessor";
import { Mention } from "@/types/mentions";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Person[], connections: Connection[] }>({ nodes: [], connections: [] });
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedConnections, setHighlightedConnections] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<Person | null>(null);
  const [graphPanelWidth, setGraphPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [pendingMention, setPendingMention] = useState<Mention | null>(null);
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
      const { nodes, connections } = await getHybridGraphData();

      setGraphData({ nodes, connections });
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

Try asking: "How am I connected to Dr. Smith?" or "Who are the top AI researchers?"
Click on any person in the graph to mention them in your message!`,
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

    if (messageText.trim().toLowerCase() === 'clear highlights') {
      clearHighlights();
      return;
    }

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
        graphData,
        messages
      );

      let assistantText = result.response;
      if (
        result.intent === 'select_node' &&
        result.entities &&
        result.entities.length > 0 &&
        (!result.graphAction || !result.graphAction.node_ids || result.graphAction.node_ids.length === 0)
      ) {
        assistantText = `I've searched the network, but I could not find anyone matching the name '${result.entities.join(', ')}'.`;
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: assistantText,
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
        setHighlightedNodeIds(action.node_ids || []);
        setHighlightedConnections(action.connection_ids || []);
        break;
      
      case 'zoom_to':
        // Zoom functionality would be implemented in GraphCanvas
        setHighlightedNodeIds(action.node_ids || []);
        break;
      
      default:
        break;
    }
  };

  const clearHighlights = () => {
    setHighlightedNodeIds([]);
    setHighlightedConnections([]);
  };

  const handleNodeClick = (nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      // Set pending mention to be inserted at cursor position
      const mention: Mention = {
        id: nodeId,
        name: node.name
      };
      
      setPendingMention(mention);
    }
  };

  const handleMentionInserted = () => {
    // Clear the pending mention after it's been inserted
    setPendingMention(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = (e.clientX / window.innerWidth) * 100;
      const clampedWidth = Math.max(20, Math.min(80, newWidth));
      setGraphPanelWidth(100 - clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const toggleGraphPanel = () => {
    setGraphPanelWidth(prev => prev === 20 ? 50 : 20);
  };

  return (
    <div className="h-screen flex">
      {/* Chat Panel */}
      <div className="flex flex-col" style={{ width: `${100 - graphPanelWidth}%` }}>
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
            pendingMention={pendingMention}
            onMentionInserted={handleMentionInserted}
          />
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 bg-slate-700/50 hover:bg-slate-600 cursor-col-resize flex items-center justify-center group transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="w-4 h-12 bg-slate-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {graphPanelWidth > 40 ? (
            <ChevronRight className="w-3 h-3 text-slate-300" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-slate-300" />
          )}
        </div>
      </div>

      {/* Graph Panel */}
      <div className="p-6 flex flex-col" style={{ width: `${graphPanelWidth}%` }}>
        {/* Graph Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleGraphPanel}
              className="p-1 rounded hover:bg-slate-800/50 transition-colors"
              title={graphPanelWidth === 20 ? "Expand panel" : "Collapse panel"}
            >
              {graphPanelWidth === 20 ? (
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">Network Visualization</h2>
              <p className="text-sm text-slate-400">Click nodes to mention people</p>
            </div>
          </div>
          {(highlightedNodeIds.length > 0 || highlightedConnections.length > 0) && (
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
            highlightedNodeIds={highlightedNodeIds}
            highlightedConnections={highlightedConnections}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    </div>
  );
}
