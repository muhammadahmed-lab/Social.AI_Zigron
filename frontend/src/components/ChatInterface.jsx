// ===========================================
// ChatInterface Component - Command Center HUD
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ThinkingIndicator from './shared/ThinkingIndicator';
import config from '../config';
import './ChatInterface.css';

const ChatInterface = ({ disabled = false }) => {
    const { user, refreshProfile, activeCompany } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const prevCompanyRef = useRef(null);

    // Persistence: Load on Mount
    useEffect(() => {
        const saved = localStorage.getItem(config.storage.chatHistory);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setMessages(parsed);
            } catch (e) {
                console.error('Persistence Error:', e);
            }
        }

        // Load draft message
        const savedDraft = localStorage.getItem('chatDraftMessage');
        if (savedDraft) {
            setInputValue(savedDraft);
        }
    }, []);

    // Clear chat when active company switches
    useEffect(() => {
        if (!activeCompany?.id) return;
        if (prevCompanyRef.current && prevCompanyRef.current !== activeCompany.id) {
            setMessages([]);
            setInputValue('');
            localStorage.removeItem(config.storage.chatHistory);
            localStorage.removeItem('chatDraftMessage');
        }
        prevCompanyRef.current = activeCompany.id;
    }, [activeCompany?.id]);

    // Persistence: Save messages on Update
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(config.storage.chatHistory, JSON.stringify(messages));
        }
    }, [messages]);

    // Persistence: Save draft message whenever it changes
    useEffect(() => {
        localStorage.setItem('chatDraftMessage', inputValue);
    }, [inputValue]);

    const prompts = [
        'How should I position my recent product launch?',
        'What are the core pain points of my ICP?',
        'Brainstorm social media hooks for my next campaign',
        'Help me refine my brand voice based on my strategy',
    ];



    const handleSend = async (text) => {
        const messageText = text || inputValue.trim();
        if (!messageText || isLoading || disabled) return;

        const userMessage = {
            role: 'user',
            content: messageText,
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        localStorage.removeItem('chatDraftMessage'); // Clear draft after sending
        setIsLoading(true);

        try {
            const context = {
                email: user?.email,
                userName: user?.username || user?.email,
                companyName: user?.companyName || '',
            };

            const result = await sendChatMessage(
                userMessage.content,
                context,
                messages.slice(-10)
            );

            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: result.response,
                timestamp: new Date().toISOString(),
            }]);

            // If the response indicates a calendar update, refresh profile to sync UI
            if (result.response && (
                result.response.includes('Day') && result.response.includes('Updated') ||
                result.response.includes('System Update') ||
                result.response.includes('Update Blocked')
            )) {
                await refreshProfile();
            }
        } catch (error) {
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: `Orchestration Uplink Warning: ${error.message}. I am switching to auxiliary focus to maintain strategic alignment.`,
                timestamp: new Date().toISOString(),
                isError: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatContent = (content) => {
        if (!content) return '';

        // Process line by line to support basic Markdown-lite
        return content.split('\n').map((line, i) => {
            if (!line.trim()) return <br key={i} />;

            // 1. Handle Images: ![alt](url)
            const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
            if (imgMatch) {
                return (
                    <div key={i} className="chat-image-container">
                        <img src={imgMatch[2]} alt={imgMatch[1]} className="chat-content-image" loading="lazy" />
                        {imgMatch[1] && <span className="image-caption">{imgMatch[1]}</span>}
                    </div>
                );
            }

            // 2. Handle Links and Bold/Italic (Simple Regex)
            let formattedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                .replace(/^### (.*)/, '<h3>$1</h3>')
                .replace(/^## (.*)/, '<h2>$1</h2>');

            return (
                <p
                    key={i}
                    className="plain-text-row"
                    dangerouslySetInnerHTML={{ __html: formattedLine }}
                />
            );
        });
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className={`chat-interface ${disabled ? 'disabled' : ''}`}>


            <div className="messages-container" ref={scrollContainerRef}>
                <div className="messages-wrapper">
                    {messages.length === 0 ? (
                        <div className="welcome-stage">
                            <h1 className="text-gradient">Ready for Command, {user?.username?.startsWith('@') ? user.username : `@${user?.username || 'Strategist'}`}</h1>

                            <div className="starter-grid">
                                {prompts.map((p, i) => (
                                    <button key={i} className="starter-card glass-panel" onClick={() => handleSend(p)}>
                                        <div className="card-top-marker"></div>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {messages.map((message, index) => (
                                <div key={index} className={`message-group ${message.role} ${message.isError ? 'error' : ''}`}>
                                    <div className={`message-avatar ${message.role === 'user' ? 'user-av' : 'ai-av'}`}>
                                        {message.role === 'user' ? (user?.username?.[0]?.toUpperCase() || 'U') : ''}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-bubble glass-panel">{formatContent(message.content)}</div>
                                    </div>
                                </div>
                            ))}
                            <ThinkingIndicator isActive={isLoading} />
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            <div className="chat-input-area">
                <div className="chat-input-wrapper glass-panel">
                    <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Input strategic command..."
                            rows={1}
                        />
                        <button type="submit" className="send-btn glow-btn" disabled={!inputValue.trim() || isLoading}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
