// ===========================================
// CompanyProfile - Active Company Profile Data
// ===========================================
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './shared/Toast';
import {
    updateCompany,
    deleteCompany,
    uploadFile,
    getFiles,
    deleteFile
} from '../services/api';
import './CompanyProfile.css';

const CompanyProfile = ({ onNavigate }) => {
    const { user, companies, activeCompany, fetchCompanies } = useAuth();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ name: '', website_url: '' });
    const [files, setFiles] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Sync form when active company changes
    useEffect(() => {
        if (activeCompany) {
            setFormData({
                name: activeCompany.name || '',
                website_url: activeCompany.website_url || '',
            });
            loadFiles(activeCompany.id);
        } else {
            setFormData({ name: '', website_url: '' });
            setFiles([]);
        }
    }, [activeCompany?.id]);

    const loadFiles = async (companyId) => {
        const result = await getFiles(companyId);
        if (result.success) {
            setFiles(result.files || []);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !activeCompany) return;

        setIsLoading(true);
        try {
            const result = await updateCompany(
                activeCompany.id, user.email,
                formData.name, formData.website_url
            );
            if (!result.success) throw new Error(result.error);
            await fetchCompanies();
            addToast('Company profile saved successfully', 'success');
        } catch (error) {
            addToast(`Failed to save: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (companyId) => {
        if (!window.confirm('Delete this company and all its files/calendars?')) return;
        setIsLoading(true);
        try {
            const result = await deleteCompany(companyId, user.email);
            if (!result.success) throw new Error(result.error);
            await fetchCompanies();
            addToast('Company deleted successfully', 'success');
        } catch (error) {
            addToast(`Failed to delete: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e, fileType) => {
        const file = e.target.files?.[0];
        if (!file || !activeCompany) return;
        if (file.size > 10 * 1024 * 1024) {
            addToast('File too large. Maximum size is 10MB', 'error');
            return;
        }

        setUploadingFile(true);
        try {
            const result = await uploadFile(activeCompany.id, user.email, fileType, file);
            if (!result.success) throw new Error(result.error);
            await loadFiles(activeCompany.id);
            e.target.value = '';
            addToast(`"${file.name}" uploaded successfully`, 'success');
        } catch (error) {
            addToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            setUploadingFile(false);
        }
    };

    const handleFileDelete = async (fileId) => {
        if (!window.confirm('Delete this file?')) return;
        try {
            const result = await deleteFile(fileId, user.email);
            if (!result.success) throw new Error(result.error);
            await loadFiles(activeCompany.id);
            addToast('File deleted successfully', 'success');
        } catch (error) {
            addToast(`Failed to delete file: ${error.message}`, 'error');
        }
    };

    const FileSection = ({ title, hint, accept, fileType, icon }) => (
        <div className="cp-file-section">
            <div className="cp-file-header">
                <span className="cp-file-title">{title}</span>
                <span className="cp-file-hint">{hint}</span>
            </div>
            <label className="cp-file-drop">
                <input
                    type="file"
                    accept={accept}
                    onChange={(e) => handleFileUpload(e, fileType)}
                    disabled={uploadingFile}
                />
                {icon}
                <span>{uploadingFile ? 'Uploading...' : 'Choose File'}</span>
            </label>
            {files.filter(f => f.file_type === fileType).map((file) => (
                <div key={file.id} className="cp-file-row">
                    {file.mime_type?.startsWith('image/') ? (
                        <img src={file.file_url} alt="" className="cp-file-thumb" />
                    ) : (
                        <svg className="cp-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                        </svg>
                    )}
                    <div className="cp-file-info">
                        <span className="cp-file-name">{file.file_name}</span>
                        <span className="cp-file-size">{(file.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="cp-btn-view">View</a>
                    <button type="button" className="cp-btn-del" onClick={() => handleFileDelete(file.id)}>Delete</button>
                </div>
            ))}
        </div>
    );

    // No companies at all
    if (companies.length === 0) {
        return (
            <div className="cp-container">
                <header className="cp-header">
                    <h1>Company Profile</h1>
                </header>
                <div className="cp-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <h2>No companies yet</h2>
                    <p>Set up your company profile to get started with AI agents</p>
                    <button className="cp-btn-primary" onClick={() => onNavigate && onNavigate('create-company')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Create Your First Company
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="cp-container">
            {/* Header */}
            <header className="cp-header">
                <h1>Company Profile</h1>
            </header>

            {/* Active Company — Inline Edit */}
            {activeCompany && (
                <form className="cp-active-section" onSubmit={handleSave}>
                    <div className="cp-active-badge">Active Company</div>

                    <div className="cp-card">
                        <h2>Company Information</h2>
                        <div className="cp-field">
                            <label>Company Name <span className="cp-req">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="cp-field">
                            <label>Website URL <span className="cp-opt">(Optional)</span></label>
                            <input
                                type="url"
                                value={formData.website_url}
                                onChange={(e) => setFormData(d => ({ ...d, website_url: e.target.value }))}
                                placeholder="https://example.com"
                            />
                        </div>
                    </div>

                    <div className="cp-card">
                        <h2>Files & Assets</h2>
                        <FileSection
                            title="Brand Guidelines"
                            hint="PDF, DOC, DOCX, TXT — Max 10MB"
                            accept=".pdf,.doc,.docx,.txt"
                            fileType="brand_guidelines"
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
                        />
                        <FileSection
                            title="Company Logo"
                            hint="PNG, JPG, SVG, WEBP — Max 10MB"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            fileType="logo"
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
                        />
                        <FileSection
                            title="Other Files"
                            hint="PDF, DOC, DOCX, TXT, Images — Max 10MB"
                            accept=".pdf,.doc,.docx,.txt,image/*"
                            fileType="other"
                            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
                        />
                    </div>

                    <div className="cp-save-row">
                        <button type="submit" className="cp-btn-primary" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            className="cp-btn-danger"
                            onClick={() => handleDelete(activeCompany.id)}
                            disabled={isLoading}
                        >
                            Delete Company
                        </button>
                    </div>
                </form>
            )}

        </div>
    );
};

export default CompanyProfile;
