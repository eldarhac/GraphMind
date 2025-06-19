import React, { useState, useEffect } from "react";
import { Person, Connection } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Plus, ExternalLink, Network } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [connections, setConnections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [peopleData, connectionsData] = await Promise.all([
        Person.list('-updated_date'),
        Connection.list()
      ]);
      setPeople(peopleData);
      setConnections(connectionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPeople = people.filter(person =>
    person.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.institution?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.expertise_areas?.some(area => 
      area.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getPersonConnections = (personId) => {
    return connections.filter(conn =>
      conn.person_a_id === personId || conn.person_b_id === personId
    );
  };

  const getConnectionCount = (personId) => {
    return getPersonConnections(personId).length;
  };

  const getInfluenceScore = (person) => {
    const connectionCount = getConnectionCount(person.id);
    const expertiseBonus = person.expertise_areas?.length || 0;
    return Math.round((connectionCount * 10) + (expertiseBonus * 5));
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-white mb-2">Loading Directory</p>
          <p className="text-slate-400">Gathering network profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">People Directory</h1>
              <p className="text-slate-400">
                Explore {people.length} professionals in your network
              </p>
            </div>
            <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Person
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, title, institution, or expertise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-400"
            />
          </div>
        </div>

        {/* People Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredPeople.map((person, index) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass-effect border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      {person.profile_image ? (
                        <img
                          src={person.profile_image}
                          alt={person.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg truncate group-hover:text-blue-400 transition-colors">
                          {person.name}
                        </h3>
                        <p className="text-slate-300 text-sm truncate">{person.title}</p>
                        <p className="text-slate-400 text-xs truncate">{person.institution}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Expertise Areas */}
                    {person.expertise_areas && person.expertise_areas.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {person.expertise_areas.slice(0, 3).map((area, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs"
                            >
                              {area}
                            </Badge>
                          ))}
                          {person.expertise_areas.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="bg-slate-700/50 text-slate-400 border-slate-600/50 text-xs"
                            >
                              +{person.expertise_areas.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Network className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">{getConnectionCount(person.id)}</span>
                          <span className="text-slate-500">connections</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Influence:</span>
                        <span className="text-sm font-medium text-blue-400">
                          {getInfluenceScore(person)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700/50"
                        onClick={() => setSelectedPerson(person)}
                      >
                        View Profile
                      </Button>
                      {person.linkedin_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-white"
                          asChild
                        >
                          <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredPeople.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-xl font-semibold text-slate-300 mb-2">No People Found</p>
            <p className="text-slate-500">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "No people have been added to the network yet"
              }
            </p>
          </div>
        )}

        {/* Stats Summary */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-effect border-slate-700/50">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">{people.length}</div>
              <div className="text-sm text-slate-400">Total People</div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-slate-700/50">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-indigo-400 mb-1">{connections.length}</div>
              <div className="text-sm text-slate-400">Total Connections</div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-slate-700/50">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {[...new Set(people.flatMap(p => p.expertise_areas || []))].length}
              </div>
              <div className="text-sm text-slate-400">Expertise Areas</div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-slate-700/50">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-pink-400 mb-1">
                {[...new Set(people.map(p => p.institution).filter(Boolean))].length}
              </div>
              <div className="text-sm text-slate-400">Institutions</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}