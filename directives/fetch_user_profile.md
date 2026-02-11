# Directive: Fetch User Profile (Supabase)

## Goal
Retrieve the complete profile and brand assets for a specific user using their email address. This data is essential for personalizing AI responses and maintaining consistency with the user's brand.

## Inputs
- `email`: (String) The user's primary email address used during onboarding.

## Execution Tool
- **Script**: `execution/supabase_fetch.py`
- **Command**: `python execution/supabase_fetch.py <email>`

## Outputs
- **Success**: A JSON object containing the user's details (FirstName, LastName, Company, Brand Guidelines URL, etc.).
- **Failure**: An error message indicating the user was not found or a connection issue occurred.

## Success Criteria
- The script returns a `found: True` status.
- All brand-related fields (Logo, Guidelines) are present in the final JSON.

## Process Flow
1. Receive user email from Orchestration layer.
2. Run `execution/supabase_fetch.py` with the provided email.
3. Parse the JSON result.
4. If user is found, provide the profile to the AI context.
5. If user is not found, advise the Orchestration layer to trigger the "New User Onboarding" flow.

## Edge Cases
- **Missing Email**: Ensure the email is validated before calling the script.
- **Empty Result**: Treat 0 matches as a new user (Direct to onboarding).
- **Service Timeout**: If Supabase is unreachable, inform the user and suggest retry.
