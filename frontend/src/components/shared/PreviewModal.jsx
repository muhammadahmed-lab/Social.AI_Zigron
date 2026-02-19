import React from 'react';
import './PreviewModal.css';

const PreviewModal = ({
    show,
    onClose,
    data,
    agentId,
    onSave,
    onRetry,
    isSaving
}) => {
    if (!show || !data) return null;

    const agentConfig = {
        1: { title: 'Audience Analysis', icon: 'users', accent: '#10b981' },
        2: { title: 'Problems Identified', icon: 'alert', accent: '#f59e0b' },
        3: { title: 'Content Calendar', icon: 'calendar', accent: '#6366f1' }
    };

    const config = agentConfig[agentId] || { title: 'Results', icon: 'check', accent: '#10b981' };

    // Normalize Agent 1: new format has icp_profiles[], old format had icp_profile{}
    const firstIcp = data?.icp_profiles?.[0] || data?.icp_profile || null;
    const icpCount = data?.icp_profiles?.length || (data?.icp_profile ? 1 : 0);

    // Normalize Agent 2: new format has icp_problems_by_profile[], old format had icp_problems[]
    const allProblems = data?.icp_problems_by_profile
        ? data.icp_problems_by_profile.flatMap(g => g.problems || [])
        : (data?.icp_problems || []);
    const icpGroupCount = data?.icp_problems_by_profile?.length || 0;

    return (
        <div className="pm-overlay" onClick={onClose}>
            <div className="pm-modal" onClick={e => e.stopPropagation()}>
                <button className="pm-close" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Header */}
                <div className="pm-header" style={{ '--accent': config.accent }}>
                    <div className="pm-icon-ring">
                        {agentId === 1 && (
                            <svg viewBox="0 0 24 24" fill="none" stroke={config.accent} strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        )}
                        {agentId === 2 && (
                            <svg viewBox="0 0 24 24" fill="none" stroke={config.accent} strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        )}
                        {agentId === 3 && (
                            <svg viewBox="0 0 24 24" fill="none" stroke={config.accent} strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                        )}
                    </div>
                    <h2>{config.title}</h2>
                    <p className="pm-subtitle">Review your results before saving</p>
                </div>

                {/* Agent 1 - ICP Analyst */}
                {agentId === 1 && (
                    <div className="pm-body">
                        {data.industry && (
                            <div className="pm-industry-tag">{data.industry}</div>
                        )}

                        {icpCount > 0 && (
                            <div className="pm-insight-badge" style={{ marginBottom: '0.75rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                <span>{icpCount} ICP {icpCount === 1 ? 'Persona' : 'Personas'} Generated — {firstIcp?.icp_name || 'Preview of first profile'}</span>
                            </div>
                        )}

                        <div className="pm-stat-row">
                            <div className="pm-stat-card">
                                <div className="pm-stat-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                                </div>
                                <span className="pm-stat-label">Age Range</span>
                                <span className="pm-stat-value">{firstIcp?.demographics?.age_range || 'N/A'}</span>
                            </div>
                            <div className="pm-stat-card">
                                <div className="pm-stat-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="pm-stat-label">Location</span>
                                <span className="pm-stat-value">{firstIcp?.demographics?.location || 'N/A'}</span>
                            </div>
                            <div className="pm-stat-card">
                                <div className="pm-stat-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                </div>
                                <span className="pm-stat-label">Income</span>
                                <span className="pm-stat-value">{firstIcp?.demographics?.income_level || 'N/A'}</span>
                            </div>
                        </div>

                        {firstIcp?.goals?.[0] && (
                            <div className="pm-highlight-card green">
                                <div className="pm-highlight-label">Primary Goal</div>
                                <p>{firstIcp.goals[0]}</p>
                            </div>
                        )}

                        {firstIcp?.job_titles?.length > 0 && (
                            <div className="pm-tags-section">
                                <span className="pm-tags-label">Target Roles</span>
                                <div className="pm-tags">
                                    {firstIcp.job_titles.slice(0, 4).map((t, i) => (
                                        <span key={i} className="pm-tag">{t}</span>
                                    ))}
                                    {firstIcp.job_titles.length > 4 && (
                                        <span className="pm-tag muted">+{firstIcp.job_titles.length - 4} more</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {data.research_insights?.length > 0 && (
                            <div className="pm-insight-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                                <span>{data.research_insights.length} Web Sources Analyzed</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Agent 2 - Problems */}
                {agentId === 2 && (
                    <div className="pm-body">
                        <div className="pm-problems-count">
                            <span className="pm-big-number">{allProblems.length}</span>
                            <span className="pm-big-label">Problems Found{icpGroupCount > 0 ? ` across ${icpGroupCount} ICPs` : ''}</span>
                        </div>

                        <div className="pm-problem-list">
                            {allProblems.slice(0, 3).map((prob, i) => (
                                <div key={i} className="pm-problem-row">
                                    <div className={`pm-severity-dot ${prob.severity?.toLowerCase() || 'high'}`}></div>
                                    <div className="pm-problem-info">
                                        <span className="pm-problem-title">{prob.problem}</span>
                                        <span className={`pm-severity-text ${prob.severity?.toLowerCase() || 'high'}`}>
                                            {prob.severity || 'High'} Severity
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {allProblems.length > 3 && (
                                <div className="pm-more-items">+{allProblems.length - 3} more problems</div>
                            )}
                        </div>

                        {data.content_themes?.length > 0 && (
                            <div className="pm-tags-section">
                                <span className="pm-tags-label">Content Themes</span>
                                <div className="pm-tags">
                                    {data.content_themes.slice(0, 3).map((t, i) => (
                                        <span key={i} className="pm-tag amber">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {allProblems.some(p => p.research_evidence) && (
                            <div className="pm-insight-badge amber">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                <span>Validated with live web research</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Agent 3 - Content Calendar */}
                {agentId === 3 && (
                    <div className="pm-body">
                        <div className="pm-calendar-header">
                            <span className="pm-calendar-title">{data?.calendar_title || 'Content Roadmap'}</span>
                        </div>

                        <div className="pm-stat-row">
                            <div className="pm-stat-card purple">
                                <span className="pm-stat-value-lg">{data?.posts?.length || 0}</span>
                                <span className="pm-stat-label">Total Posts</span>
                            </div>
                            <div className="pm-stat-card purple">
                                <span className="pm-stat-value-lg">
                                    {[...new Set(data?.posts?.map(p => p.channel || p.platform))].filter(Boolean).length || 0}
                                </span>
                                <span className="pm-stat-label">Platforms</span>
                            </div>
                            <div className="pm-stat-card purple">
                                <span className="pm-stat-value-lg">
                                    {[...new Set(data?.posts?.map(p => p.post_type || p.content_type))].filter(Boolean).length || 0}
                                </span>
                                <span className="pm-stat-label">Content Types</span>
                            </div>
                        </div>

                        {data?.posts?.length > 0 && (
                            <div className="pm-calendar-preview">
                                <span className="pm-tags-label">First 3 Posts</span>
                                {data.posts.slice(0, 3).map((post, i) => (
                                    <div key={i} className="pm-post-row">
                                        <div className="pm-post-date">{post.date || `Day ${i + 1}`}</div>
                                        <div className="pm-post-info">
                                            <span className="pm-post-title">{post.current_problem || post.topic || post.overlay_text || post.hook || post.caption?.substring(0, 60) || 'Post'}</span>
                                            <div className="pm-post-meta">
                                                {(post.channel || post.platform) && <span className="pm-tag small">{post.channel || post.platform}</span>}
                                                {(post.post_type || post.content_type) && <span className="pm-tag small purple">{post.post_type || post.content_type}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {data.posts.length > 3 && (
                                    <div className="pm-more-items">+{data.posts.length - 3} more posts planned</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="pm-footer">
                    <button className="pm-btn-secondary" onClick={onRetry} disabled={isSaving}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        Regenerate
                    </button>
                    <button className="pm-btn-primary" onClick={onSave} disabled={isSaving} style={{ '--accent': config.accent }}>
                        {isSaving ? (
                            <>
                                <div className="pm-btn-spinner"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Save Strategy
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreviewModal;
