# Design Document: Oizom Awards Night

## Overview

The Oizom Awards Night voting system is a mobile-first web application built with vanilla HTML, CSS, and JavaScript, using Supabase as the backend database. The system displays one award category at a time - only the currently unlocked question is visible to users. The architecture is serverless with direct frontend-to-Supabase communication.

The system consists of two interfaces:
1. **User Voting Interface** (mobile-only): Shows only the currently unlocked category, allows one vote per category per device
2. **Admin Panel** (desktop): Controls which category is unlocked and views real-time results

Duplicate vote prevention uses multiple techniques: device fingerprinting, browser fingerprinting, session tracking, and database constraints to ensure each device can only vote once per category.

The system handles 27 predefined award categories for a single awards ceremony event.

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  Admin Panel    │         │ User Interface  │
│   (HTML/CSS/JS) │         │  (HTML/CSS/JS)  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  Supabase JS Client       │  Supabase JS Client
         │  (REST API + Realtime)    │  (REST API + Realtime)
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────▼──────────┐
              │    Supabase     │
              │   PostgreSQL    │
              │   + Realtime    │
              └─────────────────┘
```

### Technology Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Backend/Database**: Supabase (PostgreSQL + REST API + Realtime)
- **Client Library**: Supabase JavaScript Client (@supabase/supabase-js)
- **Hosting**: Vercel (static site hosting - free tier)
- **No custom backend server**: Direct frontend-to-Supabase communication

### Deployment Model

**Vercel Static Hosting:**
- Static HTML/CSS/JS files deployed to Vercel
- No serverless functions needed
- Automatic HTTPS and CDN distribution
- Environment variables for Supabase credentials

**Supabase Setup:**
- Free tier PostgreSQL database
- Automatic REST API generation
- Real-time subscriptions for live updates
- Row Level Security (RLS) for access control

## Components and Interfaces

### 1. Supabase Database Schema

**Tables:**

**categories table:**
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  nominees JSONB NOT NULL,  -- {A: "name", B: "name", C: "name", D: "name"}
  unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**votes table:**
```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES categories(id),
  option TEXT NOT NULL CHECK (option IN ('A', 'B', 'C', 'D')),
  device_id TEXT NOT NULL,           -- Primary identifier (device fingerprint)
  browser_fingerprint TEXT,          -- Secondary identifier
  session_id TEXT,                   -- Tertiary identifier
  ip_address TEXT,                   -- For additional tracking
  user_agent TEXT,                   -- Device info
  timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, device_id)     -- Prevent duplicate votes per device per category
);
```

**Database Indexes:**
```sql
CREATE INDEX idx_votes_category ON votes(category_id);
CREATE INDEX idx_votes_device ON votes(device_id);
CREATE INDEX idx_votes_browser_fp ON votes(browser_fingerprint);
CREATE INDEX idx_categories_unlocked ON categories(unlocked);
```

**Database Constraint for Single Unlock:**
```sql
-- Add a check to ensure only one category can be unlocked at a time
-- This is enforced at application level, but we add an index for performance
CREATE UNIQUE INDEX idx_single_unlocked ON categories(unlocked) WHERE unlocked = true;
```

**Row Level Security (RLS) Policies:**

```sql
-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

-- Everyone can read votes (for counting)
CREATE POLICY "Anyone can view votes"
  ON votes FOR SELECT
  USING (true);

-- Anyone can insert votes (duplicate prevention via UNIQUE constraint)
CREATE POLICY "Anyone can insert votes"
  ON votes FOR INSERT
  WITH CHECK (true);

-- Only allow updates to categories (for admin unlock)
-- In production, you'd add admin authentication here
CREATE POLICY "Anyone can update categories"
  ON categories FOR UPDATE
  USING (true);
```

### 2. Supabase Client (supabaseClient.js)

**Responsibilities:**
- Initialize Supabase client with credentials
- Provide reusable client instance
- Handle connection configuration

**Implementation:**
```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### 3. Category Service (categoryService.js)

