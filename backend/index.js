const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Optimization: Modular Routes & Controllers
const agentController = require('./controllers/agentController');
const contentController = require('./controllers/contentController');
const chatController = require('./controllers/chatController');
const companyController = require('./controllers/companyController');
const fileController = require('./controllers/fileController');
const adminController = require('./controllers/adminController');
const { requireAdmin } = require('./middleware/adminAuth');

// Load .env from project root (local dev) — on Render, env vars come from dashboard
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: Allow specific frontend URL in production, all origins in dev
const corsOptions = process.env.FRONTEND_URL
    ? { origin: process.env.FRONTEND_URL, credentials: true }
    : {};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.get('/api/agents/list', agentController.listAgents);
app.get('/api/agents/:agentId/config', agentController.getAgentConfig);
app.post('/api/run-agent', agentController.runAgent);
app.post('/api/save-results', agentController.saveResults);
app.post('/api/reset-results', agentController.resetResults);
app.get('/api/user-overrides', agentController.getUserOverrides);
app.put('/api/user-overrides', agentController.saveUserOverride);
app.post('/api/orchestrator-chat', chatController.handleChat);
app.post('/api/generate-image', contentController.generateImage);

// Company Management Routes
app.get('/api/companies', companyController.getCompanies);
app.post('/api/companies', companyController.createCompany);
app.put('/api/companies/:id', companyController.updateCompany);
app.post('/api/companies/:id/activate', companyController.activateCompany);
app.delete('/api/companies/:id', companyController.deleteCompany);

// File Management Routes
app.post('/api/companies/:id/files', fileController.uploadFile);
app.get('/api/companies/:id/files', fileController.getFiles);
app.delete('/api/files/:id', fileController.deleteFile);

// Admin Panel Routes (protected)
app.get('/api/admin/agents', requireAdmin, adminController.getAgentConfigs);
app.put('/api/admin/agents/:agentId', requireAdmin, adminController.updateAgentConfig);
app.post('/api/admin/agents/test', requireAdmin, adminController.testAgent);
app.get('/api/admin/api-keys', requireAdmin, adminController.getApiKeyStatus);
app.put('/api/admin/api-keys', requireAdmin, adminController.updateApiKey);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'active', version: '3.0.0' }));

app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`🚀 Social AI Optimized Backend Active`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`===========================================\n`);
});
