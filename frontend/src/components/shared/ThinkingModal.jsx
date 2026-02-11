import React from 'react';
import './ThinkingModal.css';

const ThinkingModal = ({ isThinking, agentsList, selectedAgentId }) => {
    if (!isThinking) return null;

    const agentTitle = agentsList.find(a => a.id === selectedAgentId)?.title || "Agent";

    return (
        <div className="thinking-overlay">
            <div className="thinking-content">
                <div className="thinking-animation">
                    <div className="orbit-ring ring-1"></div>
                    <div className="orbit-ring ring-2"></div>
                    <div className="orbit-ring ring-3"></div>
                    <div className="core-dot"></div>
                </div>
                <div className="thinking-label">{agentTitle}</div>
                <div className="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
};

export default ThinkingModal;
