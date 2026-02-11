// ===========================================
// CustomerProfile - Editable ICP Analysis with Auto-Save
// ===========================================
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './CustomerProfile.css';

const CustomerProfile = () => {
    const { user, activeCompany, fetchCompanies } = useAuth();
    const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'problems'
    const [isResetting, setIsResetting] = useState(false);
    const [localAnalysisData, setLocalAnalysisData] = useState(null);
    const [localProblemsData, setLocalProblemsData] = useState(null);
    const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'syncing', 'error'
    const [isEditMode, setIsEditMode] = useState(true); // Toggle between view and edit modes

    const analysisData = localAnalysisData;
    const problemsData = localProblemsData;

    // Load data from activeCompany when it changes
    React.useEffect(() => {
        if (activeCompany?.icp_data) {
            setLocalAnalysisData(JSON.parse(JSON.stringify(activeCompany.icp_data)));
        } else {
            setLocalAnalysisData(null);
        }
    }, [activeCompany?.icp_data]);

    React.useEffect(() => {
        if (activeCompany?.icp_problems) {
            setLocalProblemsData(JSON.parse(JSON.stringify(activeCompany.icp_problems)));
        } else {
            setLocalProblemsData(null);
        }
    }, [activeCompany?.icp_problems]);

    // Auto-save logic for analysis data
    React.useEffect(() => {
        if (!localAnalysisData || syncStatus === 'syncing') return;
        const currentData = JSON.stringify(localAnalysisData);
        const lastData = JSON.stringify(activeCompany?.icp_data);
        if (currentData === lastData) return;

        const timer = setTimeout(() => {
            handleSaveAnalysis();
        }, 2000);

        return () => clearTimeout(timer);
    }, [localAnalysisData]);

    // Auto-save logic for problems data
    React.useEffect(() => {
        if (!localProblemsData || syncStatus === 'syncing') return;
        const currentData = JSON.stringify(localProblemsData);
        const lastData = JSON.stringify(activeCompany?.icp_problems);
        if (currentData === lastData) return;

        const timer = setTimeout(() => {
            handleSaveProblems();
        }, 2000);

        return () => clearTimeout(timer);
    }, [localProblemsData]);

    const handleSaveAnalysis = async () => {
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${config.backendUrl}/api/save-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: 1, data: localAnalysisData })
            });
            if (!response.ok) throw new Error('Failed to save');
            await fetchCompanies();
            setSyncStatus('synced');
        } catch (err) {
            console.error(err);
            setSyncStatus('error');
        }
    };

    const handleSaveProblems = async () => {
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${config.backendUrl}/api/save-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: 2, data: localProblemsData })
            });
            if (!response.ok) throw new Error('Failed to save');
            await fetchCompanies();
            setSyncStatus('synced');
        } catch (err) {
            console.error(err);
            setSyncStatus('error');
        }
    };

    // Helper: Update analysis nested field
    const updateAnalysis = (path, value) => {
        const updated = { ...localAnalysisData };
        const keys = path.split('.');
        let current = updated;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setLocalAnalysisData(updated);
    };

    // Helper: Update array in analysis
    const updateAnalysisArray = (path, newArray) => {
        updateAnalysis(path, newArray);
    };

    // Helper: Add item to array
    const addToArray = (path, newItem) => {
        const updated = { ...localAnalysisData };
        const keys = path.split('.');
        let current = updated;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        const arr = current[keys[keys.length - 1]] || [];
        current[keys[keys.length - 1]] = [...arr, newItem];
        setLocalAnalysisData(updated);
    };

    // Helper: Remove item from array
    const removeFromArray = (path, index) => {
        const updated = { ...localAnalysisData };
        const keys = path.split('.');
        let current = updated;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        const arr = [...current[keys[keys.length - 1]]];
        arr.splice(index, 1);
        current[keys[keys.length - 1]] = arr;
        setLocalAnalysisData(updated);
    };

    // Helper: Update problem field
    const updateProblem = (index, field, value) => {
        const updated = { ...localProblemsData };
        updated.icp_problems[index][field] = value;
        setLocalProblemsData(updated);
    };

    // Helper: Update problem array field
    const updateProblemArray = (index, field, newArray) => {
        const updated = { ...localProblemsData };
        updated.icp_problems[index][field] = newArray;
        setLocalProblemsData(updated);
    };

    // Helper: Add new problem card
    const addProblemCard = () => {
        const updated = { ...localProblemsData };
        const newProblem = {
            rank: (updated.icp_problems?.length || 0) + 1,
            severity: 'Medium',
            problem: 'New Problem',
            description: 'Describe the problem here...',
            affected_segments: [],
            content_opportunity: 'Strategy hook for this problem...'
        };
        updated.icp_problems = [...(updated.icp_problems || []), newProblem];
        setLocalProblemsData(updated);
    };

    // Helper: Delete problem card
    const deleteProblemCard = (index) => {
        if (!window.confirm('Delete this problem card?')) return;
        const updated = { ...localProblemsData };
        updated.icp_problems.splice(index, 1);
        // Renumber remaining problems
        updated.icp_problems.forEach((prob, i) => {
            prob.rank = i + 1;
        });
        setLocalProblemsData(updated);
    };

    const handleReset = async () => {
        const agentId = activeTab === 'analysis' ? 1 : 2;
        const confirmMsg = activeTab === 'analysis'
            ? "Are you sure you want to delete your Audience Analysis? This cannot be undone."
            : "Are you sure you want to delete your Problems Identification report?";

        if (!window.confirm(confirmMsg)) return;

        setIsResetting(true);
        try {
            const response = await fetch(`${config.backendUrl}/api/reset-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: agentId })
            });

            if (!response.ok) throw new Error('Failed to reset data');

            await fetchCompanies();
            alert("Data has been cleared successfully.");
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsResetting(false);
        }
    };

    if (!analysisData && !problemsData) {
        return (
            <div className="icp-container">
                <header className="icp-header">
                    <h1>Ideal Customer Profile</h1>
                    <p>Strategic audience research for your SaaS.</p>
                </header>
                <div className="no-data-state">
                    <h2>No Research Found</h2>
                    <p>Go to the <strong>Agents</strong> section and run the <strong>ICP Analyst</strong> to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`icp-container ${!isEditMode ? 'view-only-mode' : ''}`}>
            <header className="icp-header">
                <div className="header-top">
                    <h1>Ideal Customer Profile</h1>
                    <div className="tabs-container">
                        <button
                            className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                            onClick={() => setActiveTab('analysis')}
                        >
                            Audience Analysis
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
                            onClick={() => setActiveTab('problems')}
                        >
                            Problems Identification
                        </button>
                    </div>
                </div>

                <div className="profile-actions">
                    <p>
                        Strategic Insights for <strong>{activeCompany?.name || 'Your Company'}</strong>
                        {analysisData && <span> | {analysisData.industry}</span>}
                        <span className={`sync-indicator-inline ${syncStatus}`} style={{ marginLeft: '1rem', fontSize: '0.85rem' }}>
                            {syncStatus === 'syncing' ? '⏳ Saving...' : syncStatus === 'error' ? '❌ Error' : '✓ Saved'}
                        </span>
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            className={`edit-mode-toggle ${isEditMode ? 'active' : ''}`}
                            onClick={() => setIsEditMode(!isEditMode)}
                            title={isEditMode ? 'Switch to View Mode' : 'Switch to Edit Mode'}
                        >
                            {isEditMode ? (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                    View Mode
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                    Edit Mode
                                </>
                            )}
                        </button>
                        {((activeTab === 'analysis' && analysisData) || (activeTab === 'problems' && problemsData)) && (
                            <button
                                className="reset-btn"
                                onClick={handleReset}
                                disabled={isResetting}
                            >
                                {isResetting ? 'Resetting...' : 'Reset This Analysis'}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="icp-report-layout">
                {activeTab === 'analysis' && analysisData && (
                    <div className="analysis-section animate-in">
                        {/* 1. Executive Summary - EDITABLE */}
                        <div className="icp-full-card glass-card landscape-card">
                            <div className="section-header">
                                <div className="section-title">Strategic Landscape</div>
                                <input
                                    className="industry-badge-input"
                                    value={analysisData.industry || ''}
                                    onChange={(e) => updateAnalysis('industry', e.target.value)}
                                    placeholder="Industry"
                                />
                            </div>
                            <textarea
                                className="summary-text-editable"
                                value={analysisData.company_description || ''}
                                onChange={(e) => updateAnalysis('company_description', e.target.value)}
                                placeholder="Company description..."
                            />
                        </div>

                        <div className="icp-grid">
                            {/* 2. Demographic Persona - EDITABLE */}
                            <div className="icp-card glass-card">
                                <div className="section-title-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                    <span>Demographic Persona</span>
                                </div>
                                <div className="detail-grid">
                                    <div className="detail-item-box">
                                        <label>Age Profile</label>
                                        <input
                                            value={analysisData.icp_profile?.demographics?.age_range || ''}
                                            onChange={(e) => updateAnalysis('icp_profile.demographics.age_range', e.target.value)}
                                            placeholder="e.g., 25-45"
                                        />
                                    </div>
                                    <div className="detail-item-box">
                                        <label>Gender</label>
                                        <input
                                            value={analysisData.icp_profile?.demographics?.gender || ''}
                                            onChange={(e) => updateAnalysis('icp_profile.demographics.gender', e.target.value)}
                                            placeholder="e.g., All"
                                        />
                                    </div>
                                    <div className="detail-item-box">
                                        <label>Geo Context</label>
                                        <input
                                            value={analysisData.icp_profile?.demographics?.location || ''}
                                            onChange={(e) => updateAnalysis('icp_profile.demographics.location', e.target.value)}
                                            placeholder="e.g., Urban USA"
                                        />
                                    </div>
                                    <div className="detail-item-box">
                                        <label>Economic Tier</label>
                                        <input
                                            value={analysisData.icp_profile?.demographics?.income_level || ''}
                                            onChange={(e) => updateAnalysis('icp_profile.demographics.income_level', e.target.value)}
                                            placeholder="e.g., $75k+"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Professional Firmographics - EDITABLE */}
                            <div className="icp-card glass-card">
                                <div className="section-title-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                                    <span>Professional Profile</span>
                                </div>
                                <div className="profile-segment">
                                    <label className="sub-label">Target Authorities</label>
                                    <div className="tag-cloud">
                                        {(analysisData.icp_profile?.job_titles || []).map((title, i) => (
                                            <span key={i} className="tag cyan-glow editable-tag">
                                                <input
                                                    value={title}
                                                    onChange={(e) => {
                                                        const arr = [...analysisData.icp_profile.job_titles];
                                                        arr[i] = e.target.value;
                                                        updateAnalysisArray('icp_profile.job_titles', arr);
                                                    }}
                                                />
                                                <button onClick={() => removeFromArray('icp_profile.job_titles', i)}>×</button>
                                            </span>
                                        ))}
                                        <button
                                            className="add-tag-btn"
                                            onClick={() => addToArray('icp_profile.job_titles', 'New Title')}
                                        >+ Add</button>
                                    </div>
                                </div>
                                <div className="profile-segment mt-large">
                                    <label className="sub-label">Enterprise Context</label>
                                    <div className="value-strip">
                                        <strong>Company Size:</strong>
                                        <input
                                            value={analysisData.icp_profile?.company_size || ''}
                                            onChange={(e) => updateAnalysis('icp_profile.company_size', e.target.value)}
                                            placeholder="e.g., 50-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Psychographic Core - EDITABLE */}
                            <div className="icp-card glass-card highlight-emerald">
                                <div className="section-title-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                    <span>Core Ideology</span>
                                </div>
                                <div className="profile-segment">
                                    <label className="sub-label">Modern Lifestyle</label>
                                    <textarea
                                        className="narrative-text-editable"
                                        value={analysisData.icp_profile?.psychographics?.lifestyle || ''}
                                        onChange={(e) => updateAnalysis('icp_profile.psychographics.lifestyle', e.target.value)}
                                        placeholder="Describe lifestyle..."
                                    />
                                </div>
                                {analysisData.icp_profile?.psychographics?.values && (
                                    <div className="profile-segment mt-med">
                                        <label className="sub-label">Shared Values</label>
                                        <div className="tag-cloud mini">
                                            {analysisData.icp_profile.psychographics.values.map((val, i) => (
                                                <span key={i} className="tag emerald-outline editable-tag">
                                                    <input
                                                        value={val}
                                                        onChange={(e) => {
                                                            const arr = [...analysisData.icp_profile.psychographics.values];
                                                            arr[i] = e.target.value;
                                                            updateAnalysisArray('icp_profile.psychographics.values', arr);
                                                        }}
                                                    />
                                                    <button onClick={() => removeFromArray('icp_profile.psychographics.values', i)}>×</button>
                                                </span>
                                            ))}
                                            <button
                                                className="add-tag-btn"
                                                onClick={() => addToArray('icp_profile.psychographics.values', 'New Value')}
                                            >+ Add</button>
                                        </div>
                                    </div>
                                )}
                                <div className="profile-segment mt-med">
                                    <label className="sub-label">Strategic Interests</label>
                                    <div className="tag-cloud">
                                        {(analysisData.icp_profile?.psychographics?.interests || []).map((int, i) => (
                                            <span key={i} className="tag emerald-glow editable-tag">
                                                <input
                                                    value={int}
                                                    onChange={(e) => {
                                                        const arr = [...analysisData.icp_profile.psychographics.interests];
                                                        arr[i] = e.target.value;
                                                        updateAnalysisArray('icp_profile.psychographics.interests', arr);
                                                    }}
                                                />
                                                <button onClick={() => removeFromArray('icp_profile.psychographics.interests', i)}>×</button>
                                            </span>
                                        ))}
                                        <button
                                            className="add-tag-btn"
                                            onClick={() => addToArray('icp_profile.psychographics.interests', 'New Interest')}
                                        >+ Add</button>
                                    </div>
                                </div>
                            </div>

                            {/* 5. The Challenge Stack - EDITABLE */}
                            <div className="icp-card glass-card highlight-amber">
                                <div className="section-title-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                    <span>Strategic Goals</span>
                                </div>
                                <div className="profile-segment">
                                    <ul className="detailed-list accent-amber editable-list">
                                        {(analysisData.icp_profile?.goals || []).map((goal, i) => (
                                            <li key={i}>
                                                <textarea
                                                    value={goal}
                                                    onChange={(e) => {
                                                        const arr = [...analysisData.icp_profile.goals];
                                                        arr[i] = e.target.value;
                                                        updateAnalysisArray('icp_profile.goals', arr);
                                                    }}
                                                />
                                                <button onClick={() => removeFromArray('icp_profile.goals', i)}>×</button>
                                            </li>
                                        ))}
                                        <button
                                            className="add-list-btn"
                                            onClick={() => addToArray('icp_profile.goals', 'New goal')}
                                        >+ Add Goal</button>
                                    </ul>
                                </div>
                                {analysisData.icp_profile?.challenges_preview && (
                                    <div className="profile-segment mt-large border-top-dash">
                                        <label className="sub-label amber-text">Primary Friction Points</label>
                                        <ul className="simple-check-list editable-list">
                                            {analysisData.icp_profile.challenges_preview.map((ch, i) => (
                                                <li key={i}>
                                                    <input
                                                        value={ch}
                                                        onChange={(e) => {
                                                            const arr = [...analysisData.icp_profile.challenges_preview];
                                                            arr[i] = e.target.value;
                                                            updateAnalysisArray('icp_profile.challenges_preview', arr);
                                                        }}
                                                    />
                                                    <button onClick={() => removeFromArray('icp_profile.challenges_preview', i)}>×</button>
                                                </li>
                                            ))}
                                            <button
                                                className="add-list-btn"
                                                onClick={() => addToArray('icp_profile.challenges_preview', 'New challenge')}
                                            >+ Add</button>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'problems' && (
                    <div className="problems-section animate-in">
                        {!problemsData ? (
                            <div className="no-data-state">
                                <h2>No Industry Pain Points</h2>
                                <p>Execute the <strong>Problem Identification</strong> agent to map audience friction.</p>
                            </div>
                        ) : (
                            <div className="problems-layout-container">
                                <div className="problems-main-grid">
                                    {(problemsData.icp_problems || []).map((prob, i) => (
                                        <div key={i} className={`icp-card problem-detail-card glass-card severity-${prob.severity?.toLowerCase() || 'high'}`}>
                                            <div className="card-top-header">
                                                <div className="problem-indexer">Problem 0{prob.rank}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <select
                                                        className={`severity-indicator ${prob.severity?.toLowerCase() || 'high'}`}
                                                        value={prob.severity || 'High'}
                                                        onChange={(e) => updateProblem(i, 'severity', e.target.value)}
                                                    >
                                                        <option>High</option>
                                                        <option>Medium</option>
                                                        <option>Low</option>
                                                    </select>
                                                    {isEditMode && (
                                                        <button
                                                            onClick={() => deleteProblemCard(i)}
                                                            className="delete-card-btn"
                                                            title="Delete this problem card"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <input
                                                className="problem-header-text-editable"
                                                value={prob.problem || ''}
                                                onChange={(e) => updateProblem(i, 'problem', e.target.value)}
                                                placeholder="Problem title..."
                                            />
                                            <textarea
                                                className="problem-narrative-editable"
                                                value={prob.description || ''}
                                                onChange={(e) => updateProblem(i, 'description', e.target.value)}
                                                placeholder="Problem description..."
                                            />

                                            <div className="severity-bar-wrapper">
                                                <div className="severity-label">Target Impact Severity</div>
                                                <div className="severity-bar">
                                                    <div className={`severity-fill ${prob.severity?.toLowerCase() || 'high'}`}></div>
                                                </div>
                                            </div>

                                            <div className="segment-impact-grid">
                                                <label>Critical Target Segments</label>
                                                <div className="tag-cloud mini">
                                                    {(prob.affected_segments || []).map((seg, j) => (
                                                        <span key={j} className="tag dark-mono editable-tag">
                                                            <input
                                                                value={seg}
                                                                onChange={(e) => {
                                                                    const arr = [...prob.affected_segments];
                                                                    arr[j] = e.target.value;
                                                                    updateProblemArray(i, 'affected_segments', arr);
                                                                }}
                                                            />
                                                            <button onClick={() => {
                                                                const arr = [...prob.affected_segments];
                                                                arr.splice(j, 1);
                                                                updateProblemArray(i, 'affected_segments', arr);
                                                            }}>×</button>
                                                        </span>
                                                    ))}
                                                    <button
                                                        className="add-tag-btn"
                                                        onClick={() => {
                                                            const arr = [...(prob.affected_segments || []), 'New segment'];
                                                            updateProblemArray(i, 'affected_segments', arr);
                                                        }}
                                                    >+ Add</button>
                                                </div>
                                            </div>

                                            <div className="opportunity-blueprint">
                                                <div className="blueprint-title">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                                                    Actionable Strategy Hook
                                                </div>
                                                <textarea
                                                    value={prob.content_opportunity || ''}
                                                    onChange={(e) => updateProblem(i, 'content_opportunity', e.target.value)}
                                                    placeholder="Strategy hook..."
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {isEditMode && (
                                        <div className="add-card-container">
                                            <button
                                                className="add-card-btn glass-card"
                                                onClick={addProblemCard}
                                                title="Add new problem card"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                                </svg>
                                                <span>Add New Problem Card</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="problems-side-intel">
                                    <div className="intel-card glass-card pulse-border">
                                        <div className="section-title">Strategic Content Themes</div>
                                        <div className="theme-list editable-list">
                                            {(problemsData.content_themes || []).map((theme, i) => (
                                                <div key={i} className="theme-item">
                                                    <div className="theme-dot"></div>
                                                    <input
                                                        value={theme}
                                                        onChange={(e) => {
                                                            const arr = [...problemsData.content_themes];
                                                            arr[i] = e.target.value;
                                                            const updated = { ...localProblemsData, content_themes: arr };
                                                            setLocalProblemsData(updated);
                                                        }}
                                                    />
                                                    <button onClick={() => {
                                                        const arr = [...problemsData.content_themes];
                                                        arr.splice(i, 1);
                                                        const updated = { ...localProblemsData, content_themes: arr };
                                                        setLocalProblemsData(updated);
                                                    }}>×</button>
                                                </div>
                                            ))}
                                            <button
                                                className="add-list-btn"
                                                onClick={() => {
                                                    const updated = { ...localProblemsData };
                                                    updated.content_themes = [...(updated.content_themes || []), 'New theme'];
                                                    setLocalProblemsData(updated);
                                                }}
                                            >+ Add Theme</button>
                                        </div>
                                    </div>

                                    <div className="intel-card glass-card">
                                        <div className="section-title">Validation Intelligence</div>
                                        <p className="intel-desc">Core research queries used for validation:</p>
                                        <div className="tag-cloud mini gap-med">
                                            {(problemsData.search_queries_used || []).map((q, i) => (
                                                <span key={i} className="tag ghost-tag editable-tag">
                                                    <input
                                                        value={q}
                                                        onChange={(e) => {
                                                            const arr = [...problemsData.search_queries_used];
                                                            arr[i] = e.target.value;
                                                            const updated = { ...localProblemsData, search_queries_used: arr };
                                                            setLocalProblemsData(updated);
                                                        }}
                                                    />
                                                    <button onClick={() => {
                                                        const arr = [...problemsData.search_queries_used];
                                                        arr.splice(i, 1);
                                                        const updated = { ...localProblemsData, search_queries_used: arr };
                                                        setLocalProblemsData(updated);
                                                    }}>×</button>
                                                </span>
                                            ))}
                                            <button
                                                className="add-tag-btn"
                                                onClick={() => {
                                                    const updated = { ...localProblemsData };
                                                    updated.search_queries_used = [...(updated.search_queries_used || []), 'New query'];
                                                    setLocalProblemsData(updated);
                                                }}
                                            >+ Add</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerProfile;
