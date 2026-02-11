import React, { useState, useEffect } from 'react';

const ThinkingIndicator = ({ isActive }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const steps = [
        "Consulting saved Brand Guidelines...",
        "Analyzing ICP psychographics...",
        "Referencing stored Messaging Strategy...",
        "Checking Content Calendar gaps...",
        "Synthesizing Orchestrator response..."
    ];

    useEffect(() => {
        let interval;
        if (isActive) {
            interval = setInterval(() => {
                setCurrentStep(prev => (prev + 1) % steps.length);
            }, 2000);
        } else {
            setCurrentStep(0);
        }
        return () => clearInterval(interval);
    }, [isActive, steps.length]);

    if (!isActive) return null;

    return (
        <div className="orchestrator-thinking">
            <div className="thinking-content">
                <div className="progress-track">
                    <div className="progress-fill"></div>
                </div>
            </div>
        </div>
    );
};

export default ThinkingIndicator;
