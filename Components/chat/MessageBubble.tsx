import { motion } from "framer-motion";
import { formatDistanceToNow } from 'date-fns';
import { User, Sparkles } from 'lucide-react';

interface MessageBubbleProps {
    message: string;
    isUser: boolean;
    timestamp: Date;
    processingTime?: number;
}

export default function MessageBubble({ message, isUser, timestamp, processingTime }: MessageBubbleProps) {
    const bubbleClasses = isUser 
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-foreground";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                'bg-muted'
            }`}>
                {isUser 
                    ? <User className="w-6 h-6 text-muted-foreground" />
                    : <Sparkles className="w-6 h-6 text-muted-foreground" />
                }
            </div>

            {/* Message Content */}
            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`inline-block px-6 py-4 rounded-2xl max-w-2xl ${bubbleClasses}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{message}</p>
                </div>
                <div className="text-xs text-muted-foreground/70 mt-2 px-2">
                    {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                    {processingTime && ` (processed in ${processingTime.toFixed(2)}s)`}
                </div>
            </div>
        </motion.div>
    );
}