**Responsibilities:**
- Fetch categories from Supabase
- Update category unlock status
- Subscribe to category changes for real-time updates
- Calculate vote counts

**Key Functions:**

```javascript
// Get all categories with vote counts
async function getAllCategoriesWithVotes()

// Get only unlocked categories
async function getUnlockedCategories()

// Unlock a category
async function unlockCategory(categoryId)

// Lock a category
async function lockCategory(categoryId)

// Subscribe to category changes
function subscribeToCategories(callback)

// Get vote counts for a category
async function getVoteCounts(categoryId)
```

**Implementation Examples:**

```javascript
// Get unlocked categories
async function getUnlockedCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('unlocked', true);
  
  if (error) throw error;
  return data;
}

// Unlock category with single-unlock enforcement
async function unlockCategory(categoryId) {
  // First, lock all categories
  await supabase
    .from('categories')
    .update({ unlocked: false })
    .neq('id', 0);  // Update all
  
  // Then unlock the selected one
  const { data, error } = await supabase
    .from('categories')
    .update({ unlocked: true })
    .eq('id', categoryId)
    .select();
  
  if (error) throw error;
  return data[0];
}

// Subscribe to real-time changes
function subscribeToCategories(callback) {
  return supabase
    .channel('categories-channel')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'categories' },
      callback
    )
    .subscribe();
}
```

### 4. Vote Service (voteService.js)

**Responsibilities:**
- Submit votes to Supabase
- Check for duplicate votes
- Fetch user's votes
- Subscribe to vote changes for real-time counts

**Key Functions:**

```javascript
// Submit a vote
async function submitVote(categoryId, option, userId)

// Check if user has voted for category
async function hasUserVoted(categoryId, userId)

// Get user's votes
async function getUserVotes(userId)

// Subscribe to vote changes
function subscribeToVotes(callback)

// Get vote counts for category
async function getVoteCounts(categoryId)
```

**Implementation Examples:**

```javascript
// Submit vote
async function submitVote(categoryId, option, userId) {
  // Check if category is unlocked
  const { data: category } = await supabase
    .from('categories')
    .select('unlocked')
    .eq('id', categoryId)
    .single();
  
  if (!category?.unlocked) {
    throw new Error('Category is not unlocked');
  }
  
  // Insert vote (UNIQUE constraint prevents duplicates)
  const { data, error } = await supabase
    .from('votes')
    .insert({
      category_id: categoryId,
      option: option,
      user_id: userId
    })
    .select();
  
  if (error) {
    if (error.code === '23505') {  // Unique violation
      throw new Error('You have already voted for this category');
    }
    throw error;
  }
  
  return data[0];
}

// Check if user voted
async function hasUserVoted(categoryId, userId) {
  const { data, error } = await supabase
    .from('votes')
    .select('id')
    .eq('category_id', categoryId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) throw error;
  return data !== null;
}

// Get vote counts
async function getVoteCounts(categoryId) {
  const { data, error } = await supabase
    .from('votes')
    .select('option')
    .eq('category_id', categoryId);
  
  if (error) throw error;
  
  const counts = { A: 0, B: 0, C: 0, D: 0, total: 0 };
  data.forEach(vote => {
    counts[vote.option]++;
    counts.total++;
  });
  
  return counts;
}
```

### 5. User Interface (index.html, user.js, user.css)

**Responsibilities:**
- Display ONLY the currently unlocked award category (one at a time)
- Allow users to vote once per category
- Subscribe to real-time category unlock/lock changes
- Show voting confirmation and prevent re-voting
- Generate device fingerprint for duplicate prevention
- Mobile-first, optimized for phone screens

**Key Behavior:**
- When no category is unlocked: Show waiting state
- When a category is unlocked: Display that category immediately
- When user votes: Show confirmation, mark as voted, wait for next category
- When category is locked: Hide it and return to waiting state
- Real-time updates: No polling needed, Supabase pushes changes instantly

**Key Components:**

