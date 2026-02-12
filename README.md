# Oizom Awards Night - Voting System

Interactive voting system for the Oizom Awards Night ceremony featuring 26 award categories with real-time updates and robust duplicate vote prevention.

## Features

- **Mobile-First User Interface**: Optimized for phone voting
- **Real-Time Updates**: Instant category unlocking via Supabase subscriptions
- **Duplicate Prevention**: Multi-layer device fingerprinting
- **Admin Panel**: Control question flow and view live results
- **Serverless Architecture**: Direct frontend-to-Supabase communication

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL + Real-time + REST API)
- **Hosting**: Vercel (static site hosting)
- **Libraries**: 
  - @supabase/supabase-js (database client)
  - @fingerprintjs/fingerprintjs (device identification)

## Project Structure

```
oizom-awards-night/
├── index.html              # User voting interface
├── admin.html              # Admin control panel
├── js/
│   ├── supabaseClient.js   # Supabase initialization
│   ├── deviceId.js         # Device fingerprinting
│   ├── categoryService.js  # Category operations
│   ├── voteService.js      # Vote operations
│   ├── user.js             # User interface logic
│   └── admin.js            # Admin panel logic
├── css/
│   ├── user.css            # User interface styles
│   └── admin.css           # Admin panel styles
├── supabase/
│   ├── 01-create-tables.sql    # Database schema
│   ├── 02-enable-rls.sql       # Row Level Security
│   └── 03-insert-categories.sql # Award categories data
├── package.json
└── README.md
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the scripts in order:
   - `supabase/01-create-tables.sql`
   - `supabase/02-enable-rls.sql`
   - `supabase/03-insert-categories.sql`
4. Get your project credentials:
   - Go to Settings → API
   - Copy the Project URL and anon/public key

### 3. Configure Environment Variables

Copy the example environment file and add your Supabase credentials:

```bash
cp .env.example .env
```

Then edit `.env` and replace the placeholder values with your actual Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Never commit your `.env` file to version control. The `.env.example` file is provided as a template.

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at:
- User Interface: `http://localhost:5173/`
- Admin Panel: `http://localhost:5173/admin.html`

## Database Schema

### Categories Table
- `id`: Integer (1-27, primary key)
- `title`: Text (award category name)
- `nominees`: JSONB (A, B, C, D options)
- `unlocked`: Boolean (voting status)
- `created_at`: Timestamp

### Votes Table
- `id`: UUID (auto-generated)
- `category_id`: Integer (foreign key)
- `option`: Text (A, B, C, or D)
- `device_id`: Text (device fingerprint)
- `browser_fingerprint`: Text (browser characteristics)
- `session_id`: Text (session identifier)
- `ip_address`: Text (optional)
- `user_agent`: Text (device info)
- `timestamp`: Timestamp

**Unique Constraint**: `(category_id, device_id)` prevents duplicate votes

## How It Works

### User Flow
1. User opens voting interface on mobile device
2. System generates device fingerprint
3. User sees waiting state or currently unlocked category
4. User votes by selecting A, B, C, or D
5. Vote is submitted with device identifiers
6. Celebratory animation confirms vote
7. User waits for next category to unlock

### Admin Flow
1. Admin opens admin panel on desktop
2. Views all 26 categories with current vote counts
3. Unlocks one category at a time
4. Monitors real-time vote submissions
5. Locks category when ready to move on
6. Repeats for all categories

### Duplicate Prevention
- **Layer 1**: Device fingerprinting (FingerprintJS)
- **Layer 2**: Browser fingerprinting (custom hash)
- **Layer 3**: Session tracking (sessionStorage)
- **Layer 4**: Database UNIQUE constraint
- **Layer 5**: Client-side localStorage cache

## Deployment

### Deploy to Vercel

This project is configured for seamless deployment to Vercel with the included `vercel.json` configuration.

#### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to preview:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project in Vercel dashboard
   - Navigate to Settings → Environment Variables
   - Add the following variables:
     - `VITE_SUPABASE_URL` = your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key
   - Make sure to add them for all environments (Production, Preview, Development)

5. Deploy to production:
```bash
vercel --prod
```

#### Option 2: Deploy via Git Integration

1. Push your code to GitHub, GitLab, or Bitbucket

2. Go to [vercel.com](https://vercel.com) and sign in

3. Click "Add New Project" and import your repository

4. Vercel will automatically detect the Vite framework

5. Add environment variables:
   - In the project setup, expand "Environment Variables"
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Click "Deploy"

6. Future commits to your main branch will automatically deploy

#### Vercel Configuration

The `vercel.json` file includes:
- **Build settings**: Configured for Vite build process
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Routing**: Proper handling of static assets

#### Post-Deployment Checklist

After deploying, verify:
- [ ] User interface loads at your-project.vercel.app
- [ ] Admin panel loads at your-project.vercel.app/admin.html
- [ ] Environment variables are correctly set (check browser console for Supabase connection)
- [ ] Test voting flow on mobile device
- [ ] Test admin unlock/lock functionality
- [ ] Verify real-time updates work between admin and user interfaces

#### Troubleshooting

**Issue**: "Supabase client not initialized" error
- **Solution**: Verify environment variables are set in Vercel dashboard and redeploy

**Issue**: 404 errors on page refresh
- **Solution**: The vercel.json rewrites should handle this automatically

**Issue**: Real-time updates not working
- **Solution**: Check Supabase project status and ensure RLS policies are enabled

## Award Categories

The system includes 26 award categories (note: category 25 is missing from source data):

1. FOODIE OF OIZOM
2. EVERYONE KNOWS THEM AWARD
3. CAMERA READY ICON
4. MEME SUPPLIER
5. SILENT BUT DEADLY
6. PHONE NEVER SLEEPS AWARD
7. CTRL+ C CTRL+V CHAMP
8. DANCE FLOOR DESTROYER
9. GOSSIP BOY OF OIZOM
10. GOSSIP GIRL OF OIZOM
11. ALWAYS GIVING GYAAN
12. CONFUSION IS CONSTANT
13. HUMAN ALARM CLOCK
14. OVER PREPARED ONE
15. ASTHETIC ACE
16. LAST ONE AWAKE
17. MOST DRAMATIC REACTIONS
18. CEO OF LATE ENTRY
19. OFFICE THERAPIST
20. LAPTOP IN THE BAG AWARD
21. SLEEP ANYWHERE AWARD
22. OVER EXPLAINER AWARD
23. MOOD SWING EXPRESS
24. MULTITASKER OF OIZOM
26. CHIEF COMPLAINT OFFICER (CCO)
27. ANGRY BIRD

## Development Notes

- The system is designed for a single event (not multi-tenant)
- All categories start locked by default
- Only one category can be unlocked at a time
- Real-time updates eliminate need for polling
- Device fingerprinting provides ~99.5% accuracy
- Free tier limits: Supabase (500MB DB, 2GB bandwidth), Vercel (100GB bandwidth)

## License

Internal use only - Oizom Technologies
