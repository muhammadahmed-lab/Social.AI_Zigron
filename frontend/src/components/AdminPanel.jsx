// ===========================================
// AdminPanel - Agent Configuration & Playground
// ===========================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './shared/Toast';
import {
    getAgentConfigs,
    updateAgentConfig,
    testAgent,
    getApiKeyStatus,
    updateApiKey,
} from '../services/adminApi';
import './AdminPanel.css';

const AdminPanel = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [agents, setAgents] = useState([]);
    const [keys, setKeys] = useState([]);
    const [globalSettings, setGlobalSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState(null);

    useEffect(() => {
        if (user?.email) loadData();
    }, [user?.email]);

    const loadData = async () => {
        setLoading(true);
        const [agentRes, keyRes] = await Promise.all([
            getAgentConfigs(user.email),
            getApiKeyStatus(user.email),
        ]);
        if (agentRes.success) {
            setAgents(agentRes.agents || []);
            // Auto-select first agent if none selected
            if (!selectedAgentId && agentRes.agents?.length > 0) {
                setSelectedAgentId(agentRes.agents[0].agent_id);
            }
        }
        if (keyRes.success) {
            setKeys(keyRes.keys || []);
            setGlobalSettings(keyRes.globalSettings || {});
        }
        setLoading(false);
    };

    const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);

    if (loading) {
        return (
            <div className="admin-container">
                <header className="admin-header">
                    <h1>Admin Panel</h1>
                </header>
                <div className="admin-loading">Loading configuration...</div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>Admin Panel</h1>
                <p className="admin-subtitle">Configure agents, API keys, and test prompts</p>
            </header>

            {/* Global API Keys Section */}
            <GlobalKeysBar
                keys={keys}
                globalSettings={globalSettings}
                email={user.email}
                addToast={addToast}
                onRefresh={loadData}
            />

            {/* Agent Dropdown Selector */}
            {agents.length > 0 ? (
                <>
                    <div className="agent-selector glass-card">
                        <label className="agent-selector-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Select Agent
                        </label>
                        <select
                            className="agent-selector-dropdown"
                            value={selectedAgentId || ''}
                            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                        >
                            {agents.map(a => (
                                <option key={a.agent_id} value={a.agent_id}>
                                    Agent {a.agent_id} — {a.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedAgent && (
                        <AgentCard
                            key={selectedAgent.agent_id}
                            agent={selectedAgent}
                            email={user.email}
                            addToast={addToast}
                            onRefresh={loadData}
                        />
                    )}
                </>
            ) : (
                <div className="admin-empty glass-card">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    <h3>No Agents Found</h3>
                    <p>Run the seed script to load agent configurations:</p>
                    <code>node database/migrations/seed_agent_configs.js</code>
                </div>
            )}
        </div>
    );
};

// ===========================================
// Global Keys Bar — Compact API Key + Provider strip
// ===========================================
const GlobalKeysBar = ({ keys, globalSettings, email, addToast, onRefresh }) => {
    const [editingKey, setEditingKey] = useState(null);
    const [newValue, setNewValue] = useState('');

    const handleSave = async (keyName) => {
        if (!newValue.trim()) return;
        const res = await updateApiKey(email, keyName, newValue.trim());
        if (res.success) {
            addToast(`${keyName} updated`, 'success');
            setEditingKey(null);
            setNewValue('');
            await onRefresh();
        } else {
            addToast(`Failed: ${res.error}`, 'error');
        }
    };

    const allItems = [
        ...keys.map(k => ({ ...k, type: 'key' })),
        { name: 'AI_PROVIDER', label: 'Provider', masked: globalSettings.ai_provider || 'openai', is_set: true, type: 'setting' },
    ];

    return (
        <div className="global-keys-bar glass-card">
            <div className="keys-bar-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                <span>API Keys & Provider</span>
            </div>
            <div className="keys-bar-items">
                {allItems.map(item => (
                    <div key={item.name} className="keys-bar-item">
                        <span className="keys-bar-label">{item.label}</span>
                        {editingKey === item.name ? (
                            <div className="keys-bar-edit">
                                {item.name === 'AI_PROVIDER' ? (
                                    <select
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        autoFocus
                                    >
                                        <option value="openai">openai</option>
                                        <option value="gemini">gemini</option>
                                    </select>
                                ) : (
                                    <input
                                        type="password"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        placeholder="Enter key..."
                                        autoFocus
                                    />
                                )}
                                <button className="keys-bar-btn save" onClick={() => handleSave(item.name)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M20 6L9 17l-5-5" /></svg>
                                </button>
                                <button className="keys-bar-btn cancel" onClick={() => { setEditingKey(null); setNewValue(''); }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <button
                                className={`keys-bar-value ${item.is_set ? 'set' : 'unset'}`}
                                onClick={() => { setEditingKey(item.name); setNewValue(item.name === 'AI_PROVIDER' ? (globalSettings.ai_provider || 'openai') : ''); }}
                            >
                                {item.masked}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===========================================
// Agent Card — 4 sections: Prompt, Model, API Key, Output
// ===========================================
const AgentCard = ({ agent, email, addToast, onRefresh }) => {
    const [activeSection, setActiveSection] = useState('prompt');
    const [isSaving, setIsSaving] = useState(false);
    const [editState, setEditState] = useState({
        name: agent.name,
        description: agent.description || '',
        system_prompt: agent.system_prompt,
        directive_template: agent.directive_template,
        ai_provider: agent.ai_provider || 'auto',
        ai_model: agent.ai_model || '',
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens || 4096,
        response_format: agent.response_format || 'json_object',
        search_query_template: agent.search_query_template || '',
    });

    // Playground state
    const [testVars, setTestVars] = useState({});
    const [testOutput, setTestOutput] = useState(null);
    const [testTime, setTestTime] = useState(null);
    const [isRunning, setIsRunning] = useState(false);

    const updateEdit = (field, value) => {
        setEditState(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await updateAgentConfig(email, agent.agent_id, editState);
        if (res.success) {
            addToast(`${editState.name} saved`, 'success');
            await onRefresh();
        } else {
            addToast(`Failed: ${res.error}`, 'error');
        }
        setIsSaving(false);
    };

    // Detect template variables for playground
    const detectedVars = useMemo(() => {
        const matches = editState.directive_template.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    }, [editState.directive_template]);

    useEffect(() => {
        setTestVars(prev => {
            const updated = {};
            detectedVars.forEach(v => { updated[v] = prev[v] || ''; });
            return updated;
        });
    }, [detectedVars]);

    const handleRunTest = async () => {
        setIsRunning(true);
        setTestOutput(null);
        setTestTime(null);

        const res = await testAgent(email, {
            system_prompt: editState.system_prompt,
            directive_template: editState.directive_template,
            test_variables: testVars,
            ai_provider: editState.ai_provider !== 'auto' ? editState.ai_provider : undefined,
            ai_model: editState.ai_model || undefined,
        });

        if (res.success) {
            setTestOutput(res.result);
            setTestTime(res.execution_time_ms);
            addToast(`Test completed in ${(res.execution_time_ms / 1000).toFixed(1)}s`, 'success');
        } else {
            setTestOutput({ error: res.error });
            addToast(`Test failed: ${res.error}`, 'error');
        }
        setIsRunning(false);
    };

    const sections = [
        { id: 'prompt', label: 'Prompt', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
        { id: 'model', label: 'Model', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
        { id: 'output', label: 'Output', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
    ];

    return (
        <div className="agent-card glass-card">
            {/* Card Header */}
            <div className="agent-card-top">
                <div className="agent-card-title-area">
                    <div className="agent-number">Agent {agent.agent_id}</div>
                    <input
                        className="agent-name-input"
                        value={editState.name}
                        onChange={(e) => updateEdit('name', e.target.value)}
                    />
                    <input
                        className="agent-desc-input"
                        value={editState.description}
                        onChange={(e) => updateEdit('description', e.target.value)}
                        placeholder="Agent description..."
                    />
                </div>
                <button
                    className={`agent-save-btn ${isSaving ? 'saving' : ''}`}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? <span className="admin-spinner"></span> : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                    )}
                    Save
                </button>
            </div>

            {/* Section Tabs */}
            <div className="agent-section-tabs">
                {sections.map(s => (
                    <button
                        key={s.id}
                        className={`section-tab ${activeSection === s.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(s.id)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d={s.icon} />
                        </svg>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Section Content */}
            <div className="agent-section-content">
                {/* --- PROMPT SECTION --- */}
                {activeSection === 'prompt' && (
                    <div className="section-prompt">
                        <div className="admin-field">
                            <label>System Prompt</label>
                            <textarea
                                className="mono-textarea small"
                                value={editState.system_prompt}
                                onChange={(e) => updateEdit('system_prompt', e.target.value)}
                                placeholder="e.g. You are a StoryBrand Strategist."
                                rows={3}
                            />
                        </div>
                        <div className="admin-field">
                            <label>
                                Directive Template
                                <span className="field-hint">Use {'{{VARIABLE}}'} placeholders for dynamic values</span>
                            </label>
                            <textarea
                                className="mono-textarea large"
                                value={editState.directive_template}
                                onChange={(e) => updateEdit('directive_template', e.target.value)}
                                rows={18}
                            />
                        </div>
                        <div className="admin-field">
                            <label>Search Query Template <span className="field-hint">(optional — triggers web search before running)</span></label>
                            <input
                                className="mono-input"
                                value={editState.search_query_template}
                                onChange={(e) => updateEdit('search_query_template', e.target.value)}
                                placeholder="e.g. {{COMPANY_NAME}} target audience industry"
                            />
                        </div>
                    </div>
                )}

                {/* --- MODEL SECTION --- */}
                {activeSection === 'model' && (
                    <div className="section-model">
                        <div className="model-grid">
                            <div className="admin-field">
                                <label>AI Provider</label>
                                <select
                                    value={editState.ai_provider}
                                    onChange={(e) => updateEdit('ai_provider', e.target.value)}
                                >
                                    <option value="auto">Auto (use global default)</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="gemini">Gemini</option>
                                </select>
                            </div>
                            <div className="admin-field">
                                <label>Model Name</label>
                                <input
                                    value={editState.ai_model}
                                    onChange={(e) => updateEdit('ai_model', e.target.value)}
                                    placeholder="e.g. gpt-4o, gemini-2.0-flash"
                                />
                            </div>
                            <div className="admin-field">
                                <label>Temperature <span className="temp-val">{editState.temperature}</span></label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={editState.temperature}
                                    onChange={(e) => updateEdit('temperature', parseFloat(e.target.value))}
                                />
                                <div className="range-labels">
                                    <span>Precise</span>
                                    <span>Creative</span>
                                </div>
                            </div>
                            <div className="admin-field">
                                <label>Max Tokens</label>
                                <input
                                    type="number"
                                    value={editState.max_tokens}
                                    onChange={(e) => updateEdit('max_tokens', parseInt(e.target.value) || 4096)}
                                    min={100}
                                    max={128000}
                                />
                            </div>
                        </div>
                        <div className="admin-field">
                            <label>Response Format</label>
                            <select
                                value={editState.response_format}
                                onChange={(e) => updateEdit('response_format', e.target.value)}
                            >
                                <option value="json_object">JSON Object</option>
                                <option value="text">Plain Text</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* --- OUTPUT / PLAYGROUND SECTION --- */}
                {activeSection === 'output' && (
                    <div className="section-output">
                        {detectedVars.length > 0 && (
                            <div className="test-vars-section">
                                <label className="vars-label">
                                    Test Variables
                                    <span className="field-hint">{detectedVars.length} detected in directive</span>
                                </label>
                                <div className="vars-grid">
                                    {detectedVars.map(v => (
                                        <VarInput
                                            key={v}
                                            name={v}
                                            value={testVars[v] || ''}
                                            onChange={(val) => setTestVars(prev => ({ ...prev, [v]: val }))}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="output-run-bar">
                            <button
                                className="run-test-btn"
                                onClick={handleRunTest}
                                disabled={isRunning}
                            >
                                {isRunning ? (
                                    <>
                                        <span className="admin-spinner"></span>
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                        Run Test
                                    </>
                                )}
                            </button>
                            {testTime !== null && (
                                <span className="execution-time">{(testTime / 1000).toFixed(1)}s</span>
                            )}
                        </div>

                        {testOutput && (
                            <div className="output-result">
                                <label>Response</label>
                                <pre className="output-pre">
                                    {typeof testOutput === 'string'
                                        ? testOutput
                                        : JSON.stringify(testOutput, null, 2)
                                    }
                                </pre>
                            </div>
                        )}

                        {!testOutput && !isRunning && (
                            <div className="output-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                <p>Fill in test variables and click Run Test to see the agent output</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ===========================================
// File parsing helpers (PDF + DOCX)
// ===========================================
const parsePdf = async (arrayBuffer) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
    ).toString();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
};

const parseDocx = async (arrayBuffer) => {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ arrayBuffer });
    return result.value;
};

// ===========================================
// VarInput — Text input with file upload (txt, pdf, docx)
// ===========================================
const VarInput = ({ name, value, onChange }) => {
    const fileRef = useRef(null);
    const [fileName, setFileName] = useState(null);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setParsing(true);
        setParseError(null);

        try {
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'pdf') {
                const buffer = await file.arrayBuffer();
                const text = await parsePdf(buffer);
                onChange(text);
            } else if (ext === 'docx') {
                const buffer = await file.arrayBuffer();
                const text = await parseDocx(buffer);
                onChange(text);
            } else {
                // Plain text files
                const text = await file.text();
                onChange(text);
            }
        } catch (err) {
            console.error('File parse error:', err);
            setParseError(`Could not read file: ${err.message}`);
            setFileName(null);
        }

        setParsing(false);
    };

    const handleClear = () => {
        setFileName(null);
        setParseError(null);
        onChange('');
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <div className="admin-field var-field">
            <label className="var-name">{`{{${name}}}`}</label>

            {parsing ? (
                <div className="var-file-parsing">
                    <span className="admin-spinner"></span>
                    <span>Reading {fileName}...</span>
                </div>
            ) : fileName ? (
                <div className="var-file-loaded">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="var-file-name">{fileName}</span>
                    <span className="var-file-size">
                        {value.length > 1000
                            ? `${(value.length / 1000).toFixed(1)}k chars`
                            : `${value.length} chars`
                        }
                    </span>
                    <button className="var-file-clear" onClick={handleClear} title="Remove file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : (
                <div className="var-input-row">
                    <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={`Value for ${name}...`}
                    />
                    <button
                        className="var-upload-btn"
                        onClick={() => fileRef.current?.click()}
                        title="Upload file (.txt, .pdf, .docx, etc.)"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </button>
                </div>
            )}

            {parseError && (
                <div className="var-parse-error">{parseError}</div>
            )}

            <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.csv,.json,.html,.xml,.log,.pdf,.docx,.doc"
                onChange={handleFile}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default AdminPanel;