```javascript
// Device identification
async function initializeDevice()

// Real-time subscription to unlocked category
function subscribeToUnlockedCategory()

// Render the current unlocked category
function renderCategory(category)

// Show waiting state
function showWaitingState()

// Submit vote
async function submitVote(categoryId, option)

// Show vote confirmation
function showVoteConfirmation()
function showCelebration()

// Check if already voted
async function checkIfVoted(categoryId)
```

**Real-time Updates:**
```javascript
// Subscribe to category changes - only show unlocked category
supabase
  .channel('user-categories')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'categories' },
    (payload) => {
      if (payload.new.unlocked) {
        // A category was unlocked - show it
        renderCategory(payload.new);
      } else if (payload.old.unlocked && !payload.new.unlocked) {
        // Category was locked - hide it
        showWaitingState();
      }
    }
  )
  .subscribe();
```

**UI Flow:**
1. User opens app → Initialize device fingerprint
2. Check for unlocked category → Show it OR show waiting state
3. User votes → Submit to Supabase → Show confirmation
4. Admin unlocks next category → Real-time update → Show new category
5. Repeat for all 27 categories

**UI Elements:**
- Header with event title and progress (X/27 voted)
- Waiting state: "Waiting for next category..." with animated loader
- Category card: Title, 4 nominee buttons (A, B, C, D)
- Vote confirmation: Celebratory animation + "Vote recorded!"
- Already voted indicator: "You've already voted for this category"
- Mobile-optimized: Large touch targets, vertical layout

### 6. Admin Panel (admin.html, admin.js, admin.css)

**Responsibilities:**
- Display all categories with unlock status
- Provide unlock/lock controls
- Show real-time vote counts
- Subscribe to real-time updates for votes and categories

**Key Components:**

```javascript
// Real-time subscriptions
function subscribeToCategories()
function subscribeToVotes()

// Render admin view
function renderCategories(categories)

// Unlock/lock actions
async function unlockCategory(categoryId)
async function lockCategory(categoryId)

// Display vote counts
async function updateVoteCounts(categoryId)
function renderVoteCounts(categoryId, counts)
```

**Real-time Updates:**
```javascript
// Subscribe to both categories and votes
supabase
  .channel('admin-updates')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'categories' },
    handleCategoryChange
  )
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'votes' },
    handleNewVote
  )
  .subscribe();
```

**UI Elements:**
- Category list with status indicators
- Unlock/lock buttons
- Vote count displays (bar charts or numbers)
- Total votes per category
- Real-time update indicators

## Data Models

### Category Model (Supabase Table)

```javascript
{
  id: Number,              // Primary key (1-27)
  title: String,           // Award category name
  nominees: JSONB,         // {A: "name", B: "name", C: "name", D: "name"}
  unlocked: Boolean,       // Whether category is currently unlocked
  created_at: Timestamp    // Auto-generated
}
```

### Vote Model (Supabase Table)

```javascript
{
  id: UUID,                    // Auto-generated primary key
  category_id: Number,         // Foreign key to categories
  option: String,              // 'A', 'B', 'C', or 'D'
  device_id: String,           // Device fingerprint (primary identifier)
  browser_fingerprint: String, // Browser fingerprint (secondary)
  session_id: String,          // Session identifier (tertiary)
  ip_address: String,          // IP address (supplementary)
  user_agent: String,          // User agent string
  timestamp: Timestamp         // Auto-generated
}
```

### Client-Side Data Structures

**Category with Vote Counts:**
```javascript
{
  id: Number,
  title: String,
  nominees: {
    A: String,
    B: String,
    C: String,
    D: String
  },
  unlocked: Boolean,
  voteCounts: {
    A: Number,
    B: Number,
    C: Number,
    D: Number,
    total: Number
  }
}
```

**Device Identifiers:**
```javascript
{
  deviceId: String,           // FingerprintJS visitor ID
  browserFingerprint: String, // Hash of browser characteristics
  sessionId: String,          // Session storage ID
  userAgent: String           // Navigator user agent
}
```

## User Identifier Strategy

