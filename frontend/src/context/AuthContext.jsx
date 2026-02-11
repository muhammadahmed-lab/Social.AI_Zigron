// ===========================================
// Auth Context - manages user authentication state & company management
// ===========================================
import { createContext, useContext, useState, useEffect } from 'react';
import config from '../config';
import { getUserProfile, getCompanies, activateCompany as activateCompanyAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [activeCompany, setActiveCompany] = useState(null);

    // Load user from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem(config.storage.user);
        const onboardingComplete = localStorage.getItem(config.storage.onboardingComplete);

        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                setIsOnboarded(onboardingComplete === 'true');
            } catch (e) {
                console.error('Failed to parse stored user:', e);
                localStorage.removeItem(config.storage.user);
            }
        }
        setIsLoading(false);
    }, []);

    // Login user
    const login = (userData) => {
        setUser(userData);
        setIsOnboarded(true);
        localStorage.setItem(config.storage.user, JSON.stringify(userData));
        localStorage.setItem(config.storage.onboardingComplete, 'true');
    };

    // Logout user
    const logout = () => {
        setUser(null);
        setIsOnboarded(false);
        localStorage.removeItem(config.storage.user);
        localStorage.removeItem(config.storage.onboardingComplete);
        localStorage.removeItem(config.storage.chatHistory);
    };

    // Update user data
    const updateUser = (updates) => {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem(config.storage.user, JSON.stringify(updatedUser));
    };

    // Refresh user profile from database
    const refreshProfile = async () => {
        if (!user?.email) return;
        const result = await getUserProfile(user.email);
        if (result.success) {
            updateUser(result.user);
        }
    };

    // Fetch companies for the logged-in user
    const fetchCompanies = async () => {
        if (!user?.email) return;
        const result = await getCompanies(user.email);
        if (result.success) {
            setCompanies(result.companies || []);
            const active = (result.companies || []).find(c => c.is_active);
            setActiveCompany(active || null);
        }
    };

    // Switch active company
    const switchCompany = async (companyId) => {
        if (!user?.email) return;
        const result = await activateCompanyAPI(companyId, user.email);
        if (result.success) {
            await fetchCompanies();
            await refreshProfile();
        }
        return result;
    };

    // Fetch companies when user logs in
    useEffect(() => {
        if (user?.email) {
            fetchCompanies();
        }
    }, [user?.email]);

    const value = {
        user,
        isLoading,
        isOnboarded,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        companies,
        activeCompany,
        login,
        logout,
        updateUser,
        refreshProfile,
        fetchCompanies,
        switchCompany,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
