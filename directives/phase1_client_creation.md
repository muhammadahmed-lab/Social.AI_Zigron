# Phase 1: Client Creation Flow

## Goal
Allow new users to register on the platform by providing their brand information, which triggers an n8n workflow for account creation in Supabase.

## Inputs
1. **First Name** (required) - User's first name
2. **Last Name** (required) - User's last name  
3. **Email** (required) - Valid email address
4. **Company Name** (required) - Name of the user's company
5. **Website URL** (required) - Company website (https://...)
6. **Brand Guidelines** (required) - PDF or DOCX file (max 10MB)
7. **Logo** (required) - SVG, PNG, or JPG with transparent background (max 5MB)

## Flow

### Step 1: User Visits Landing Page (`index.html`)
- Display onboarding form with beautiful UI
- Two-step form process for better UX
- Real-time validation on all fields

### Step 2: Form Validation
- All fields must be filled
- Email must be valid format
- URL must be valid format
- Files must be correct type and under size limit
- Logo should have transparent background (user instruction)

### Step 3: On Submit
1. Collect all form data
2. Create FormData object with files
3. Send POST request to n8n webhook (`CONFIG.webhooks.newUser`)
4. Store user data in localStorage for dashboard
5. Show success toast
6. Redirect to `dashboard.html`

### Step 4: n8n Webhook Processing
The webhook should:
1. Receive form data including files
2. Upload files to cloud storage (Supabase Storage)
3. Create user record in Supabase database
4. Send welcome email (optional)
5. Return success response

## Webhook Payload
```json
{
  "firstName": "string",
  "lastName": "string", 
  "email": "string",
  "companyName": "string",
  "websiteUrl": "string",
  "brandGuidelines": "File",
  "logo": "File",
  "submittedAt": "ISO timestamp"
}
```

## Outputs
- User data stored in Supabase (via n8n)
- User session in localStorage
- Redirect to dashboard

## Configuration Required
Update `js/config.js` with:
```javascript
CONFIG.webhooks.newUser = 'https://your-n8n-instance.com/webhook/new-user';
```

## Edge Cases
1. **File upload fails**: Show error toast, allow retry
2. **Webhook timeout**: Store data locally, retry later
3. **Invalid file type**: Show specific error message
4. **Network error**: Show connection error message
5. **Duplicate email**: n8n should handle and return proper error

## Testing Checklist
- [ ] All form validations work
- [ ] File uploads work with drag & drop
- [ ] File size limits enforced
- [ ] Webhook receives all data correctly
- [ ] Success redirect works
- [ ] Error handling works
- [ ] Mobile responsive

## Notes
- Logo transparency check is user responsibility (instruction shown)
- Files are sent via multipart/form-data
- LocalStorage used for session persistence