Since the system uses pure HTML/CSS/JS without authentication, preventing duplicate votes requires a multi-layered approach combining device fingerprinting, browser fingerprinting, and session tracking.

### Multi-Layer Duplicate Prevention

**Layer 1: Device Fingerprinting (Primary)**
Uses FingerprintJS or similar library to generate a unique device identifier based on:
- Canvas fingerprinting
- WebGL fingerprinting
- Audio fingerprinting
- Screen resolution and color depth
- Installed fonts
- Timezone and language
- Hardware concurrency
- Device memory

**Layer 2: Browser Fingerprinting (Secondary)**
Additional fingerprint based on:
- User agent
- Browser plugins
- Touch support
- Platform
- Do Not Track setting

**Layer 3: Session Tracking (Tertiary)**
- Session ID stored in sessionStorage
- Persists across page refreshes but not browser restarts
- Provides additional tracking layer

**Layer 4: IP Address (Supplementary)**
- Captured on vote submission
- Not used for primary duplicate prevention (multiple users may share IP)
- Useful for analytics and detecting suspicious patterns

### Implementation

```javascript
// deviceId.js - Device identification module

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let deviceId = null;
let browserFingerprint = null;
let sessionId = null;

// Initialize device fingerprinting
async function initializeDeviceId() {
  // Get device fingerprint (most reliable)
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  deviceId = result.visitorId;
  
  // Generate browser fingerprint (secondary)
  browserFingerprint = generateBrowserFingerprint();
  
  // Get or create session ID
  sessionId = getSessionId();
  
  // Store in localStorage for persistence
  localStorage.setItem('oizom_device_id', deviceId);
  localStorage.setItem('oizom_browser_fp', browserFingerprint);
  
  return { deviceId, browserFingerprint, sessionId };
}

// Generate browser fingerprint
function generateBrowserFingerprint() {
  const data = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchSupport: 'ontouchstart' in window,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory
  };
  
  // Create hash of browser characteristics
  const str = JSON.stringify(data);
  return simpleHash(str);
}

// Get or create session ID
function getSessionId() {
  let sid = sessionStorage.getItem('oizom_session_id');
  if (!sid) {
    sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('oizom_session_id', sid);
  }
  return sid;
}

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Get device identifiers
export async function getDeviceIdentifiers() {
  if (!deviceId) {
    await initializeDeviceId();
  }
  return {
    deviceId,
    browserFingerprint,
    sessionId,
    userAgent: navigator.userAgent
  };
}

// Check if device has voted for category (client-side check)
export async function hasVotedForCategory(categoryId) {
  const voted = localStorage.getItem(`oizom_voted_${categoryId}`);
  return voted === 'true';
}

// Mark category as voted (client-side)
export function markCategoryAsVoted(categoryId) {
  localStorage.setItem(`oizom_voted_${categoryId}`, 'true');
}
```

### Vote Submission with Duplicate Prevention

```javascript
// voteService.js

import { supabase } from './supabaseClient.js';
import { getDeviceIdentifiers, hasVotedForCategory, markCategoryAsVoted } from './deviceId.js';

async function submitVote(categoryId, option) {
  // Client-side check first (fast feedback)
  if (await hasVotedForCategory(categoryId)) {
    throw new Error('You have already voted for this category');
  }
  
  // Get device identifiers
  const identifiers = await getDeviceIdentifiers();
  
  // Check if category is unlocked
  const { data: category } = await supabase
    .from('categories')
    .select('unlocked')
    .eq('id', categoryId)
    .single();
  
  if (!category?.unlocked) {
    throw new Error('This category is not currently accepting votes');
  }
  
  // Submit vote with all identifiers
  const { data, error } = await supabase
    .from('votes')
    .insert({
      category_id: categoryId,
      option: option,
      device_id: identifiers.deviceId,
      browser_fingerprint: identifiers.browserFingerprint,
      session_id: identifiers.sessionId,
      user_agent: identifiers.userAgent,
      ip_address: null  // Could be captured via Supabase Edge Function if needed
    })
    .select();
  
  if (error) {
    if (error.code === '23505') {  // Unique constraint violation
      // Mark as voted locally even if DB says duplicate
      markCategoryAsVoted(categoryId);
      throw new Error('You have already voted for this category');
    }
    throw error;
  }
  
  // Mark as voted locally
  markCategoryAsVoted(categoryId);
  
  return data[0];
}
```

