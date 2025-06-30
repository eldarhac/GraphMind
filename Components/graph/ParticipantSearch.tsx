import React, { useState, useEffect } from 'react';
import { Input } from '@/Components/ui/input';

interface Participant {
  id: string;
  name: string;
}

interface ParticipantSearchProps {
  participantList: Participant[];
  onParticipantSelect: (participant: Participant) => void;
}

const ParticipantSearch: React.FC<ParticipantSearchProps> = ({ participantList, onParticipantSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      const filtered = participantList.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredParticipants(filtered);
      setIsDropdownVisible(true);
    } else {
      setFilteredParticipants([]);
      setIsDropdownVisible(false);
    }
  }, [searchTerm, participantList]);

  const handleSelect = (participant: Participant) => {
    onParticipantSelect(participant);
    setSearchTerm('');
    setIsDropdownVisible(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredParticipants.length > 0) {
      handleSelect(filteredParticipants[0]);
    }
  };

  return (
    <div className="relative w-full">
      <Input
        type="text"
        placeholder="Search for a participant..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsDropdownVisible(searchTerm.length > 0)}
        onBlur={() => setTimeout(() => setIsDropdownVisible(false), 100)}
        className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-white"
      />
      {isDropdownVisible && filteredParticipants.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg">
          <ul className="max-h-60 overflow-auto">
            {filteredParticipants.map(p => (
              <li
                key={p.id}
                className="px-4 py-2 text-white cursor-pointer hover:bg-slate-700"
                onMouseDown={() => handleSelect(p)}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ParticipantSearch; 