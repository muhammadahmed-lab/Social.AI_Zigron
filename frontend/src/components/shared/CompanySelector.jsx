// ===========================================
// Company Selector - Dropdown for switching between companies
// ===========================================
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './CompanySelector.css';

const CompanySelector = ({ onNavigate }) => {
    const { companies, activeCompany, switchCompany } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSwitch = async (companyId) => {
        if (companyId === activeCompany?.id || isSwitching) return;

        setIsSwitching(true);
        try {
            await switchCompany(companyId);
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to switch company:', error);
        } finally {
            setIsSwitching(false);
        }
    };

    if (!companies || companies.length === 0) {
        return null; // Don't show if no companies exist
    }

    return (
        <div className="company-selector" ref={dropdownRef}>
            <button
                className="company-selector-toggle"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isSwitching}
            >
                <svg className="company-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 21h18M3 7h18M9 3v18M15 3v18M6 10h6M6 14h6M12 10h6M12 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="company-name">
                    {activeCompany?.name || 'Select Company'}
                </span>
                <svg
                    className={`chevron-icon ${isOpen ? 'open' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>

            {isOpen && (
                <div className="company-dropdown">
                    <div className="dropdown-header">Your Companies</div>
                    <div className="dropdown-list">
                        {companies.map((company) => (
                            <button
                                key={company.id}
                                className={`company-item ${company.is_active ? 'active' : ''}`}
                                onClick={() => handleSwitch(company.id)}
                                disabled={isSwitching}
                            >
                                <span className="company-item-name">{company.name}</span>
                                {company.is_active && (
                                    <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                    <button
                        className="company-item add-new"
                        onClick={() => {
                            if (onNavigate) onNavigate('create-company');
                            setIsOpen(false);
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span className="company-item-name">New Company</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default CompanySelector;