### Why This Approach Works

1. **Device Fingerprinting**: ~99.5% accurate for identifying unique devices, very difficult to spoof
2. **Multiple Identifiers**: Even if one layer is bypassed, others provide backup
3. **Database Constraint**: UNIQUE constraint on (category_id, device_id) provides final enforcement
4. **Client-Side Caching**: localStorage prevents unnecessary duplicate attempts
5. **User Agent Tracking**: Helps identify suspicious patterns

### Limitations and Mitigations

**Limitation**: Determined users could clear localStorage and use incognito mode
**Mitigation**: Device fingerprint persists across these actions

**Limitation**: Users could use different devices
**Mitigation**: Acceptable for internal company event (limited device access)

**Limitation**: Fingerprinting can be blocked by privacy tools
**Mitigation**: Fallback to browser fingerprint and session ID

### Additional Security Measures

**Rate Limiting** (optional, via Supabase Edge Function):
- Limit vote submissions to 1 per second per device
- Detect and block rapid-fire voting attempts

**Admin Monitoring**:
- Admin panel shows vote timestamps
- Can identify suspicious voting patterns
- Can manually invalidate votes if needed

This multi-layered approach provides robust duplicate prevention suitable for an internal awards ceremony while acknowledging that no client-side solution is 100% foolproof.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

- Properties 4.1 and 5.2 both test that votes contain user identifiers - these can be combined into a single comprehensive property about vote data completeness
- Properties 2.3 and 8.4 both test unlock status persistence - these represent the same underlying behavior
- Properties 4.4 and 8.3 both test vote persistence - these can be consolidated
- Properties 1.3 and 1.5 both verify category structure - combining these reduces duplication
- Vote count calculation (6.3) and display (6.1) can be tested together as they're interdependent

The following properties represent the unique, non-redundant correctness guarantees:

### Core Data Properties

**Property 1: Category data structure completeness**
*For any* category loaded by the system, it should contain an id, title, nominees object with keys A/B/C/D, and an unlocked boolean field.
**Validates: Requirements 1.1, 1.3**

**Property 2: All categories loaded on initialization**
*For any* system initialization with a valid data file, all 27 categories should be loaded into memory.
**Validates: Requirements 1.2**

### Unlock Management Properties

**Property 3: Unlock changes category status**
*For any* category, when an unlock operation is performed, the category's unlocked field should change to true.
**Validates: Requirements 2.2**

**Property 4: Single unlock invariant**
*For any* system state, the number of unlocked categories should be at most 1.
**Validates: Requirements 2.4**

**Property 5: Second unlock prevention**
*For any* system state where one category is already unlocked, attempting to unlock a different category should fail with an error.
**Validates: Requirements 2.5**

**Property 6: Unlock persistence round trip**
*For any* category, after unlocking it and reloading from the Vote_Store, the category should still have unlocked=true.
**Validates: Requirements 2.3, 8.4**

### API Behavior Properties

**Property 7: Unlocked categories filter**
*For any* system state, the GET /api/categories/unlocked endpoint should return only categories where unlocked=true.
**Validates: Requirements 3.2, 7.4**

**Property 8: Invalid data returns error codes**
*For any* API endpoint, when receiving invalid input data (missing fields, wrong types, invalid IDs), the response should have an HTTP error code (400, 404, or 500) and include an error message.
**Validates: Requirements 7.5**

### Vote Submission Properties

**Property 9: Vote data completeness**
*For any* successful vote submission, the stored vote should contain categoryId, option, userId, timestamp, and a unique id field.
**Validates: Requirements 4.1, 5.2**

