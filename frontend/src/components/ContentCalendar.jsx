// ===========================================
// ContentCalendar - Strategic "Sheet" View
// ===========================================
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './ContentCalendar.css';

const ContentCalendar = ({ onNavigate }) => {
    const { user, activeCompany, refreshProfile, fetchCompanies } = useAuth();
    const [isResetting, setIsResetting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'syncing', 'error'
    const [localCalendar, setLocalCalendar] = useState(null);
    const [generateModal, setGenerateModal] = useState(null); // unused, kept for compat

    // Sync local state when active company's calendar changes
    React.useEffect(() => {
        if (activeCompany?.content_calendar) {
            let rawData = activeCompany.content_calendar;

            // Normalize: If it's a direct array, wrap it in the expected object structure
            if (Array.isArray(rawData)) {
                rawData = {
                    calendar_title: "Social Media Blueprint",
                    posts: rawData,
                    strategic_advice: "Your calendar has been updated by the AI Orchestrator."
                };
            }

            // Ensure posts array exists and fields are mapped correctly
            if (!rawData.posts) {
                rawData.posts = [];
            } else {
                // Map old field names to new ones if they exist
                rawData.posts = rawData.posts.map(post => ({
                    ...post,
                    channel: post.channel || post.platform || "LinkedIn",
                    post_type: post.post_type || post.content_type || "Image",
                    current_problem: post.current_problem || post.topic || "",
                    overlay_text: post.overlay_text || post.hook || ""
                }));
            }

            setLocalCalendar(JSON.parse(JSON.stringify(rawData)));
        }
    }, [activeCompany?.content_calendar]);

    const handleReset = async () => {
        if (!window.confirm("Are you sure you want to delete your Content Calendar?")) return;
        setIsResetting(true);
        try {
            const response = await fetch(`${config.backendUrl}/api/reset-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, agent_id: 3 })
            });
            if (!response.ok) throw new Error('Failed to reset calendar');

            // Immediately clear local state to prevent sync-back
            setLocalCalendar(null);

            await fetchCompanies();
            alert("Calendar cleared successfully.");
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsResetting(false);
        }
    };

    // AUTO-SYNC LOGIC
    React.useEffect(() => {
        if (!localCalendar || syncStatus === 'syncing') return;

        // Don't auto-sync if we just loaded the data
        const currentData = JSON.stringify(localCalendar);
        const lastData = JSON.stringify(activeCompany?.content_calendar);
        if (currentData === lastData) return;

        const timer = setTimeout(() => {
            handleSaveEdits(localCalendar);
        }, 3000); // 3-second debounce

        return () => clearTimeout(timer);
    }, [localCalendar]);

    const handleSaveEdits = async (dataToSave = localCalendar) => {
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${config.backendUrl}/api/save-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    agent_id: 3,
                    data: dataToSave
                })
            });
            if (!response.ok) throw new Error('Failed to save edits');
            await fetchCompanies();
            setSyncStatus('synced');
        } catch (err) {
            console.error(err);
            setSyncStatus('error');
        }
    };

    const handleDownloadCSV = () => {
        if (!localCalendar?.posts) return;

        const customCols = localCalendar.custom_columns || [];
        const headers = ["Day", "Date", "Platform", "Type", "Status", "Focus", "Hook", "Description", "Visual Prompt", "AI Model", ...customCols];
        const rows = localCalendar.posts.map(p => {
            const row = [
                p.day_number,
                p.date,
                p.channel,
                p.post_type,
                p.status || 'planned',
                `"${(p.current_problem || '').replace(/"/g, '""')}"`,
                `"${(p.overlay_text || '').replace(/"/g, '""')}"`,
                `"${(p.description || '').replace(/"/g, '""')}"`,
                `"${(p.detailed_prompt || '').replace(/"/g, '""')}"`,
                p.model
            ];
            // Add custom column values
            customCols.forEach(col => {
                row.push(`"${(p[col] || '').replace(/"/g, '""')}"`);
            });
            return row;
        });

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${localCalendar.calendar_title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const addRow = () => {
        const updated = { ...localCalendar };
        const lastPost = updated.posts.length > 0 ? updated.posts[updated.posts.length - 1] : null;
        const lastDayNum = lastPost ? lastPost.day_number : 0;

        let nextDateStr = "New Entry";
        let nextDayName = "Monday";

        if (lastPost && lastPost.date && !isNaN(new Date(lastPost.date).getTime())) {
            const lastDate = new Date(lastPost.date);
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + 1);
            nextDateStr = nextDate.toISOString().split('T')[0];
            nextDayName = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
        }

        const newPost = {
            day_number: lastDayNum + 1,
            date: nextDateStr,
            day_name: nextDayName,
            channel: "LinkedIn",
            post_type: "Image",
            status: "planned",
            current_problem: "",
            overlay_text: "",
            description: "",
            caption: "",
            detailed_prompt: "",
            model: "Nanobanana"
        };
        // Ensure custom columns exist in new row
        (updated.custom_columns || []).forEach(col => newPost[col] = "");
        updated.posts.push(newPost);
        setLocalCalendar(updated);
    };

    const deleteRow = (idx) => {
        if (!window.confirm("Delete this row?")) return;
        const updated = { ...localCalendar };
        updated.posts.splice(idx, 1);
        setLocalCalendar(updated);
    };

    const addColumn = () => {
        const colName = window.prompt("Enter Column Name (e.g. Budget, Responsibility):");
        if (!colName) return;
        const updated = { ...localCalendar };
        if (!updated.custom_columns) updated.custom_columns = [];
        if (updated.custom_columns.includes(colName)) {
            alert("Column already exists.");
            return;
        }
        updated.custom_columns.push(colName);
        updated.posts.forEach(p => p[colName] = "");
        setLocalCalendar(updated);
    };

    const deleteColumn = (colName) => {
        if (!window.confirm(`Delete the column '${colName}' and all its data?`)) return;
        const updated = { ...localCalendar };
        updated.custom_columns = updated.custom_columns.filter(c => c !== colName);
        updated.posts.forEach(p => delete p[colName]);
        setLocalCalendar(updated);
    };

    const handleGenerateContent = (post) => {
        // Save post data to localStorage for ContentGeneration to pick up
        localStorage.setItem('calendarPostForGeneration', JSON.stringify(post));
        setGenerateModal(null);
        if (onNavigate) onNavigate('generation');
    };

    const updateTitle = (newTitle) => {
        const updated = { ...localCalendar, calendar_title: newTitle };
        setLocalCalendar(updated);
    };

    const updateField = (idx, field, value) => {
        const updated = { ...localCalendar };
        updated.posts[idx][field] = value;
        setLocalCalendar(updated);
    };

    if (!localCalendar) {
        return (
            <div className="calendar-container">
                <header className="calendar-header">
                    <h1>Content Calendar</h1>
                    <p>Your strategic social media roadmap.</p>
                </header>
                <div className="no-data-state">
                    <h2>No Calendar Found</h2>
                    <p>Go to the <strong>Agents</strong> section and run the <strong>Content Calendar Strategist</strong>.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="calendar-container">
            <header className="calendar-header">
                <div className="header-top">
                    <div className="title-group">
                        <span className="badge">Strategic Blueprint</span>
                        <input
                            className="editable-title"
                            value={localCalendar.calendar_title}
                            onChange={(e) => updateTitle(e.target.value)}
                            placeholder="Calendar Title..."
                        />
                    </div>
                    <div className="header-actions">
                        <div className={`sync-indicator ${syncStatus}`}>
                            {syncStatus === 'syncing' ? 'Syncing...' :
                                syncStatus === 'error' ? 'Connection Error' :
                                    'Auto-Synced'}
                        </div>
                        <button className="download-btn" onClick={handleDownloadCSV} title="Export for Google Sheets">
                            Export CSV
                        </button>
                        <button className="secondary-btn" onClick={addColumn}>
                            + Column
                        </button>
                        <button className="secondary-btn" onClick={handleReset} disabled={isResetting}>
                            Reset
                        </button>
                    </div>
                </div>
            </header>

            <div className="sheet-container glass-card animate-in">
                <div className="sheet-table-wrapper">
                    <table className="content-sheet">
                        <thead>
                            <tr>
                                <th className="status-col">Done</th>
                                <th className="sticky-col">Day/Date</th>
                                <th>Platform</th>
                                <th>Type</th>
                                <th>Focus/Problem</th>
                                <th>Overlay Text (Hook)</th>
                                <th>Caption & Copy</th>
                                <th>Visual Prompt (AI)</th>
                                <th>Model</th>
                                {localCalendar.custom_columns?.map(col => (
                                    <th key={col} className="custom-col">
                                        {col}
                                        <button className="del-col-btn" onClick={() => deleteColumn(col)}>×</button>
                                    </th>
                                ))}
                                <th className="actions-col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {localCalendar.posts.map((post, idx) => (
                                <tr key={idx} className={post.status === 'done' ? 'row-done' : ''}>
                                    <td className="status-cell">
                                        <input
                                            type="checkbox"
                                            checked={post.status === 'done'}
                                            onChange={(e) => updateField(idx, 'status', e.target.checked ? 'done' : 'planned')}
                                        />
                                    </td>
                                    <td className="sticky-col day-cell">
                                        <strong>Day {post.day_number}</strong>
                                        <div className="date-display">
                                            <span className="day-name">{post.day_name}</span>
                                            <span className="date-val">{post.date}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <select
                                            value={post.channel}
                                            onChange={(e) => updateField(idx, 'channel', e.target.value)}
                                        >
                                            <option>LinkedIn</option>
                                            <option>Instagram</option>
                                            <option>X (Twitter)</option>
                                            <option>Facebook</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            value={post.post_type}
                                            onChange={(e) => updateField(idx, 'post_type', e.target.value)}
                                        >
                                            <option>Image</option>
                                            <option>Video</option>
                                            <option>Carousel</option>
                                        </select>
                                    </td>
                                    <td className="editable-cell">
                                        <textarea
                                            value={post.current_problem}
                                            onChange={(e) => updateField(idx, 'current_problem', e.target.value)}
                                        />
                                    </td>
                                    <td className="editable-cell post-hook">
                                        <textarea
                                            value={post.overlay_text}
                                            onChange={(e) => updateField(idx, 'overlay_text', e.target.value)}
                                        />
                                    </td>
                                    <td className="editable-cell post-copy">
                                        <textarea
                                            value={post.description}
                                            onChange={(e) => updateField(idx, 'description', e.target.value)}
                                            placeholder="Description..."
                                        />
                                        <input
                                            className="caption-input"
                                            value={post.caption}
                                            onChange={(e) => updateField(idx, 'caption', e.target.value)}
                                            placeholder="Caption/Tagline..."
                                        />
                                    </td>
                                    <td className="editable-cell prompt-cell">
                                        <textarea
                                            value={post.detailed_prompt}
                                            onChange={(e) => updateField(idx, 'detailed_prompt', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            value={post.model}
                                            onChange={(e) => updateField(idx, 'model', e.target.value)}
                                        >
                                            <option>Nanobanana</option>
                                            <option>Veo</option>
                                            <option>HeyGen</option>
                                        </select>
                                    </td>
                                    {localCalendar.custom_columns?.map(col => (
                                        <td key={col} className="editable-cell">
                                            <textarea
                                                value={post[col] || ""}
                                                onChange={(e) => updateField(idx, col, e.target.value)}
                                            />
                                        </td>
                                    ))}
                                    <td className="actions-cell">
                                        <button
                                            className="gen-row-btn"
                                            onClick={() => handleGenerateContent(post)}
                                            title="Generate Content for this day"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                            </svg>
                                        </button>
                                        <button className="del-row-btn" onClick={() => deleteRow(idx)} title="Delete Row">
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="sheet-add-row">
                    <button className="add-row-btn" onClick={addRow}>+ Add New Post Row</button>
                </div>
            </div>

            <div className="strategy-footer glass-card">
                <div className="footer-label">Strategic Guidance</div>
                <p>{localCalendar.strategic_advice}</p>
            </div>

        </div>
    );
};

export default ContentCalendar;
