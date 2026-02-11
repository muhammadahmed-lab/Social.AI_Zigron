// ===========================================
// Onboarding Component - Registration & Login
// ===========================================
import { useState } from 'react';
import { registerUser, loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Onboarding.css';

const Onboarding = ({ onComplete }) => {
    const { login } = useAuth();
    const [authMode, setAuthMode] = useState('login'); // 'register' or 'login'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError('');
    };

    const validateForm = () => {
        if (!formData.email.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Invalid email format';
        if (!formData.username.trim()) return 'Username is required';
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) return 'Username must be 3-20 characters (letters, numbers, underscores)';
        if (!formData.password) return 'Password is required';
        if (formData.password.length < 6) return 'Password must be at least 6 characters';
        return null;
    };

    // Handle Registration
    const handleRegister = async (e) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await registerUser(formData);

            if (result.success) {
                login(result.user);
                onComplete?.();
            } else {
                throw new Error(result.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await loginUser(formData.username, formData.password);
            login(result.user);
            onComplete?.();
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="onboarding-panel">
            {/* Brand Header */}
            <div className="ob-brand">
                <div className="ob-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </div>
                <h1>Social <span>AI</span></h1>
                <p className="ob-tagline">AI-Powered Social Media Intelligence</p>
            </div>

            {/* Tab Switcher */}
            <div className="ob-tab-bar">
                <button
                    className={`ob-tab ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('login'); setError(''); }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Sign In
                </button>
                <button
                    className={`ob-tab ${authMode === 'register' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('register'); setError(''); }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    Create Account
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="ob-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Login Form */}
            {authMode === 'login' && (
                <form className="ob-form" onSubmit={handleLogin}>
                    <div className="ob-field">
                        <label htmlFor="login-username">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Username
                        </label>
                        <input
                            type="text"
                            id="login-username"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            placeholder="Enter your username"
                            required
                        />
                    </div>
                    <div className="ob-field">
                        <label htmlFor="login-password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Password
                        </label>
                        <input
                            type="password"
                            id="login-password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            placeholder="Enter your password"
                            required
                        />
                    </div>
                    <button type="submit" className="ob-submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="ob-spinner"></span>
                                Signing in...
                            </>
                        ) : (
                            <>
                                Sign In
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>
            )}

            {/* Registration Form */}
            {authMode === 'register' && (
                <form className="ob-form" onSubmit={handleRegister}>
                    <div className="ob-field">
                        <label htmlFor="email">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="you@company.com"
                            required
                        />
                    </div>
                    <div className="ob-field">
                        <label htmlFor="username">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            placeholder="Choose a username"
                            required
                        />
                    </div>
                    <div className="ob-field">
                        <label htmlFor="password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            placeholder="Min 6 characters"
                            required
                        />
                    </div>
                    <button type="submit" className="ob-submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="ob-spinner"></span>
                                Creating account...
                            </>
                        ) : (
                            <>
                                Create Account
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>
            )}

            <div className="ob-footer">
                <span>Secured with end-to-end encryption</span>
            </div>
        </div>
    );
};

export default Onboarding;