**Property 10: Locked category vote rejection**
*For any* category where unlocked=false, attempting to submit a vote for that category should fail with an error response.
**Validates: Requirements 4.2**

**Property 11: Duplicate vote prevention**
*For any* user and category combination, if a vote already exists, submitting a second vote should fail and the original vote should remain unchanged.
**Validates: Requirements 4.3, 5.4**

**Property 12: Vote persistence round trip**
*For any* valid vote submission, after the submission succeeds, querying the Vote_Store should return a vote matching the submitted data.
**Validates: Requirements 4.4, 8.3**

### User Identification Properties

**Property 13: User ID generation**
*For any* call to getUserId(), the function should return a non-empty string identifier.
**Validates: Requirements 5.1**

**Property 14: Duplicate detection accuracy**
*For any* set of votes in the Vote_Store, the duplicate check function should return true if and only if a vote exists with matching userId and categoryId.
**Validates: Requirements 5.3**

**Property 15: Voted categories display**
*For any* user with N votes submitted, the User_Interface should mark exactly N categories as already voted.
**Validates: Requirements 5.5**

### Vote Counting Properties

**Property 16: Vote count accuracy**
*For any* category and option (A, B, C, or D), the calculated vote count should equal the number of votes in the Vote_Store with matching categoryId and option.
**Validates: Requirements 6.1, 6.3**

**Property 17: Admin vote count display**
*For any* category displayed in the Admin_Panel, the rendered vote counts for options A, B, C, and D should match the actual vote counts from the Vote_Store.
**Validates: Requirements 6.4**

**Property 18: Total votes calculation**
*For any* category, the total vote count should equal the sum of votes for options A, B, C, and D.
**Validates: Requirements 11.5**

### Data Persistence Properties

**Property 19: Complete data storage**
*For any* system state, the Vote_Store should contain all categories with their unlock statuses and all submitted votes.
**Validates: Requirements 8.1**

**Property 20: Data persistence round trip**
*For any* system state with N categories and M votes, after saving to Vote_Store and reloading, the system should have N categories and M votes with matching data.
**Validates: Requirements 8.2**

### UI State Properties

**Property 21: Progress indicator accuracy**
*For any* user who has voted for N categories, the progress indicator should display N.
**Validates: Requirements 9.4**

**Property 22: Touch target sizing**
*For any* interactive button element in the User_Interface, the computed width and height should each be at least 44 pixels.
**Validates: Requirements 10.5**

**Property 23: Category unlock status visual distinction**
*For any* category in the Admin_Panel, locked and unlocked categories should have different CSS class names or style attributes.
**Validates: Requirements 11.2**

**Property 24: Unlock button presence**
*For any* category displayed in the Admin_Panel, an unlock or lock button element should be present in the rendered HTML.
**Validates: Requirements 11.4**

### Error Handling Properties

**Property 25: Vote failure error messages**
*For any* failed vote submission, the User_Interface should display an error message element in the DOM.
**Validates: Requirements 12.2**

**Property 26: Error logging**
*For any* error that occurs in the backend, a log entry should be written to the console with error details.
**Validates: Requirements 12.5**

## Error Handling

### Client-Side Error Handling

**Supabase Errors:**
- Connection failures: Display "Connection lost" message, retry with exponential backoff
- Query errors: Display user-friendly error messages
- Timeout handling: 10-second timeout for all Supabase operations

**Validation Errors:**
- Missing user ID: Generate new ID and retry
- Invalid option selection: Disable submit button until valid option selected
- Already voted (UNIQUE constraint violation): Display "You've already voted for this category"
- Locked category: Display "This category is not currently accepting votes"

**UI Error States:**
```javascript
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  
  if (error.message?.includes('duplicate key')) {
    showErrorMessage('You have already voted for this category');
  } else if (error.message?.includes('not unlocked')) {
    showErrorMessage('This category is not currently accepting votes');
  } else if (error.code === 'PGRST116') {  // Supabase: no rows returned
    showErrorMessage('Category not found');
  } else {
    showErrorMessage('Something went wrong. Please try again.');
  }
}
```

