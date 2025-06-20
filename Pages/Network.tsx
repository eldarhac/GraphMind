// @ts-nocheck
import { useState, useEffect, type ChangeEvent } from "react";
import { Person, Connection } from "@/Entities/all";
import GraphCanvas from "../Components/graph/GraphCanvas";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Search, Filter, Users, Network as NetworkIcon } from "lucide-react";

const connectionColors = {
  colleague: '#22c55e',
  coauthor: '#f59e0b',
  collaborator: '#60a5fa',
  advisor: '#a855f7',
  mentee: '#c084fc',
  attendee: '#6b7280',
  speaker: '#ec4899',
  organizer: '#f97316'
};

export default function NetworkPage() {
  const [graphData, setGraphData] = useState({ nodes: [], connections: [] });
  const [filteredData, setFilteredData] = useState({ nodes: [], connections: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGraphData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [graphData, searchTerm, filterType]);

  const loadGraphData = async () => {
    setIsLoading(true);
    try {
      const [nodes, connections] = await Promise.all([
        Person.list(),
        Promise.resolve([]) // Temporarily disable loading connections from mock data
      ]);
      
      setGraphData({ nodes, connections });
    } catch (error) {
      console.error('Error loading graph data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filteredNodes = graphData.nodes;
    let filteredConnections = graphData.connections;

    // Apply search filter
    if (searchTerm) {
      filteredNodes = filteredNodes.filter(node =>
        node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.institution?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.expertise_areas?.some(area => 
          area.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filteredConnections = filteredConnections.filter(conn =>
        conn.connection_type === filterType
      );
      
      // Only show nodes that have connections of the filtered type
      const connectedNodeIds = new Set();
      filteredConnections.forEach(conn => {
        connectedNodeIds.add(conn.person_a_id);
        connectedNodeIds.add(conn.person_b_id);
      });
      
      filteredNodes = filteredNodes.filter(node =>
        connectedNodeIds.has(node.id)
      );
    }

    setFilteredData({ nodes: filteredNodes, connections: filteredConnections });
  };

  const handleNodeClick = (nodeId) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    setSelectedNode(node);
  };

  const getNodeStats = (nodeId) => {
    const connections = graphData.connections.filter(conn =>
      conn.person_a_id === nodeId || conn.person_b_id === nodeId
    );
    
    return {
      totalConnections: connections.length,
      connectionTypes: [...new Set(connections.map(c => c.connection_type))],
      averageStrength: connections.reduce((sum, c) => sum + c.strength, 0) / connections.length || 0
    };
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-white mb-2">Loading Network</p>
          <p className="text-slate-400">Analyzing connections and relationships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-6">
      {/* Header Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Network Explorer</h1>
            <p className="text-slate-400">
              Visualizing {filteredData.nodes.length} people and {filteredData.connections.length} connections
            </p>
          </div>
          <Button
            onClick={loadGraphData}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            <NetworkIcon className="w-4 h-4 mr-2" />
            Refresh Network
          </Button>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search people, institutions, or expertise areas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-400"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700/50 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by connection type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Connections</SelectItem>
              <SelectItem value="colleague">Colleagues</SelectItem>
              <SelectItem value="coauthor">Co-authors</SelectItem>
              <SelectItem value="collaborator">Collaborators</SelectItem>
              <SelectItem value="advisor">Advisors</SelectItem>
              <SelectItem value="mentee">Mentees</SelectItem>
              <SelectItem value="attendee">Event Attendees</SelectItem>
              <SelectItem value="speaker">Speakers</SelectItem>
              <SelectItem value="organizer">Organizers</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Graph Canvas */}
        <div className="flex-1 h-full min-w-0">
          <GraphCanvas
            nodes={filteredData.nodes}
            connections={filteredData.connections}
            highlightedNodes={selectedNode ? [selectedNode.id] : []}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Side Panel - Node Details */}
        <div className="w-80 h-full flex flex-col p-6 border-l border-slate-700/50 glass-effect">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Network Details</h2>
            <p className="text-slate-400 text-sm">Click on nodes to explore connections</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {selectedNode ? (
              <div className="space-y-6">
                {/* Person Profile */}
                <div className="glass-effect rounded-2xl p-6 border border-slate-700/50">
                  <div className="flex items-start gap-4 mb-4">
                    {selectedNode.profile_image ? (
                      <img
                        src={selectedNode.profile_image}
                        alt={selectedNode.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{selectedNode.name}</h3>
                      <p className="text-slate-300 text-sm">{selectedNode.title}</p>
                      <p className="text-slate-400 text-sm">{selectedNode.institution}</p>
                    </div>
                  </div>

                  {selectedNode.bio && (
                    <p className="text-slate-300 text-sm mb-4">{selectedNode.bio}</p>
                  )}

                  {selectedNode.expertise_areas && selectedNode.expertise_areas.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Expertise</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedNode.expertise_areas.map((area, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Connection Stats */}
                <div className="glass-effect rounded-2xl p-6 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-4">Connection Statistics</h4>
                  {(() => {
                    const stats = getNodeStats(selectedNode.id);
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Total Connections</span>
                          <span className="text-white font-medium">{stats.totalConnections}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Avg. Strength</span>
                          <span className="text-white font-medium">
                            {stats.averageStrength.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Connection Types</span>
                          <span className="text-white font-medium">{stats.connectionTypes.length}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-medium">Select a Node</p>
                    <p className="text-slate-500 text-sm">Click on any person in the network to view their details and connections</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Connection Legend */}
          <div className="mt-auto pt-6 border-t border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Connection Legend</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(connectionColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-xs text-slate-400 capitalize">{type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
