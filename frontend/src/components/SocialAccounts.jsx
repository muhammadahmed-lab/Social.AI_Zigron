import React from 'react';
import './SocialAccounts.css';

const SocialAccounts = () => {
    const accounts = [
        { id: 'linkedin', name: 'LinkedIn', status: 'Connected', handle: '@your-company-page' },
        { id: 'instagram', name: 'Instagram', status: 'Connected', handle: '@your_brand_official' },
        { id: 'twitter', name: 'X / Twitter', status: 'Disconnected', handle: 'Not Linked' },
        { id: 'facebook', name: 'Facebook', status: 'Disconnected', handle: 'Not Linked' }
    ];

    return (
        <div className="social-accounts-container animate-in">
            <header className="social-header">
                <h1>Social Accounts</h1>
                <p>Manage your linked platforms and API connections.</p>
            </header>

            <div className="accounts-grid">
                {accounts.map(acc => (
                    <div key={acc.id} className={`account-card glass-card ${acc.status.toLowerCase()}`}>
                        <div className="account-info">
                            <h3>{acc.name}</h3>
                            <span className="account-handle">{acc.handle}</span>
                        </div>
                        <div className="account-status">
                            <span className={`status-badge ${acc.status.toLowerCase()}`}>
                                {acc.status}
                            </span>
                        </div>
                        <div className="account-actions">
                            <button className={acc.status === 'Connected' ? 'secondary-btn' : 'primary-btn'}>
                                {acc.status === 'Connected' ? 'Manage' : 'Connect'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="api-config-section glass-card">
                <h2>API Synchronization</h2>
                <p>Our AI agents use these connections to fetch real-time data and post scheduled content.</p>
                <div className="config-meter">
                    <div className="meter-label">
                        <span>Sync Health</span>
                        <span>85%</span>
                    </div>
                    <div className="meter-bar">
                        <div className="meter-fill" style={{ width: '85%' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialAccounts;