### Supabase Error Codes

**Common Supabase Errors:**
- `23505`: Unique constraint violation (duplicate vote)
- `23503`: Foreign key violation (invalid category ID)
- `23514`: Check constraint violation (invalid option)
- `PGRST116`: No rows returned
- Network errors: Connection timeout or offline

**Error Response Handling:**
```javascript
async function submitVote(categoryId, option, userId) {
  try {
    const { data, error } = await supabase
      .from('votes')
      .insert({ category_id: categoryId, option, user_id: userId })
      .select();
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('You have already voted for this category');
      }
      throw error;
    }
    
    return data[0];
  } catch (error) {
    console.error('Vote submission error:', error);
    throw error;
  }
}
```

### Real-time Subscription Error Handling

**Subscription Failures:**
```javascript
const subscription = supabase
  .channel('categories-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, handleChange)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to real-time updates');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Subscription error, retrying...');
      setTimeout(() => subscription.subscribe(), 5000);
    }
  });
```

## Testing Strategy

### Dual Testing Approach

The Oizom Awards Night system will use both unit tests and property-based tests to ensure comprehensive correctness:

- **Unit tests**: Verify specific examples, edge cases, API contracts, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library Selection:**
- **JavaScript/Node.js**: Use `fast-check` library for property-based testing
- Installation: `npm install --save-dev fast-check`

**Test Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: oizom-awards-night, Property N: [property text]`

**Example Property Test Structure:**
```javascript
const fc = require('fast-check');

// Feature: oizom-awards-night, Property 16: Vote count accuracy
test('vote count equals number of matching votes', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        categoryId: fc.integer(1, 27),
        option: fc.constantFrom('A', 'B', 'C', 'D'),
        userId: fc.string(),
        timestamp: fc.date().map(d => d.toISOString())
      })),
      (votes) => {
        // Test that vote counting is accurate
        const categoryId = 1;
        const option = 'A';
        const expected = votes.filter(v => 
          v.categoryId === categoryId && v.option === option
        ).length;
        const actual = getVoteCounts(categoryId)[option];
        return actual === expected;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Strategy

**Focus Areas for Unit Tests:**
- API endpoint contracts (Requirements 7.1-7.4)
- Specific error conditions (locked category voting, duplicate votes)
- Edge cases (empty vote store, all categories locked)
- UI rendering for specific states (waiting state, voted state)
- Responsive design breakpoints (320px, 480px, 1024px)
- Integration between components

**Example Unit Test:**
```javascript
// Test specific example: voting for locked category returns error
test('voting for locked category returns 403 error', async () => {
  const category = { id: 1, unlocked: false };
  const vote = { categoryId: 1, option: 'A', userId: 'user123' };
  
  const response = await submitVote(vote);
  
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('CATEGORY_LOCKED');
});
```

### Test Coverage Goals

- **Backend API**: 90%+ code coverage
- **Vote Controller**: 100% coverage (critical business logic)
- **Category Controller**: 100% coverage (critical business logic)
- **Data Store**: 90%+ coverage
- **Frontend**: Focus on critical paths (vote submission, polling, error handling)

### Testing Execution

**Development:**
```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:property      # Run property-based tests only
npm run test:coverage      # Generate coverage report
```

**Continuous Integration:**
- Run all tests on every commit
- Fail build if any test fails
- Fail build if coverage drops below thresholds

### Manual Testing Checklist

While automated tests cover correctness properties, manual testing should verify:
- Visual design and awards night theme aesthetics
- Animation smoothness and celebratory effects
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Mobile device testing (actual devices, not just emulators)
- Admin panel usability during live event simulation
- Network resilience (test with throttled/interrupted connections)


## Deployment Guide

### Project Structure

```
oizom-awards-night/
├── index.html              # User voting interface (mobile)
├── admin.html              # Admin panel (desktop)
├── js/
│   ├── supabaseClient.js   # Supabase client initialization
│   ├── deviceId.js         # Device fingerprinting and identification
│   ├── categoryService.js  # Category operations
│   ├── voteService.js      # Vote operations
│   ├── user.js             # User interface logic
│   └── admin.js            # Admin panel logic
├── css/
│   ├── user.css            # User interface styles (mobile-first)
│   └── admin.css           # Admin panel styles
├── package.json            # Dependencies
└── README.md
```

### Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "@fingerprintjs/fingerprintjs": "^4.2.0"
  }
}
```

### Supabase Setup

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project (free tier)
   - Note your project URL and anon key

2. **Create Database Tables:**

Run these SQL commands in the Supabase SQL Editor:

```sql
-- Create categories table
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  nominees JSONB NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create votes table with device fingerprinting
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES categories(id),
  option TEXT NOT NULL CHECK (option IN ('A', 'B', 'C', 'D')),
  device_id TEXT NOT NULL,
  browser_fingerprint TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, device_id)
);

