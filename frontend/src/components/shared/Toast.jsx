// ===========================================
// Toast Notification Component
// ===========================================
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsExiting(true), toast.duration - 300);
        const removeTimer = setTimeout(() => onRemove(toast.id), toast.duration);
        return () => { clearTimeout(timer); clearTimeout(removeTimer); };
    }, [toast, onRemove]);

    const icons = {
        success: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
            </svg>
        ),
        error: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
        ),
        info: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
        ),
    };

    return (
        <div className={`toast-item toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
            <span className="toast-icon">{icons[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => { setIsExiting(true); setTimeout(() => onRemove(toast.id), 300); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default ToastProvider;
