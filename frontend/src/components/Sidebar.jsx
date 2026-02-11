// ===========================================
// Sidebar Component
// ===========================================
import { useAuth } from '../context/AuthContext';
import CompanySelector from './shared/CompanySelector';
import './Sidebar.css';

const Sidebar = ({ onNewChat, onClearHistory, chatSessions = [], isCollapsed, onToggleCollapse, onNavigate, activeItemId = 'chat' }) => {
    const { user, isAdmin, logout } = useAuth();

    const navItems = [
        {
            id: 'company',
            label: 'Company Profile',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            )
        },
        {
            id: 'agents',
            label: 'Agents',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            )
        },
        {
            id: 'chat',
            label: 'AI Chat',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            )
        },
        {
            id: 'icp',
            label: 'Ideal Customer Profile',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                </svg>
            )
        },
        {
            id: 'calendar',
            label: 'Content Calendar',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
            )
        },
        {
            id: 'analytics',
            label: 'Analytics',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            )
        },
        {
            id: 'social',
            label: 'Social Accounts',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A3 3 0 0 0 15 5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V8Z" />
                    <path d="M6 8a3 3 0 0 1 3-3 3 3 0 0 1 3 3v12a3 3 0 0 1-3 3 3 3 0 0 1-3-3V8Z" />
                </svg>
            )
        },
        {
            id: 'generation',
            label: 'Content Generation',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
            )
        },
        ...(isAdmin ? [{
            id: 'admin',
            label: 'Admin Panel',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            )
        }] : []),
    ];

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Collapse Toggle */}
            <button className="collapse-toggle" onClick={onToggleCollapse}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isCollapsed ? (
                        <path d="M9 18l6-6-6-6" />
                    ) : (
                        <path d="M15 18l-6-6 6-6" />
                    )}
                </svg>
            </button>


            {/* New Chat Button */}
            <button className="new-chat-btn" onClick={onNewChat} title="New Chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
                {!isCollapsed && <span>New Chat</span>}
            </button>

            {/* Company Selector */}
            {!isCollapsed && <CompanySelector onNavigate={onNavigate} />}

            {/* Main Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-item-btn ${activeItemId === item.id ? 'active' : ''}`}
                        title={item.label}
                        onClick={() => onNavigate(item.id)}
                    >
                        {item.icon}
                        {!isCollapsed && <span>{item.label}</span>}
                    </button>
                ))}
            </nav>

            {/* Chat History */}
            {!isCollapsed && (
                <div className="chat-history">
                    <div className="history-header">
                        <h3 className="history-title">Recent Chats</h3>
                        <button className="clear-history-btn" onClick={onClearHistory} title="Clear conversation">
                            Clear
                        </button>
                    </div>
                    <div className="history-list">
                        {chatSessions.length === 0 ? (
                            <p className="no-chats">No chats yet</p>
                        ) : (
                            chatSessions.map((session, index) => (
                                <div key={index} className="history-item-wrapper">
                                    <div className="history-item" onClick={() => onNavigate('chat')}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <span>{session.title || 'New Chat'}</span>
                                    </div>
                                    <button
                                        className="delete-chat-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClearHistory(); // Standard delete for now
                                        }}
                                        title="Delete Chat"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* User Profile */}
            {user && (
                <div className="user-profile">
                    <div className="user-avatar">
                        {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {!isCollapsed && (
                        <>
                            <div className="user-info">
                                <span className="user-name">
                                    {user.username?.startsWith('@') ? user.username : `@${user.username || user.email}`}
                                </span>
                                <span className="user-company">{user.companyName || 'No company set'}</span>
                            </div>
                            <button className="logout-btn" onClick={logout} title="Logout">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16,17 21,12 16,7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
