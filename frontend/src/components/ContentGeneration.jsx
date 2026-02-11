import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './ContentGeneration.css';

// Module-level: survives React StrictMode unmount/remount cycle
let _pendingCalendarPost = null;

const ContentGeneration = () => {
    const { user, activeCompany } = useAuth();
    const [activeTab, setActiveTab] = useState('visuals');
    const [selectedAgent, setSelectedAgent] = useState('static');

    // Global States
    const [isGenerating, setIsGenerating] = useState(false);

    // Static Image States
    const [imagePrompt, setImagePrompt] = useState("");
    const [overlayText, setOverlayText] = useState("");
    const [selectedImageModel, setSelectedImageModel] = useState("models/gemini-3-pro-image-preview");
    const [imageAspectRatio, setImageAspectRatio] = useState("1:1");
    const [generatedImages, setGeneratedImages] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const [calendarSource, setCalendarSource] = useState(null);

    // Check for calendar post data on mount (from Content Calendar "Generate" flow)
    useEffect(() => {
        // Read from localStorage into module variable (only once, first mount)
        if (!_pendingCalendarPost) {
            const raw = localStorage.getItem('calendarPostForGeneration');
            if (raw) {
                try {
                    _pendingCalendarPost = JSON.parse(raw);
                } catch {
                    _pendingCalendarPost = null;
                }
                localStorage.removeItem('calendarPostForGeneration');
            }
        }

        if (_pendingCalendarPost) {
            const post = _pendingCalendarPost;
            _pendingCalendarPost = null;

            let prompt = '';
            if (post.detailed_prompt) {
                prompt = post.detailed_prompt;
            } else {
                const parts = [];
                if (post.overlay_text) parts.push(post.overlay_text);
                if (post.current_problem) parts.push(`Topic: ${post.current_problem}`);
                if (post.description) parts.push(post.description);
                prompt = parts.join('. ');
            }

            if (prompt) {
                setImagePrompt(prompt);
                if (post.overlay_text) setOverlayText(post.overlay_text);
                setCalendarSource(post);
                setActiveTab('visuals');
                setSelectedAgent('static');
            }
        } else {
            // Normal draft persistence load
            const savedPrompt = localStorage.getItem('visualPromptDraft');
            if (savedPrompt) setImagePrompt(savedPrompt);
            const savedOverlay = localStorage.getItem('overlayTextDraft');
            if (savedOverlay) setOverlayText(savedOverlay);
        }
    }, []);

    // Persistence: Save draft prompt whenever it changes
    useEffect(() => {
        localStorage.setItem('visualPromptDraft', imagePrompt);
    }, [imagePrompt]);

    // Persistence: Save overlay text draft
    useEffect(() => {
        localStorage.setItem('overlayTextDraft', overlayText);
    }, [overlayText]);

    // Deployment Stats
    const [lastUsedModel, setLastUsedModel] = useState("Awaiting Generation");

    const agentsConfig = {
        visuals: [
            { id: 'static', title: 'High-Impact Visuals', description: 'Production-ready 4K visuals.' },
            { id: 'carousels', title: 'Content Carousels', description: 'Multi-slide brand storytelling.' }
        ],
        videos: [
            { id: 'avatar', title: 'Avatar Studio', description: 'Realistic AI human presenters.' },
            { id: 'animation', title: 'Motion Graphics', description: 'Dynamic 2D/3D brand animations.' }
        ]
    };


    const handleGenerateImage = async () => {
        if (!imagePrompt.trim() || isGenerating) return;

        setIsGenerating(true);
        try {
            // Build final prompt including overlay text if provided
            let finalPrompt = imagePrompt;
            if (overlayText.trim()) {
                finalPrompt += `\n\nIMPORTANT: Add the following overlay text prominently on the image: "${overlayText.trim()}"`;
            }

            const response = await fetch(`${config.backendUrl}/api/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    prompt: finalPrompt,
                    model: selectedImageModel,
                    aspect_ratio: imageAspectRatio
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Image generation failed");

            setGeneratedImages(prev => [data, ...prev]);
            setLastUsedModel(data.model_used || selectedImageModel);
        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteImage = (index) => {
        if (window.confirm("Permanent delete? This cannot be undone.")) {
            setGeneratedImages(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDownloadImage = async (url, prompt) => {
        try {
            // If it's already a Data URI, we can download it directly without fetch
            let downloadUrl = url;
            if (!url.startsWith('data:')) {
                const response = await fetch(url);
                const blob = await response.blob();
                downloadUrl = window.URL.createObjectURL(blob);
            }

            const link = document.createElement('a');
            link.href = downloadUrl;
            const safePrompt = (prompt || "generated-asset").substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '-');
            link.download = `factory-${safePrompt}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (!url.startsWith('data:')) {
                window.URL.revokeObjectURL(downloadUrl);
            }
        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed. You can try right-clicking the image and selecting 'Save Image As'.");
        }
    };

    return (
        <div className="generation-container animate-in">
            <header className="generation-header">
                <div className="title-group">
                    <span className="badge">AI Factory</span>
                    <h1>Content Generation</h1>
                </div>
                <div className="tab-switcher">
                    <button className={activeTab === 'visuals' ? 'active' : ''} onClick={() => { setActiveTab('visuals'); setSelectedAgent('static'); }}>Visual Assets</button>
                    <button className={activeTab === 'videos' ? 'active' : ''} onClick={() => { setActiveTab('videos'); setSelectedAgent('avatar'); }}>Video Production</button>
                </div>
            </header>

            {/* Factory Status Bar */}
            <div className="factory-status glass-card animate-in">
                <div className="stat-item">
                    <span className="stat-label">Active Model</span>
                    <span className="stat-value">
                        {selectedImageModel.split('/').pop().toUpperCase()}
                    </span>
                </div>
                <div className="stat-separator"></div>
                <div className="stat-item">
                    <span className="stat-label">Last Deployment</span>
                    <span className="stat-value">{lastUsedModel}</span>
                </div>
                <div className="stat-separator"></div>
                <div className="stat-item">
                    <span className="stat-label">Total Assets</span>
                    <span className="stat-value">{generatedImages.length}</span>
                </div>
                <div className="stat-separator"></div>
                <div className="stat-item">
                    <span className="stat-label">Compute Reliability</span>
                    <span className="stat-value">99.9%</span>
                </div>
                <div className="stat-separator"></div>
                <div className="stat-item">
                    <span className="stat-label">AI Latency</span>
                    <span className="stat-value">1.2s</span>
                </div>
            </div>

            <div className="agent-selection-grid animate-in">
                {agentsConfig[activeTab].map(agent => (
                    <div
                        key={agent.id}
                        className={`agent-selector-card glass-card ${selectedAgent === agent.id ? 'active' : ''}`}
                        onClick={() => setSelectedAgent(agent.id)}
                    >
                        <div className="selector-indicator"></div>
                        <h3>{agent.title}</h3>
                        <p>{agent.description}</p>
                    </div>
                ))}
            </div>

            {selectedAgent === 'static' ? (
                <div className="image-gen-container animate-in">
                    <div className="image-gen-grid">
                        <div className="image-controls glass-card">
                            <div className="control-group">
                                <label>Image Generation Engine</label>
                                <select value={selectedImageModel} onChange={(e) => setSelectedImageModel(e.target.value)}>
                                    <optgroup label="Gemini Visual Series (2026)">
                                        <option value="models/gemini-3-pro-image-preview">Nano Banana 3 Pro (Active)</option>
                                        <option value="models/gemini-2.5-flash-image">Nano Banana (Fast)</option>
                                    </optgroup>
                                    <optgroup label="Imagen Production Suite">
                                        <option value="models/imagen-4.0-generate-001">Imagen 4.0 Pro</option>
                                        <option value="models/imagen-4.0-fast-generate-001">Imagen 4.0 Fast</option>
                                        <option value="models/imagen-3.0-generate-001">Imagen 3.0 (Stable High-Res)</option>
                                    </optgroup>
                                </select>
                            </div>

                            <div className="control-group">
                                <label>Aspect Ratio</label>
                                <div className="ratio-selector">
                                    <button className={imageAspectRatio === '1:1' ? 'active' : ''} onClick={() => setImageAspectRatio('1:1')}>1:1</button>
                                    <button className={imageAspectRatio === '4:5' ? 'active' : ''} onClick={() => setImageAspectRatio('4:5')}>4:5</button>
                                    <button className={imageAspectRatio === '16:9' ? 'active' : ''} onClick={() => setImageAspectRatio('16:9')}>16:9</button>
                                    <button className={imageAspectRatio === '9:16' ? 'active' : ''} onClick={() => setImageAspectRatio('9:16')}>9:16</button>
                                    <button className={imageAspectRatio === '2:3' ? 'active' : ''} onClick={() => setImageAspectRatio('2:3')}>2:3</button>
                                    <button className={imageAspectRatio === '3:2' ? 'active' : ''} onClick={() => setImageAspectRatio('3:2')}>3:2</button>
                                </div>
                            </div>

                            <div className="control-group">
                                <label>Visual Prompt</label>
                                {calendarSource && (
                                    <div className="calendar-source-tag">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        From Calendar — Day {calendarSource.day_number} ({calendarSource.date})
                                        <button onClick={() => { setCalendarSource(null); setImagePrompt(''); setOverlayText(''); }}>×</button>
                                    </div>
                                )}
                                <textarea
                                    className="image-textarea"
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                    placeholder="e.g. A futuristic office with cinematic lighting..."
                                />
                            </div>

                            <div className="control-group">
                                <label>Overlay Text (Hook)</label>
                                <input
                                    type="text"
                                    className="overlay-text-input"
                                    value={overlayText}
                                    onChange={(e) => setOverlayText(e.target.value)}
                                    placeholder="e.g. Stop Scrolling! This Changes Everything..."
                                />
                                <span className="overlay-hint">Text will be placed prominently on the generated image</span>
                            </div>

                            <button className="primary-btn gen-btn" onClick={handleGenerateImage} disabled={isGenerating || !imagePrompt.trim()}>
                                {isGenerating ? 'Synthesizing...' : 'Generate Strategic Visual'}
                            </button>
                        </div>

                        <div className="image-preview-area glass-card">
                            {!isGenerating && generatedImages.length === 0 ? (
                                <div className="preview-empty">
                                    <div className="empty-ring"></div>
                                    <p>Your generation results will appear here</p>
                                </div>
                            ) : (
                                <div className="image-gallery">
                                    {isGenerating && (
                                        <div className="generation-loader history-card glass-card">
                                            <div className="loading-spinner"></div>
                                            <p>Generating...</p>
                                        </div>
                                    )}
                                    {generatedImages.map((img, idx) => (
                                        <div key={idx} className="image-result">
                                            <img src={img.url} alt="Generated" />
                                            <div className="image-actions">
                                                <button className="action-btn" title="Preview" onClick={() => setPreviewImage(img)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                                                </button>
                                                <button className="action-btn" title="Download" onClick={() => handleDownloadImage(img.url, img.prompt)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                                </button>
                                                <button className="action-btn" title="Copy Prompt" onClick={() => { navigator.clipboard.writeText(img.prompt); alert('Prompt copied!'); }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                                </button>
                                                <button className="action-btn delete" title="Delete" onClick={() => handleDeleteImage(idx)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="placeholder-view glass-card animate-in">
                    <h2>{agentsConfig[activeTab].find(a => a.id === selectedAgent)?.title} Agent</h2>
                    <p>Building specialized production pipeline for this agent...</p>
                </div>
            )}

            {previewImage && (() => {
                // Parse prompt: strip overlay instruction for clean display
                const rawPrompt = previewImage.prompt || '';
                const overlayMatch = rawPrompt.match(/\n\nIMPORTANT: Add the following overlay text prominently on the image: "(.+)"$/);
                const cleanPrompt = overlayMatch ? rawPrompt.replace(overlayMatch[0], '') : rawPrompt;
                const extractedOverlay = overlayMatch ? overlayMatch[1] : null;

                return (
                    <div className="image-modal-overlay" onClick={() => setPreviewImage(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <button className="close-modal" onClick={() => setPreviewImage(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>

                            <div className="modal-image-wrapper">
                                <img src={previewImage.url} alt="Full Preview" />
                            </div>

                            <div className="modal-info-panel">
                                {extractedOverlay && (
                                    <div className="modal-overlay-tag">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                        {extractedOverlay}
                                    </div>
                                )}

                                <div className="modal-prompt-section">
                                    <span className="modal-prompt-label">Prompt</span>
                                    <p className="modal-prompt-text">{cleanPrompt}</p>
                                </div>

                                <div className="modal-bottom-actions">
                                    <button className="modal-action-btn download" onClick={() => handleDownloadImage(previewImage.url, previewImage.prompt)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                        Download
                                    </button>
                                    <button className="modal-action-btn copy" onClick={() => { navigator.clipboard.writeText(cleanPrompt); alert('Prompt copied!'); }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                        Copy Prompt
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};

export default ContentGeneration;
