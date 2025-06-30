import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Mention } from '@/types/mentions';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  pendingMention?: Mention | null;
  onMentionInserted?: () => void;
  showSuggestions?: boolean;
}

export default function ChatInput({ 
  onSendMessage, 
  isProcessing, 
  pendingMention,
  onMentionInserted,
  showSuggestions = true
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const suggestions = [
    "How can I reach Jeff Bezos?",
    "Who are the top AI researchers?",
    "Show me people similar to Dr. Musk",
    "Who is currently working at Google?"
  ];

  // Insert mention at cursor position when a new mention is pending
  useEffect(() => {
    if (pendingMention && inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      
      // Insert the mention at cursor position (with @ symbol)
      const mentionText = `@${pendingMention.name}`;
      const newValue = inputValue.slice(0, start) + mentionText + inputValue.slice(end);
      
      setInputValue(newValue);
      
      // Set cursor position after the mention
      const newCursorPos = start + mentionText.length;
      setTimeout(() => {
        if (input) {
          input.setSelectionRange(newCursorPos, newCursorPos);
          input.focus();
        }
      }, 0);
      
      onMentionInserted?.();
    }
  }, [pendingMention]);

  useEffect(() => {
    if (inputRef.current) {
      const textarea = inputRef.current;
      textarea.style.height = 'auto';

      const computed = getComputedStyle(textarea);
      const lineHeight = parseFloat(computed.lineHeight) || (parseFloat(computed.fontSize) * 1.5);
      const paddingTop = parseFloat(computed.paddingTop);
      const paddingBottom = parseFloat(computed.paddingBottom);

      const maxHeight = (5 * lineHeight) + paddingTop + paddingBottom;

      if (textarea.scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [inputValue]);

  const handleSuggestionClick = (text: string) => {
    setInputValue(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submitMessage = () => {
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };
  
  const handleClick = () => {
    // Update cursor position when clicking in the input
    setTimeout(() => {
      if (inputRef.current) {
        setCursorPosition(inputRef.current.selectionStart || 0);
      }
    }, 0);
  };

  // Render input with mentions highlighted (now with @ symbol)
  const renderInputContent = () => {
    const mentionRegex = /@([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(inputValue)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: inputValue.slice(lastIndex, match.index)
        });
      }
      
      // Add mention (names that start with @)
      parts.push({
        type: 'mention',
        content: match[0]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < inputValue.length) {
      parts.push({
        type: 'text',
        content: inputValue.slice(lastIndex)
      });
    }

    return parts;
  };

  const suggestionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
      },
    }),
  };

  return (
    <div className="w-full relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitMessage();
        }}
        className="flex items-center gap-3 w-full"
      >
        <div className="flex-1 relative">
          {/* Background container */}
          <div className="absolute inset-0 rounded-xl bg-muted-foreground/20 border border-slate-700/50 focus-within:ring-2 focus-within:ring-blue-500/50"></div>
          
          {/* Placeholder */}
          {!inputValue && (
            <div className="absolute inset-0 p-3 pointer-events-none text-slate-400">
              Ask about your network...
            </div>
          )}
          
          {/* Hidden styled content for visual representation */}
          <div className="absolute inset-0 p-3 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-white rounded-xl border border-transparent">
            {renderInputContent().map((part, index) => (
              <span
                key={index}
                className={part.type === 'mention' 
                  ? 'bg-blue-500/30 text-foreground px-1 rounded' 
                  : 'text-foreground'
                }
              >
                {part.content}
              </span>
            ))}
          </div>
          
          {/* Actual input */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
                return;
              }
              // Update cursor position for mention insertion
              setTimeout(() => {
                if (inputRef.current) {
                  setCursorPosition(inputRef.current.selectionStart || 0);
                }
              }, 0);
            }}
            onClick={handleClick}
            placeholder="Ask about your network..."
            className="w-full p-3 rounded-xl bg-transparent border-transparent text-transparent placeholder:text-muted-foreground focus:placeholder:text-transparent caret-foreground focus:outline-none relative z-10 resize-none"
            rows={1}
            disabled={isProcessing}
          />
        </div>
        
        <button
          type="submit"
          disabled={isProcessing || !inputValue.trim()}
          className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-blue-600 hover:to-indigo-700"
        >
          {isProcessing ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
      
      {/* Prompt Suggestions */}
      {showSuggestions && inputValue.length === 0 && !isProcessing && (
        <div className="absolute bottom-full mb-8 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              onClick={() => handleSuggestionClick(s)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              variants={suggestionVariants}
              initial="hidden"
              animate="visible"
              custom={i}
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}