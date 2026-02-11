# Dashboard Chat Interface

## Goal
Provide users with a ChatGPT-like interface to interact with an AI assistant for social media content creation and strategy.

## Features

### Chat Interface
- Message input with auto-resize textarea
- Send button with loading states
- Typing indicator during AI response
- Message history display
- Welcome screen with quick suggestions

### Sidebar Navigation
- Collapsible sidebar (desktop)
- Mobile-responsive hamburger menu
- Navigation items with "Coming Soon" badges
- User profile display at bottom

### AI Integration
Priority order:
1. n8n Webhook (if configured)
2. Direct OpenAI API (if configured)
3. Demo responses (fallback)

## Inputs
- User message text
- Context from stored user data (company name, etc.)
- Chat history (last 10 messages for context)

## Configuration Required

### Option 1: n8n Webhook
```javascript
CONFIG.webhooks.chat = 'https://your-n8n-instance.com/webhook/chat';
```

### Option 2: OpenAI Direct
```javascript
CONFIG.openai.apiKey = 'sk-your-api-key';
CONFIG.openai.model = 'gpt-4';
```

## Chat Webhook Payload
```json
{
  "message": "string",
  "context": {
    "companyName": "string",
    "userName": "string",
    "websiteUrl": "string"
  },
  "chatHistory": [
    {"role": "user|assistant", "content": "string"}
  ]
}
```

## Expected Response
```json
{
  "response": "AI response text"
}
```

## Demo Mode Features
When no API configured, provides intelligent demo responses for:
- Content/post ideas
- Hashtag strategies
- LinkedIn post templates
- Posting time recommendations
- General queries

## Storage
- Chat history saved to localStorage
- Max ~50 messages stored (auto cleanup recommended)
- User data persisted across sessions

## Edge Cases
1. **API timeout**: Show error message, allow retry
2. **No API configured**: Use demo responses
3. **Network error**: Queue messages, retry
4. **Long responses**: Handle markdown formatting
5. **Empty session**: Redirect to onboarding

## UI States
- Idle: Input enabled, no typing indicator
- Sending: Show user message, disable input
- Processing: Show typing indicator
- Response: Hide indicator, show AI message
- Error: Show error message in chat

## Testing Checklist
- [ ] Messages send correctly
- [ ] Enter key sends, Shift+Enter newline
- [ ] Typing indicator animates
- [ ] Chat history persists on refresh
- [ ] New chat clears history
- [ ] Suggestion chips work
- [ ] Sidebar collapses/expands
- [ ] Mobile menu works
- [ ] User profile displays correctly
