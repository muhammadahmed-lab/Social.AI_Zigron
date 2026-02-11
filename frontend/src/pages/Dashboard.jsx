import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatInterface from '../components/ChatInterface';
import Agents from '../components/Agents';
import CustomerProfile from '../components/CustomerProfile';
import CompanyProfile from '../components/CompanyProfile';
import ContentCalendar from '../components/ContentCalendar';
import SocialAccounts from '../components/SocialAccounts';
import ContentGeneration from '../components/ContentGeneration';
import CreateCompany from '../components/CreateCompany';
import AdminPanel from '../components/AdminPanel';
import Onboarding from '../components/Onboarding';
import './Dashboard.css';

const Dashboard = () => {
    const { isAuthenticated, isOnboarded } = useAuth();
    const [chatSessions, setChatSessions] = useState([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [activeView, setActiveView] = useState('chat'); // 'chat', 'agents', 'icp', 'calendar', 'social', or 'generation'

    // Sync sidebar sessions from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('smm_ai_chat_history');
        if (saved) {
            try {
                const messages = JSON.parse(saved);
                if (messages.length > 0) {
                    // Just show the current session's first message as title for now
                    const title = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');
                    setChatSessions([{ id: 1, title }]);
                }
            } catch (e) {
                console.error('History Sync Error:', e);
            }
        }
    }, [activeView]);

    const handleNewChat = () => {
        if (window.confirm('Start a new session? This will clear current context.')) {
            localStorage.removeItem('smm_ai_chat_history');
            setActiveView('chat');
            window.location.reload();
        }
    };

    const handleClearHistory = () => {
        if (window.confirm('Are you sure you want to clear your chat history?')) {
            localStorage.removeItem('smm_ai_chat_history');
            window.location.reload();
        }
    };

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    // Show full-screen onboarding when not authenticated
    if (!isAuthenticated) {
        return (
            <div className="onboarding-screen">
                <Onboarding />
            </div>
        );
    }

    return (
        <div className={`dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Sidebar */}
            <Sidebar
                onNewChat={handleNewChat}
                onClearHistory={handleClearHistory}
                chatSessions={chatSessions}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebar}
                onNavigate={setActiveView}
                activeItemId={activeView}
            />

            {/* Main Content */}
            <main className="main-content">
                {activeView === 'chat' && (
                    <ChatInterface disabled={!isOnboarded} />
                )}

                {activeView === 'agents' && (
                    <Agents />
                )}

                {activeView === 'company' && (
                    <CompanyProfile />
                )}

                {activeView === 'icp' && (
                    <CustomerProfile />
                )}

                {activeView === 'calendar' && (
                    <ContentCalendar onNavigate={setActiveView} />
                )}

                {activeView === 'social' && (
                    <SocialAccounts />
                )}

                {activeView === 'generation' && (
                    <ContentGeneration />
                )}

                {activeView === 'create-company' && (
                    <CreateCompany onNavigate={setActiveView} />
                )}

                {activeView === 'admin' && (
                    <AdminPanel />
                )}

                {/* Placeholders for other views */}
                {activeView !== 'chat' &&
                    activeView !== 'agents' &&
                    activeView !== 'company' &&
                    activeView !== 'icp' &&
                    activeView !== 'calendar' &&
                    activeView !== 'social' &&
                    activeView !== 'generation' &&
                    activeView !== 'create-company' &&
                    activeView !== 'admin' && (
                        <div className="view-placeholder">
                            <h2>{activeView.toUpperCase()} Section</h2>
                            <p>This feature is coming soon.</p>
                        </div>
                    )}
            </main>
        </div>
    );
};

export default Dashboard;
