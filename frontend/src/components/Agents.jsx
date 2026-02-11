import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import ThinkingModal from './shared/ThinkingModal';
import PreviewModal from './shared/PreviewModal';
import './Agents.css';

// Fallback when DB configs haven't loaded yet
const FALLBACK_META = [
    { agent_id: 1, name: 'ICP Analyst', description: 'Build deep Ideal Customer Profiles.', is_active: true },
    { agent_id: 2, name: 'ICP Problem Identification', description: 'Identify core pain points and market gaps.', is_active: true },
    { agent_id: 3, name: 'Content Calendar Strategist', description: 'Map content hooks to specific problems.', is_active: true },
];

const Agents = () => {
    const { user, fetchCompanies, activeCompany } = useAuth();
    const [duration, setDuration] = useState('Monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [isThinking, setIsThinking] = useState(false);
    const [isApiSubmitting, setIsApiSubmitting] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dbAgents, setDbAgents] = useState(null);
    const [error, setError] = useState(null);
    const [runningAgentId, setRunningAgentId] = useState(null);

    // Settings modal state
    const [settingsAgentId, setSettingsAgentId] = useState(null);
    const [agentConfigs, setAgentConfigs] = useState({});
    const [userOverrides, setUserOverrides] = useState({});
    const [configsLoaded, setConfigsLoaded] = useState(false);

    // Fetch agent list (now includes full configs) + persisted user overrides on mount
    useEffect(() => {
        fetch(`${config.backendUrl}/api/agents/list`)
            .then(r => r.json())
            .then(d => {
                if (d.success && d.agents) {
                    setDbAgents(d.agents);
                    const configs = {};
                    d.agents.forEach(a => { configs[a.agent_id] = a; });
                    setAgentConfigs(configs);
                    setConfigsLoaded(true);
                }
            })
            .catch(() => {});

        // Load persisted user overrides from DB
        if (user?.email) {
            fetch(`${config.backendUrl}/api/user-overrides?email=${encodeURIComponent(user.email)}`)
                .then(r => r.json())
                .then(d => {
                    if (d.success && d.overrides) {
                        setUserOverrides(d.overrides);
                    }
                })
                .catch(() => {});
        }
    }, [user?.email]);

    // Check completion status from saved data
    const isAgent1Complete = !!activeCompany?.icp_data;
    const isAgent2Complete = !!activeCompany?.icp_problems;
    const isAgent3Complete = !!activeCompany?.content_calendar;

    // Merge DB metadata with step/lock logic
    const meta = dbAgents || FALLBACK_META;
    const getMeta = (id) => meta.find(a => a.agent_id === id) || {};

    const agentsList = [
        { id: 1, title: getMeta(1).name || 'ICP Analyst', description: getMeta(1).description || '', isComplete: isAgent1Complete, isLocked: false, isDisabled: getMeta(1).is_active === false, step: 1 },
        { id: 2, title: getMeta(2).name || 'Problem Identifier', description: getMeta(2).description || '', isComplete: isAgent2Complete, isLocked: !isAgent1Complete, isDisabled: getMeta(2).is_active === false, step: 2 },
        { id: 3, title: getMeta(3).name || 'Content Calendar', description: getMeta(3).description || '', isComplete: isAgent3Complete, isLocked: !isAgent2Complete, isDisabled: getMeta(3).is_active === false, step: 3 },
    ];

    const openSettings = (agentId) => {
        setSettingsAgentId(agentId);
    };

    // Get the effective value (user override > DB default)
    const getEffective = (agentId, field) => {
        if (userOverrides[agentId]?.[field] !== undefined) {
            return userOverrides[agentId][field];
        }
        return agentConfigs[agentId]?.[field] || '';
    };

    const setOverride = (agentId, field, value) => {
        setUserOverrides(prev => ({
            ...prev,
            [agentId]: { ...(prev[agentId] || {}), [field]: value }
        }));
    };

    const resetOverrides = (agentId) => {
        setUserOverrides(prev => {
            const next = { ...prev };
            delete next[agentId];
            return next;
        });
        // Delete from DB
        if (user?.email) {
            fetch(`${config.backendUrl}/api/user-overrides`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: agentId, overrides: {} })
            }).catch(() => {});
        }
    };

    const hasOverrides = (agentId) => {
        return userOverrides[agentId] && Object.keys(userOverrides[agentId]).length > 0;
    };

    const handleRunAgent = async (agentId) => {
        if (!agentId || !user?.email) return;

        setRunningAgentId(agentId);
        setIsThinking(true);
        setIsApiSubmitting(true);
        setPreviewData(null);
        setError(null);

        const overrides = userOverrides[agentId];
        const hasOv = overrides && Object.keys(overrides).length > 0;

        try {
            const response = await fetch(`${config.backendUrl}/api/run-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    agent_id: agentId,
                    selected_workers: [],
                    duration,
                    start_date: startDate,
                    ...(hasOv ? { user_overrides: overrides } : {})
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Agent execution failed');

            setPreviewData(data.result);
            setIsApiSubmitting(false);
        } catch (err) {
            console.error('Agent Error:', err);
            setError(err.message);
            setIsThinking(false);
            setIsApiSubmitting(false);
        }
    };

    const handleSaveResults = async () => {
        setIsSaving(true);
        try {
            await fetch(`${config.backendUrl}/api/save-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: runningAgentId, data: previewData })
            });
            await fetchCompanies();
            setShowPreviewModal(false);
            setRunningAgentId(null);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (isThinking && !isApiSubmitting) {
            setIsThinking(false);
            setShowPreviewModal(true);
        }
    }, [isThinking, isApiSubmitting]);

    return (
        <div className="agents-container">
            <header className="agents-header">
                <h1 className="text-gradient">Strategic Agents</h1>
            </header>

            <div className="agents-grid">
                {agentsList.map((agent, index) => (
                    <div
                        key={agent.id}
                        className={`agent-card glass-panel ${agent.isLocked ? 'locked' : ''} ${agent.isComplete ? 'completed' : ''} ${agent.isDisabled ? 'disabled' : ''}`}
                    >
                        <div className="agent-card-top">
                            <span className="agent-step-badge">Step {agent.step}</span>
                            <div className={`agent-checkbox ${agent.isComplete ? 'checked' : ''}`}>
                                {agent.isComplete ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : agent.isLocked ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                ) : (
                                    <div className="checkbox-empty"></div>
                                )}
                            </div>
                        </div>

                        <h3 className="agent-title">{agent.title}</h3>
                        <p className="agent-description">{agent.description}</p>

                        {/* Agent 3 inline controls */}
                        {agent.id === 3 && !agent.isLocked && !agent.isDisabled && (
                            <div className="agent3-inline-controls">
                                <div className="agent3-control-row">
                                    <label>Duration</label>
                                    <div className="duration-options compact">
                                        <button className={`duration-btn ${duration === 'Weekly' ? 'active' : ''}`} onClick={() => setDuration('Weekly')}>Weekly</button>
                                        <button className={`duration-btn ${duration === 'Monthly' ? 'active' : ''}`} onClick={() => setDuration('Monthly')}>Monthly</button>
                                    </div>
                                </div>
                                <div className="agent3-control-row">
                                    <label>Start Date</label>
                                    <input type="date" className="start-date-input compact" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {agent.isDisabled && (
                            <div className="agent-lock-msg">Disabled by admin</div>
                        )}
                        {!agent.isDisabled && agent.isLocked && (
                            <div className="agent-lock-msg">Complete Step {agent.step - 1} first</div>
                        )}
                        {agent.isComplete && (
                            <div className="agent-complete-msg">Completed</div>
                        )}

                        {/* Per-card action buttons */}
                        {!agent.isLocked && !agent.isDisabled && (
                            <div className="agent-card-actions">
                                <button
                                    className="agent-settings-btn"
                                    onClick={() => openSettings(agent.id)}
                                    title="Agent Settings"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                    Settings
                                    {hasOverrides(agent.id) && <span className="settings-override-dot"></span>}
                                </button>
                                <button
                                    className="agent-run-btn"
                                    onClick={() => handleRunAgent(agent.id)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                    Run Agent
                                </button>
                            </div>
                        )}

                        {/* Connector line between cards */}
                        {index < agentsList.length - 1 && (
                            <div className={`agent-connector ${agentsList[index].isComplete ? 'active' : ''}`}></div>
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <div className="agent-error-alert">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* Settings Modal */}
            {settingsAgentId && (
                <div className="settings-overlay" onClick={() => setSettingsAgentId(null)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="settings-modal-header">
                            <h2>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                {agentsList.find(a => a.id === settingsAgentId)?.title} Settings
                            </h2>
                            <button className="settings-close-btn" onClick={() => setSettingsAgentId(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {!agentConfigs[settingsAgentId] ? (
                            <div className="settings-loading">
                                <div className="settings-spinner"></div>
                                {configsLoaded ? 'Agent config not found' : 'Loading configuration...'}
                            </div>
                        ) : (
                            <div className="settings-modal-body">
                                {/* Model Configuration */}
                                <div className="settings-section">
                                    <h3>Model Configuration</h3>
                                    <div className="settings-row">
                                        <div className="settings-field">
                                            <label>AI Provider</label>
                                            <select
                                                value={getEffective(settingsAgentId, 'ai_provider') || 'auto'}
                                                onChange={(e) => setOverride(settingsAgentId, 'ai_provider', e.target.value)}
                                            >
                                                <option value="auto">Auto (Default)</option>
                                                <option value="openai">OpenAI</option>
                                                <option value="gemini">Gemini</option>
                                            </select>
                                        </div>
                                        <div className="settings-field">
                                            <label>AI Model</label>
                                            <input
                                                type="text"
                                                placeholder={agentConfigs[settingsAgentId]?.ai_model || 'Default model'}
                                                value={getEffective(settingsAgentId, 'ai_model') || ''}
                                                onChange={(e) => setOverride(settingsAgentId, 'ai_model', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* System Prompt */}
                                <div className="settings-section">
                                    <h3>System Prompt</h3>
                                    <textarea
                                        className="settings-textarea settings-textarea-sm"
                                        value={getEffective(settingsAgentId, 'system_prompt')}
                                        onChange={(e) => setOverride(settingsAgentId, 'system_prompt', e.target.value)}
                                        placeholder="System prompt..."
                                    />
                                </div>

                                {/* Directive Template */}
                                <div className="settings-section">
                                    <h3>Directive Template</h3>
                                    <p className="settings-hint">Use {'{{VARIABLE_NAME}}'} for dynamic values (e.g. {'{{COMPANY_NAME}}'}, {'{{WEBSITE_URL}}'})</p>
                                    <textarea
                                        className="settings-textarea settings-textarea-lg"
                                        value={getEffective(settingsAgentId, 'directive_template')}
                                        onChange={(e) => setOverride(settingsAgentId, 'directive_template', e.target.value)}
                                        placeholder="Directive template..."
                                    />
                                </div>

                                {/* Actions */}
                                <div className="settings-modal-actions">
                                    <button
                                        className="settings-reset-btn"
                                        onClick={() => resetOverrides(settingsAgentId)}
                                        disabled={!hasOverrides(settingsAgentId)}
                                    >
                                        Reset to Defaults
                                    </button>
                                    <button
                                        className="settings-done-btn"
                                        onClick={() => {
                                            // Persist overrides to DB if any exist
                                            const overrides = userOverrides[settingsAgentId];
                                            if (user?.email && overrides && Object.keys(overrides).length > 0) {
                                                fetch(`${config.backendUrl}/api/user-overrides`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email: user.email, agent_id: settingsAgentId, overrides })
                                                }).catch(() => {});
                                            }
                                            setSettingsAgentId(null);
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ThinkingModal
                isThinking={isThinking}
                agentsList={agentsList}
                selectedAgentId={runningAgentId}
            />

            <PreviewModal
                show={showPreviewModal}
                agentId={runningAgentId}
                data={previewData}
                isSaving={isSaving}
                onClose={() => setShowPreviewModal(false)}
                onRetry={() => handleRunAgent(runningAgentId)}
                onSave={handleSaveResults}
            />
        </div>
    );
};

export default Agents;
