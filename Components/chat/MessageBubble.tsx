import { motion } from 'framer-motion';
import { User, Sparkles, Clock } from 'lucide-react';
import { format, isValid } from 'date-fns';

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  timestamp: Date | string;
  processingTime?: number;
}

export default function MessageBubble({ message, isUser, timestamp, processingTime }: MessageBubbleProps) {
  const displayTime = timestamp && isValid(new Date(timestamp))
    ? format(new Date(timestamp), 'HH:mm')
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-6`}
    >
      {/* Avatar */}
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
        ${isUser
          ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
          : 'bg-gradient-to-r from-purple-500 to-pink-600'
        }
      `}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`max-w-2xl ${isUser ? 'text-right' : 'text-left'} space-y-1`}>
        <div className={`
          inline-block px-6 py-4 rounded-2xl glass-effect border
          ${isUser
            ? 'bg-gradient-to-r from-blue-500/20 to-indigo-600/20 border-blue-500/30'
            : 'bg-slate-800/50 border-slate-700/50'
          }
        `}>
          <p className="text-white leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        
        {/* Metadata */}
        <div className={`flex items-center gap-2 text-xs text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <Clock className="w-3 h-3" />
          <span>{displayTime}</span>
          {processingTime && !isUser && (
            <>
              <span>•</span>
              <span>{processingTime}ms</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}