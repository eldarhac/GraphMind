import React, { useRef } from 'react';
import { X, User, AtSign } from 'lucide-react';
import { Person } from '@/Entities/all';

interface NetworkDetailsCardProps {
  node: Person;
  connectionsCount: number;
  connectionTypesCount: number;
  onClose: () => void;
  onMention: (nodeId: string) => void;
  position: { x: number; y: number };
  // containerSize is no longer used
}

const NetworkDetailsCard: React.FC<NetworkDetailsCardProps> = ({
  node,
  connectionsCount,
  connectionTypesCount,
  onClose,
  onMention,
  position,
}) => {
  if (!node) return null;

  const handleMentionClick = (e: any) => {
    e.stopPropagation(); // prevent graph background click
    onMention(node.id);
    onClose();
  };

  const handleCloseClick = (e: any) => {
    e.stopPropagation();
    onClose();
  };

  const handleContainerClick = (e: any) => {
    e.stopPropagation();
  }

  return (
    <div
      className="absolute bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 w-64 text-white shadow-lg"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, 20px)', // Center horizontally, and position below node
      }}
      onClick={handleContainerClick} // Prevent closing when clicking inside
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-md text-slate-200">Network Details</h3>
        <button onClick={handleCloseClick} className="text-slate-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-slate-700 p-2 rounded-full">
            <User size={18} className="text-slate-300" />
          </div>
          <p className="font-semibold text-base text-slate-100">{node.name}</p>
        </div>
        <button
          onClick={handleMentionClick}
          className="w-full text-left flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors py-2 px-2 rounded-md hover:bg-slate-700/50"
        >
          <AtSign size={16} />
          <span className="text-sm font-medium">@mention in chat</span>
        </button>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Connection Statistics</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Total Connections</span>
            <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">{connectionsCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Avg. Strength</span>
            <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">1.0/10</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Connection Types</span>
            <span className="font-mono font-bold text-white bg-slate-700/50 rounded px-2 py-0.5">{connectionTypesCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkDetailsCard; 