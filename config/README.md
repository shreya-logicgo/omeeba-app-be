# Google Service Account Configuration

This directory contains the Google service account configuration for Google Play purchase verification.

## Setup Instructions

1. **Create a Google Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project
   - Navigate to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name (e.g., "omeeba-purchase-verification")
   - Click "Create and Continue"

2. **Generate a JSON Key:**
   - After creating the service account, click on it
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" as the key type
   - Click "Create"
   - The JSON file will be downloaded automatically

3. **Configure the Service Account:**
   - Copy the downloaded JSON file to this directory as `google-service-account.json`
   - The file should NOT be committed to version control (already in .gitignore)

4. **Grant Permissions in Google Play Console:**
   - Go to [Google Play Console](https://play.google.com/console)
   - Select your app
   - Navigate to Setup > API access
   - Click "Create Service Account"
   - Use the same service account email from step 1
   - Grant the following permissions:
     - **Android Publisher API** - Required for purchase verification
     - **Finance** or **Play Management** permissions as needed

5. **Verify Configuration:**
   - Start your server
   - Test the configuration using: `GET /api/v1/purchases/test/google-config`
   - You should see a success message if everything is configured correctly

## Security Notes

- The `google-service-account.json` file contains sensitive credentials
- Never commit this file to version control
- Ensure proper file permissions (readable only by the server process)
- Consider using environment-specific files for different deployments

## Troubleshooting

If you encounter authentication errors:

1. **File not found:** Ensure `google-service-account.json` exists in this directory
2. **Permission denied:** Check file permissions and Google Play Console API access
3. **Invalid credentials:** Verify the JSON file is complete and not corrupted
4. **API access issues:** Ensure the service account has proper permissions in Google Play Console

## File Structure

```
config/
├── google-service-account.json          # Actual credentials (DO NOT COMMIT)
├── google-service-account.json.example  # Example template
└── README.md                           # This file
```