-- Create indexes
CREATE INDEX idx_votes_category ON votes(category_id);
CREATE INDEX idx_votes_device ON votes(device_id);
CREATE INDEX idx_votes_browser_fp ON votes(browser_fingerprint);
CREATE INDEX idx_categories_unlocked ON categories(unlocked);

-- Ensure only one category can be unlocked at a time
CREATE UNIQUE INDEX idx_single_unlocked ON categories(unlocked) WHERE unlocked = true;

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Anyone can view votes"
  ON votes FOR SELECT USING (true);

CREATE POLICY "Anyone can insert votes"
  ON votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update categories"
  ON categories FOR UPDATE USING (true);
```

3. **Insert Initial Data:**

```sql
-- Insert all 27 categories
INSERT INTO categories (id, title, nominees) VALUES
(1, 'FOODIE OF OIZOM', '{"A": "YASH CHAUHAN", "B": "AARSH PATEL", "C": "JAINAM MEHTA", "D": "PRIYANKA CHAKRAVORTY"}'),
(2, 'EVERYONE KNOWS THEM AWARD', '{"A": "SOHIL PATEL", "B": "JAINAM MEHTA", "C": "BHAVY SHAH", "D": "KAREENA SHARMA"}'),
(3, 'CAMERA READY ICON', '{"A": "HETANSHI GAJJAR", "B": "DRASHYA THAKKER", "C": "SHRUTI MATHUR", "D": "AJAY DUBEY"}'),
-- ... (continue for all 27 categories)
```

### Vercel Deployment

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Configure Environment Variables:**
   
   Create `.env` file (for local development):
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel
   ```

4. **Set Environment Variables in Vercel:**
   - Go to Vercel dashboard → Project Settings → Environment Variables
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

5. **Deploy:**
   ```bash
   vercel --prod
   ```

### Local Development

1. **Install Dependencies:**
   ```bash
   npm install @supabase/supabase-js @fingerprintjs/fingerprintjs
   ```

2. **Build (if using a bundler like Vite):**
   ```bash
   npm install -D vite
   npx vite
   ```

3. **Or run with simple HTTP server:**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx serve
   ```

4. **Access:**
   - User Interface: `http://localhost:8000/index.html` (test on mobile or use browser dev tools mobile view)
   - Admin Panel: `http://localhost:8000/admin.html`

### Configuration

**supabaseClient.js:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Advantages of This Architecture

1. **No Backend Server**: Direct frontend-to-Supabase communication
2. **Free Hosting**: Both Vercel and Supabase have generous free tiers
3. **Real-time Updates**: Built-in with Supabase subscriptions (no polling needed)
4. **Automatic Scaling**: Both platforms handle traffic spikes
5. **Simple Deployment**: Just push to Git or run `vercel`
6. **Database Management**: Supabase provides a nice UI for data management

### Cost

- **Supabase Free Tier**: 500MB database, 2GB bandwidth, unlimited API requests
- **Vercel Free Tier**: 100GB bandwidth, unlimited static hosting
- **Total Cost**: $0 for a single event with moderate traffic
