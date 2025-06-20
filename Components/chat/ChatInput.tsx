import React, { useState } from 'react';
import { Send, Loader } from 'lucide-react';
import { Button } from '@/Components/ui/button';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
}

export default function ChatInput({ onSendMessage, isProcessing }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');

  const suggestions = [
    "Find path from me to Dr. Li",
    "Who are the top AI researchers?",
    "Show me people similar to Dr. Evelyn Reed",
    "Who is a bridge between Quantum Computing and Robotics?",
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about your network..."
          className="flex-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !inputValue.trim()}
          className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-blue-600 hover:to-indigo-700"
        >
          {isProcessing ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
      
      {/* Prompt Suggestions */}
      {inputValue.length === 0 && !isProcessing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((item, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleSuggestionClick(item)}
              className="text-slate-300 border-slate-700/50 hover:bg-slate-800/50 hover:text-white"
            >
              {item}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}