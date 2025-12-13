# 0 A.D. Mod Manager - Frontend

React + Vite + TypeScript + Tailwind CSS frontend for managing 0 A.D. mods.

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
VITE_API_URL=http://localhost:3000/api
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

Create a production build:

```bash
npm run build
```

Preview the build:

```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable components
│   └── DashboardLayout.tsx
├── context/          # React Context providers
│   └── AuthContext.tsx
├── hooks/            # Custom React hooks
├── middleware/       # Auth guards and middleware
│   └── ProtectedRoute.tsx
├── pages/            # Page components
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   └── DashboardPage.tsx
├── services/         # API client and services
│   ├── apiClient.ts
│   ├── authService.ts
│   └── modsService.ts
├── utils/            # Utility functions
├── App.tsx           # Main app component
├── main.tsx          # Entry point
└── index.css         # Global styles with Tailwind
```

## Features

### Authentication
- ✅ Login with email/password
- ✅ User registration
- ✅ JWT token management
- ✅ Protected routes with role-based access
- ✅ Auto-logout on token expiration

### Dashboard
- ✅ Mod listing with role-based filtering
  - **mod_signer**: See only unsigned mods for signing
  - **admin**: See all mods
- ✅ Status filters (Pending/Live/Archived)
- ✅ Version history view
- ✅ Direct links to mod.io pages

### User Account
- ✅ Change password
- ✅ View user role
- ✅ Logout

### Admin Features (Coming Soon)
- ⏳ User management (create/edit/delete)
- ⏳ Audit log viewer
- ⏳ Role management

## Styling

The project uses **Tailwind CSS** with custom Wildfire Games colors:

```tailwind
// Wildfire brand colors
bg-wildfire-600  // Primary orange
text-wildfire-700 // Darker orange for hover
```

Custom component classes:
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.btn-danger` - Dangerous action button
- `.input-field` - Styled input field
- `.card` - Card container with shadow

## API Integration

All API requests go through the `apiClient` service, which automatically:
- Attaches JWT token to requests
- Handles 401 responses (redirects to login)
- Manages base URL configuration

Services are organized by domain:
- `authService` - Login, registration, password changes
- `modsService` - Mod listing and version history

## State Management

- **AuthContext** - Global authentication state
- **Local Component State** - For page-specific data (mods list, filters, etc.)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development Tips

### Hot Module Replacement (HMR)
Changes to components automatically refresh in the browser during development.

### TypeScript
The project uses TypeScript strict mode. All API responses are strongly typed.

### Styling
Use Tailwind utility classes for styling. Avoid writing custom CSS when possible.

### Environment Variables
All environment variables must be prefixed with `VITE_` to be available in the browser.

## Build Output

The `dist/` directory contains the production-ready build:
- Optimized JavaScript bundles
- Minified CSS
- Static assets
- Can be served by any static file server

## Troubleshooting

### "Cannot find module './index.css'"
Make sure the CSS file exists in `src/index.css` and the import in `src/main.tsx` is correct.

### CORS errors
Make sure `VITE_API_URL` in `.env.local` points to the backend API URL.

### 401 Unauthorized errors
The token may have expired. Clear localStorage and login again:
```javascript
localStorage.clear();
window.location.href = '/login';
```

## Next Steps

1. Implement admin pages (user management, audit logs)
2. Add mod version signing interface
3. Real-time mod sync status display
4. Add search and advanced filtering
5. Implement notifications/alerts system
