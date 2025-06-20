import React, { useState, useEffect } from "react";
import { User } from "@/Entities/User";
import { Person, Connection } from "@/Entities/all";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { User as UserIcon, Save, Settings, Network, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; full_name?: string; role?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Person | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  interface ProfileFormData {
    name: string;
    title: string;
    institution: string;
    bio: string;
    expertise_areas: string[];
    linkedin_url: string;
  }

  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    title: '',
    institution: '',
    bio: '',
    expertise_areas: [],
    linkedin_url: ''
  });
  const [newExpertise, setNewExpertise] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Try to find user's profile in Person entity
      const people = await Person.list();
      const profile = people.find((p: Person) => p.email === user.email);
      
      if (profile) {
        setUserProfile(profile);
        setFormData({
          name: profile.name || user.full_name || '',
          title: profile.title || '',
          institution: profile.institution || '',
          bio: profile.bio || '',
          expertise_areas: profile.expertise_areas || [],
          linkedin_url: profile.linkedin_url || ''
        });

        // Load user's connections
        const allConnections = await Connection.list();
        const userConnections = allConnections.filter((conn: Connection) =>
          conn.person_a_id === profile.id || conn.person_b_id === profile.id
        );
        setConnections(userConnections);
      } else {
        // Initialize with user data if no profile exists
        setFormData((prev: ProfileFormData) => ({
          ...prev,
          name: user.full_name || ''
        }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev: ProfileFormData) => ({
      ...prev,
      [field]: value
    }));
  };

  const addExpertise = () => {
    if (newExpertise.trim() && !formData.expertise_areas.includes(newExpertise.trim())) {
      setFormData((prev: ProfileFormData) => ({
        ...prev,
        expertise_areas: [...prev.expertise_areas, newExpertise.trim()]
      }));
      setNewExpertise('');
    }
  };

  const removeExpertise = (expertise: string) => {
    setFormData((prev: ProfileFormData) => ({
      ...prev,
      expertise_areas: prev.expertise_areas.filter(e => e !== expertise)
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const profileData = {
        ...formData,
        email: currentUser?.email || ''
      };

      if (userProfile) {
        // Update existing profile
        await Person.update(userProfile.id, profileData);
      } else {
        // Create new profile
        await Person.create(profileData);
      }

      await loadUserData(); // Reload to get updated data
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getNetworkStats = () => {
    if (!userProfile || !connections.length) {
      return { totalConnections: 0, strongConnections: 0, connectionTypes: 0 };
    }

    const strongConnections = connections.filter((conn: Connection) => conn.strength >= 7).length;
    const connectionTypes = [...new Set(connections.map((c: Connection) => c.connection_type))].length;

    return {
      totalConnections: connections.length,
      strongConnections,
      connectionTypes
    };
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-white mb-2">Loading Profile</p>
          <p className="text-slate-400">Setting up your network identity...</p>
        </div>
      </div>
    );
  }

  const stats = getNetworkStats();

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-slate-400">Manage your network presence and professional identity</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Form */}
          <div className="lg:col-span-2">
            <Card className="glass-effect border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="w-5 h-5" />
                  Professional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Full Name
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('name', e.target.value)
                        }
                        className="bg-slate-800/50 border-slate-700/50 text-white"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Professional Title
                      </label>
                      <Input
                        value={formData.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('title', e.target.value)
                        }
                        className="bg-slate-800/50 border-slate-700/50 text-white"
                        placeholder="e.g., Senior Data Scientist"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Institution/Company
                    </label>
                    <Input
                      value={formData.institution}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('institution', e.target.value)
                      }
                      className="bg-slate-800/50 border-slate-700/50 text-white"
                      placeholder="Current workplace"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Professional Bio
                    </label>
                    <Textarea
                      value={formData.bio}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleInputChange('bio', e.target.value)
                      }
                      className="bg-slate-800/50 border-slate-700/50 text-white h-24"
                      placeholder="Brief description of your work and interests..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      LinkedIn Profile
                    </label>
                    <Input
                      value={formData.linkedin_url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('linkedin_url', e.target.value)
                      }
                      className="bg-slate-800/50 border-slate-700/50 text-white"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>

                  {/* Expertise Areas */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Areas of Expertise
                    </label>
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={newExpertise}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNewExpertise(e.target.value)
                        }
                        className="bg-slate-800/50 border-slate-700/50 text-white"
                        placeholder="Add an expertise area..."
                        onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                          e.key === 'Enter' && (e.preventDefault(), addExpertise())
                        }
                      />
                      <Button
                        type="button"
                        onClick={addExpertise}
                        variant="outline"
                        className="border-slate-700/50 text-slate-300 hover:text-white"
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.expertise_areas.map((area: string, index: number) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-blue-500/20 text-blue-300 border-blue-500/30 cursor-pointer hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30"
                          onClick={() => removeExpertise(area)}
                        >
                          {area} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Profile Summary & Stats */}
          <div className="space-y-6">
            {/* Profile Preview */}
            <Card className="glass-effect border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <UserIcon className="w-5 h-5" />
                  Profile Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {formData.name || 'Your Name'}
                </h3>
                <p className="text-slate-300 text-sm mb-1">
                  {formData.title || 'Your Title'}
                </p>
                <p className="text-slate-400 text-xs">
                  {formData.institution || 'Your Institution'}
                </p>
                
                {currentUser && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <p className="text-slate-400 text-xs">{currentUser.email}</p>
                    <Badge
                      variant="outline"
                      className="mt-2 border-slate-600/50 text-slate-400"
                    >
                      {currentUser.role}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Network Stats */}
            <Card className="glass-effect border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BarChart3 className="w-5 h-5" />
                  Network Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total Connections</span>
                  <span className="text-blue-400 font-bold">{stats.totalConnections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Strong Connections</span>
                  <span className="text-indigo-400 font-bold">{stats.strongConnections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Connection Types</span>
                  <span className="text-purple-400 font-bold">{stats.connectionTypes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Expertise Areas</span>
                  <span className="text-pink-400 font-bold">{formData.expertise_areas.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}