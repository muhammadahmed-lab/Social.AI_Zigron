// ===========================================
// CreateCompany - Dedicated page for creating a new company
// ===========================================
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './shared/Toast';
import { createCompany } from '../services/api';
import './CreateCompany.css';

const CreateCompany = ({ onNavigate }) => {
    const { user, fetchCompanies } = useAuth();
    const { addToast } = useToast();
    const [formData, setFormData] = useState({ name: '', website_url: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await createCompany(
                user.email, formData.name, formData.website_url, true
            );
            if (!result.success) throw new Error(result.error);
            await fetchCompanies();
            addToast(`"${formData.name}" created successfully`, 'success');
            onNavigate('company');
        } catch (err) {
            setError(err.message);
            addToast(`Failed to create company: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="cc-container">
            <header className="cc-header">
                <button className="cc-back-btn" onClick={() => onNavigate('company')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Companies
                </button>
                <h1>Create New Company</h1>
                <p className="cc-subtitle">Set up a new company profile to manage its content and marketing</p>
            </header>

            <form className="cc-form" onSubmit={handleSubmit}>
                <div className="cc-card">
                    <div className="cc-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 21h18M3 7h18M9 3v18M15 3v18M6 10h3M6 14h3M15 10h3M15 14h3" />
                        </svg>
                    </div>

                    <div className="cc-field">
                        <label htmlFor="cc-name">
                            Company Name <span className="cc-req">*</span>
                        </label>
                        <input
                            id="cc-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                            placeholder="e.g. Acme Corporation"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="cc-field">
                        <label htmlFor="cc-url">
                            Website URL <span className="cc-opt">(Optional)</span>
                        </label>
                        <input
                            id="cc-url"
                            type="url"
                            value={formData.website_url}
                            onChange={(e) => setFormData(d => ({ ...d, website_url: e.target.value }))}
                            placeholder="https://example.com"
                        />
                    </div>

                    {error && (
                        <div className="cc-error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="cc-actions">
                        <button
                            type="button"
                            className="cc-btn-cancel"
                            onClick={() => onNavigate('company')}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="cc-btn-create"
                            disabled={isLoading || !formData.name.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <span className="cc-spinner"></span>
                                    Creating...
                                </>
                            ) : (
                                'Create Company'
                            )}
                        </button>
                    </div>
                </div>

                <div className="cc-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>The new company will be set as your active company. You can upload files and configure it after creation.</span>
                </div>
            </form>
        </div>
    );
};

export default CreateCompany;
