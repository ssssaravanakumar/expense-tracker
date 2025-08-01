# Firebase Setup Guide for Real-time Family Expense Sharing

This guide will help you set up Firebase Firestore to enable real-time syncing across family members.

## Prerequisites

1. Google account
2. Access to [Firebase Console](https://console.firebase.google.com/)

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name (e.g., "family-expense-tracker")
4. Choose whether to enable Google Analytics (optional for this app)
5. Click **"Create project"**

## Step 2: Enable Firestore Database

1. In your Firebase project console, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll configure security rules later)
4. Select a location for your database (choose closest to your family members)
5. Click **"Done"**

## Step 3: Get Firebase Configuration

1. In your Firebase project, click the **gear icon** (Project settings)
2. Scroll down to **"Your apps"** section
3. Click the **web icon** (`</>` to add a web app
4. Enter app nickname (e.g., "expense-tracker-web")
5. **Don't** check "Also set up Firebase Hosting"
6. Click **"Register app"**
7. Copy the Firebase configuration object

## Step 4: Configure Your App

1. Open `src/config/firebase.ts` in your project
2. Replace the placeholder values with your Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-actual-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id",
};
```

## Step 5: Configure Firestore Security Rules

1. In Firebase Console, go to **"Firestore Database"**
2. Click **"Rules"** tab
3. Replace the default rules with these more permissive rules for family sharing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to families collection
    match /families/{familyId} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Security Note:** These rules allow anyone to read/write data. For production use, consider implementing proper authentication and more restrictive rules.

## Step 6: Test the Setup

1. Save your Firebase configuration
2. Run your app: `npm run dev`
3. Go to the **Family** tab
4. Click **"Create New Family"**
5. If successful, you should see a Family ID generated
6. Check your Firestore console - you should see a new `families` collection

## Step 7: Share with Family Members

1. After creating a family, copy the **Family ID**
2. Share this ID with family members
3. They can join by:
   - Opening the app on their device
   - Going to **Family** tab
   - Entering the Family ID
   - Clicking **"Join Family"**

## Data Structure

The app creates the following Firestore structure:

```
/families/{familyId}
├── id: string
├── familyName: string
├── lastUpdated: timestamp
├── lastUpdatedBy: string
├── members: array
│   ├── id: string
│   ├── name: string
│   ├── deviceInfo: string
│   ├── lastSeen: timestamp
│   └── isOnline: boolean
└── budgets: array
    ├── id: string
    ├── month: string
    ├── totalSalary: number
    ├── categories: array
    ├── fixedExpenses: array
    ├── expenses: array
    ├── createdAt: timestamp
    └── updatedAt: timestamp
```

## Features Enabled

✅ **Real-time Sync**: Expenses sync instantly across all family devices  
✅ **Offline Support**: Works offline, syncs when connection restored  
✅ **Conflict Resolution**: Handles multiple users editing simultaneously  
✅ **No Authentication**: Works without login - just share Family ID  
✅ **Member Tracking**: See who's online and when they last made changes  
✅ **Cross-Platform**: Works on any device with a web browser

## Troubleshooting

### "Permission denied" errors

- Check Firestore security rules are configured correctly
- Ensure your Firebase config is correct

### "Project not found" errors

- Verify your project ID in the Firebase config
- Make sure the project exists in Firebase Console

### Real-time updates not working

- Check browser console for JavaScript errors
- Verify internet connection
- Try refreshing the page

### Family ID not working

- Make sure the Family ID is copied correctly (no extra spaces)
- Check that the family exists in Firestore console

## Production Considerations

For production use, consider:

1. **Authentication**: Implement Firebase Auth for better security
2. **Security Rules**: Write more restrictive Firestore rules
3. **Data Validation**: Add server-side validation for data integrity
4. **Monitoring**: Set up Firebase monitoring and alerts
5. **Backup**: Configure automatic backups
6. **Rate Limiting**: Implement rate limiting to prevent abuse

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all configuration steps
3. Test with a simple family setup first
4. Check Firebase Console for any service issues

---

**🎉 Once configured, your family can share expenses in real-time across all devices!**
