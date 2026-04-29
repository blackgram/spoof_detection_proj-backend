# Access Token - End-to-End Test Flows

## ✅ Core User Journeys

### 1. First Time User - Add Token via QR
- [x] Open app → See empty state with "No tokens yet"
- [x] Click "Add token" → See method selection screen
- [x] Click "Scan QR code" → See demo token selection
- [x] Select a demo token (e.g., Access Bank)
- [x] Click "Add token" → Biometric prompt appears
- [x] Wait for auto-authentication → Token added successfully
- [x] Token appears in list with live TOTP code
- [x] Code updates every 30 seconds with countdown

### 2. Add Token Manually
- [x] From token list, click "+" button
- [x] Click "Enter manually"
- [x] Fill in: Account name, Issuer, Activation code
- [x] Select icon and color
- [x] Click "Add token" → Token added to list

### 3. View Token Details
- [x] Click on any token card
- [x] See large token code with timer
- [x] Click "Copy code" → Code copied to clipboard
- [x] See "Copied" confirmation
- [x] View account info (name, issuer, created date)

### 4. Delete Token
- [x] From token detail screen, click "Delete token"
- [x] See confirmation dialog
- [x] Click "Delete" → Token removed
- [x] Return to token list (or empty state if last token)

### 5. Biometric Lock/Unlock
- [x] On app reload with existing tokens → Tokens are locked
- [x] Click "Unlock" → Biometric prompt
- [x] Wait for authentication → Tokens unlocked
- [x] All tokens visible with live codes

### 6. Data Persistence
- [x] Add tokens → Refresh page → Tokens persist
- [x] Delete all tokens → localStorage cleared
- [x] Token state saved automatically

## 🎨 Design Verification

### Google Authenticator Style Match
- [x] Clean white cards with subtle shadows
- [x] Large, prominent 6-digit codes with space (XXX XXX)
- [x] Circular timer indicators
- [x] Minimal header with simple title
- [x] Rounded buttons with proper spacing
- [x] Effra font family throughout
- [x] Access Bank brand colors (Primary: #003883, Secondary: #FF8200)

### Interactions
- [x] Smooth scale animations on button press
- [x] Timer circle color changes to orange when < 5 seconds
- [x] Biometric prompt with pulse animation
- [x] All screens have consistent header/footer layout

## 🔧 Technical Checks
- [x] TOTP generation working correctly
- [x] Timer countdown accurate (30 seconds)
- [x] localStorage read/write working
- [x] All navigation flows working
- [x] No console errors
- [x] Responsive mobile design
- [x] Touch-friendly tap targets (min 44px)

## 📱 Multi-Account Support
- [x] Support for multiple tokens
- [x] Each token has unique color/icon
- [x] Tokens sorted by creation date
- [x] Individual management per token
