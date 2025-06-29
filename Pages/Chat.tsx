import React, { useState, useEffect, useRef, useMemo } from "react";
import { Person, Connection, ChatMessage } from "@/Entities/all";
import { getHybridGraphData } from "@/services/hybridDataService";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MessageBubble from "@/Components/chat/MessageBubble";
import ChatInput from "@/Components/chat/ChatInput";
import GraphCanvas from "@/Components/graph/GraphCanvas";
import QueryProcessor, { generateBioSummary } from "@/Components/analytics/QueryProcessor";
import { Mention } from "@/types/mentions";
import { supabaseClient } from "@/integrations/supabase-client";

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
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [bioSummary, setBioSummary] = useState({ isLoading: false, content: '' });

  const connectionStats = useMemo(() => {
    if (!selectedPerson) return { count: 0, types: 0 };

    const nodeConnections = graphData.connections.filter(conn =>
        conn.person_a_id === selectedPerson.id || conn.person_b_id === selectedPerson.id
    );

    const connectionTypes = new Set(nodeConnections.map(c => c.connection_type).filter(t => t === 'WORK' || t === 'STUDY'));

    return {
        count: nodeConnections.length,
        types: connectionTypes.size
    };
  }, [selectedPerson, graphData.connections]);

  useEffect(() => {
    loadInitialData();
    addWelcomeMessage();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedPerson?.id) {
      setBioSummary({ isLoading: true, content: '' });

      supabaseClient.getParticipantById(selectedPerson.id).then(fullPersonDetails => {
        // Ensure the user is still selected and matches the fetched details to prevent race conditions.
        if (fullPersonDetails && selectedPerson?.id === fullPersonDetails.id) {
          // Update the state with the full details, which will re-render the card with correct title, etc.
          setSelectedPerson(fullPersonDetails);

          // Now, generate the summary with the complete data.
          generateBioSummary({
            name: fullPersonDetails.name,
            experience: fullPersonDetails.experience || [],
            education: fullPersonDetails.education || [],
          }).then(summary => {
            // A final check for race conditions before setting the final state.
            if (selectedPerson?.id === fullPersonDetails.id) {
              setBioSummary({ isLoading: false, content: summary });
            }
          });
        } else if (selectedPerson?.id) {
          // Handle cases where details for a selected user couldn't be fetched.
          setBioSummary({
            isLoading: false,
            content: `Could not load complete details for ${selectedPerson.name}.`,
          });
        }
      });
    }
  }, [selectedPerson?.id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { nodes, connections } = await getHybridGraphData();

      setGraphData({ nodes, connections });

      // Find and set "Matthew Smith" as the current user
      const matthewSmith = nodes.find(node => node.id === "eldar-refael-hacohen-58b4b018a" || node.name === "Matthew Smith");

      if (matthewSmith) {
        setCurrentUser(matthewSmith);
      } else if (nodes.length > 0) {
        console.warn("Matthew Smith not found, falling back to first user.");
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
        setHighlightedConnections([]);
        break;
      
      default:
        break;
    }
  };

  const clearHighlights = () => {
    setHighlightedNodeIds([]);
    setHighlightedConnections([]);
  };

  const handleNodeMention = (nodeId: string) => {
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

  const handleMention = (person: Person) => {
    if (!person) return;
    const mention: Mention = {
      id: person.id,
      name: person.name
    };
    setPendingMention(mention);
  };

  const handleMentionInserted = () => {
    // Clear the pending mention after it's been inserted
    setPendingMention(null);
  };

  const handleMouseDown = (e: any) => {
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
      <div className="flex flex-col relative" style={{ width: `${graphPanelWidth}%` }}>
        {/* Header */}
        <div className="p-6 border-b border-l border-slate-700/50 glass-effect">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Network Graph</h1>
            <button onClick={toggleGraphPanel} className="text-slate-400 hover:text-white">
              {graphPanelWidth > 25 ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>
        
        {/* Canvas */}
        <div className="flex-1 min-h-0 relative">
          <AnimatePresence>
            {graphPanelWidth > 0 && (
              <motion.div 
                className="w-full h-full bg-slate-900"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <GraphCanvas
                  nodes={graphData.nodes}
                  connections={graphData.connections}
                  highlightedNodeIds={highlightedNodeIds}
                  highlightedConnections={highlightedConnections}
                  onNodeClick={(nodeId: string) => {
                    const node = graphData.nodes.find(n => n.id === nodeId);
                    setSelectedPerson(node || null);
                  }}
                  onBackgroundClick={() => setSelectedPerson(null)}
                  currentUser={currentUser}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {selectedPerson && (
            <div className="absolute top-20 right-8 w-80 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 animate-fade-in z-10">
              <button onClick={() => setSelectedPerson(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl">&times;</button>
      
              {/* --- SECTION 1: Person Header (Restored) --- */}
              <div className="flex items-center gap-4 mb-4">
                {/* Avatar Logic */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
                  {selectedPerson.profile_picture_url ? (
                    <img src={selectedPerson.profile_picture_url} alt={selectedPerson.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">{selectedPerson.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedPerson.name}</h3>
                  <p className="text-slate-300 text-sm">{selectedPerson.title}</p>
                </div>
              </div>
      
              {/* --- SECTION 2: Action Button (Restored) --- */}
              <button
                onClick={() => handleMention(selectedPerson)}
                className="w-full text-left px-3 py-2 mb-4 rounded-lg text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors flex items-center gap-2"
              >
                <span className="font-mono text-xl">@</span>
                <span>mention in chat</span>
              </button>
      
              {/* --- SECTION 3: AI Summary (Existing Feature) --- */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2 border-t border-slate-700/50 pt-4">AI-Generated Summary</h4>
                {bioSummary.isLoading ? (
                  <p className="text-slate-400 text-sm animate-pulse">Generating summary...</p>
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed">{bioSummary.content}</p>
                )}
              </div>

              {/* --- SECTION 4: Connection Stats (Merged) --- */}
              <div className="mt-4 border-t border-slate-700/50 pt-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Connection Statistics</h4>
                  <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                          <span className="text-slate-300">Total Connections</span>
                          <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">{connectionStats.count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-300">Avg. Strength</span>
                          <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">1.0/10</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-300">Connection Types</span>
                          <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">{connectionStats.types}</span>
                      </div>
                  </div>
              </div>
      
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
