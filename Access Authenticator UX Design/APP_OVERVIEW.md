# Access Token - Enterprise TOTP Authenticator

## 🎯 Overview
A premium, enterprise-grade two-factor authentication app designed for Access Bank's multi-platform ecosystem. Built with React, TypeScript, and Tailwind CSS, featuring a clean Google Authenticator-inspired UI with Access Bank's corporate branding.

## 🎨 Design System
- **Primary Color**: `#003883` (Access Bank Blue)
- **Secondary Color**: `#FF8200` (Access Orange)
- **Typography**: Effra font family
- **Style**: Google Authenticator-inspired minimalism with corporate boldness
- **Components**: Clean white cards, rounded buttons, subtle shadows, smooth animations

## ✨ Key Features

### 1. **Multi-Account Token Management**
- Support for unlimited security tokens
- Each token customizable with:
  - Account name and issuer
  - Color coding (6 preset colors)
  - Icon selection (Building, Briefcase, User, Wallet)
  - Unique activation codes

### 2. **Live TOTP Generation**
- Industry-standard Time-based One-Time Password (TOTP)
- 6-digit codes refreshing every 30 seconds
- Visual countdown timer with color-coded urgency:
  - Blue: Normal (>5 seconds)
  - Orange: Expiring soon (≤5 seconds)
- Real-time updates (100ms precision)

### 3. **Biometric Security**
- Mandatory biometric authentication
- Auto-lock on app reload
- Smooth unlock experience
- Fingerprint/Face ID simulation

### 4. **Dual Activation Methods**

#### QR Code Scanning (Demo)
- Quick activation via QR code scan
- Pre-configured demo accounts:
  - Access Bank (Personal)
  - SME Corporate
  - AccessMore Retail

#### Manual Entry
- Complete manual configuration
- Fields: Account name, Issuer, Activation code
- Visual customization (icon, color)
- Form validation

### 5. **Token Detail View**
- Large, readable 6-digit code display
- One-tap copy to clipboard
- Circular progress indicator
- Account information display
- Secure deletion with confirmation

### 6. **Data Persistence**
- Automatic localStorage save
- Tokens persist across sessions
- Secure biometric lock on reload
- Clean data cleanup on full deletion

## 📱 User Flows

### First-Time User Journey
1. **Empty State** → Clean onboarding with "Add token" CTA
2. **Choose Method** → QR scan or manual entry
3. **Add Token** → Quick demo selection or manual input
4. **Biometric Setup** → Enable security on first token
5. **Token List** → View all tokens with live codes

### Returning User Journey
1. **Locked State** → Tokens hidden behind biometric
2. **Unlock** → Quick biometric authentication
3. **Token List** → Access all tokens
4. **Token Detail** → View, copy, or manage individual tokens

### Token Management
- **Add**: Quick addition via QR or manual
- **View**: Detailed token information
- **Copy**: One-tap code copy with confirmation
- **Delete**: Secure deletion with confirmation dialog

## 🏗️ Technical Architecture

### Component Structure
```
App.tsx (Main Router)
├── EmptyState (No tokens)
├── TokenList (Main view)
├── AddTokenFlow (Multi-step form)
│   ├── Method Selection
│   ├── QR Scan
│   └── Manual Entry
├── BiometricPrompt (Authentication)
└── TokenDetail (Individual token)
```

### State Management
- React `useState` for local state
- `localStorage` for persistence
- Real-time updates via `useEffect` intervals
- Type-safe TypeScript throughout

### TOTP Implementation
- Custom TOTP generator (`utils/totp.ts`)
- 30-second time windows
- SHA-1 based hashing (simplified demo)
- Automatic code regeneration

### Styling
- Tailwind CSS v4.0
- Custom theme in `theme.css`
- Effra font from CDN Fonts
- Mobile-first responsive design
- Touch-optimized interactions

## 🎯 Enterprise Use Cases

### 1. Retail Banking (AccessMore)
- Customer activates soft token
- KYC verification (face capture)
- PIN setup
- Token activation
- Transaction authorization

### 2. Corporate Banking
- Multi-role support (customer + staff)
- Corporate token management
- SME account security
- Cross-app authentication

### 3. Staff Operations (Customer360)
- Service recovery flows
- Customer token generation
- Identity verification
- Code sharing/activation support

## 🔒 Security Features
- **Biometric Lock**: Mandatory authentication
- **Auto-lock**: On app reload/background
- **No Token Display**: When locked
- **Secure Delete**: Confirmation required
- **Local Storage**: Data stays on device
- **Device Binding**: One device per token (conceptual)

## 📊 Token Lifecycle

```
Activation Code → QR/Manual Entry → Biometric Setup → Token Active
                                                            ↓
                                    Token Visible ← Unlock (Biometric)
                                                            ↓
                                    View/Copy/Delete → Confirmation → Removed
```

## 🎨 UI Components

### Cards
- Clean white background
- Subtle border (`#E8EAED`)
- Soft shadow
- Rounded corners (8-12px)

### Buttons
- Primary: Rounded full (`border-radius: 9999px`)
- Height: 48px (12 in Tailwind)
- Smooth scale animation on press
- Clear hierarchy (primary/secondary/destructive)

### Typography
- Headers: 22px medium weight
- Body: 15px normal weight
- Labels: 13px medium weight
- Codes: 28-42px normal (tabular nums)

### Colors
- **Primary Actions**: #003883
- **Secondary Actions**: #FF8200
- **Destructive**: #EF4444
- **Backgrounds**: #F8FAFB (main), #FFFFFF (cards)
- **Text**: #1A1D1F (primary), #5F6368 (secondary)
- **Borders**: #E8EAED

## 🚀 Future Enhancements (Production Ready)

### Phase 1: Real Implementation
- [ ] Actual HMAC-SHA1 TOTP algorithm
- [ ] Real QR code scanner (device camera)
- [ ] Native biometric API integration
- [ ] Encrypted local storage
- [ ] Cloud backup/sync

### Phase 2: Advanced Features
- [ ] Push notifications for transaction auth
- [ ] Multi-device sync
- [ ] Token export/import
- [ ] Offline mode
- [ ] Dark mode support

### Phase 3: Enterprise Integration
- [ ] Backend API integration
- [ ] Device registration
- [ ] Admin portal
- [ ] Analytics/monitoring
- [ ] Compliance reporting

## 📏 Accessibility
- Touch targets: Minimum 44x44px
- Clear visual hierarchy
- High contrast text
- Readable font sizes
- Smooth animations (reducible)

## 🌐 Browser Support
- Modern browsers (Chrome, Safari, Edge, Firefox)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive Web App ready
- Responsive design (mobile-first)

## 📦 Dependencies
- React 18.3.1
- TypeScript
- Tailwind CSS 4.1.12
- Lucide React (icons)
- Date-fns (date formatting)
- Vite (build tool)

## 🎓 Learning Resources
This app demonstrates:
- Advanced React patterns
- TypeScript type safety
- Tailwind CSS mastery
- State management
- Local persistence
- Authentication UX
- Enterprise design systems
- Mobile-first development

---

**Built for Access Bank** | Enterprise-grade security meets delightful UX
