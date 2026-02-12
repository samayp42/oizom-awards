# Implementation Plan: Oizom Awards Night

## Overview

This implementation plan breaks down the Oizom Awards Night voting system into discrete coding tasks. The system uses vanilla HTML/CSS/JavaScript for the frontend and Supabase for the backend database. The implementation follows a mobile-first approach with real-time updates and robust duplicate vote prevention using device fingerprinting.

## Tasks

- [x] 1. Set up project structure and Supabase database
  - Create project directory structure with HTML, CSS, and JS folders
  - Initialize package.json and install dependencies (@supabase/supabase-js, @fingerprintjs/fingerprintjs)
  - Create Supabase project and note credentials
  - Run SQL scripts to create categories and votes tables with indexes and RLS policies
  - Insert all 27 award categories into the database
  - _Requirements: 1.1, 1.2, 8.1_

- [ ] 2. Implement Supabase client and device fingerprinting
  - [x] 2.1 Create Supabase client module (supabaseClient.js)
    - Initialize Supabase client with URL and anon key
    - Export client instance for use across the application
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 2.2 Implement device fingerprinting module (deviceId.js)
    - Initialize FingerprintJS and generate device ID
    - Implement browser fingerprinting function
    - Create session ID management with sessionStorage
    - Implement localStorage caching for device ID and voted categories
    - Create getDeviceIdentifiers() function returning all identifiers
    - Implement hasVotedForCategory() and markCategoryAsVoted() functions
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 2.3 Write property test for device ID generation
    - **Property 13: User ID generation**
    - **Validates: Requirements 5.1**
  
  - [ ]* 2.4 Write unit tests for device fingerprinting
    - Test device ID persistence across page reloads
    - Test session ID generation
    - Test voted category tracking in localStorage
    - _Requirements: 5.1, 5.5_

- [ ] 3. Implement category service layer
  - [x] 3.1 Create category service module (categoryService.js)
    - Implement getUnlockedCategory() to fetch the single unlocked category
    - Implement getAllCategoriesWithVotes() for admin panel
    - Implement unlockCategory(id) with single-unlock enforcement
    - Implement lockCategory(id) function
    - Implement getVoteCounts(categoryId) function
    - Implement subscribeToCategories(callback) for real-time updates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 6.1, 6.3_
  
  - [ ]* 3.2 Write property test for single unlock invariant
    - **Property 4: Single unlock invariant**
    - **Validates: Requirements 2.4**
  
  - [ ]* 3.3 Write property test for unlock persistence
    - **Property 6: Unlock persistence round trip**
    - **Validates: Requirements 2.3, 8.4**
  
  - [ ]* 3.4 Write unit tests for category service
    - Test unlocking a category changes its status
    - Test attempting to unlock second category fails
    - Test vote count calculation accuracy
    - _Requirements: 2.2, 2.5, 6.3_

- [x] 4. Checkpoint - Ensure database and services are working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement vote service layer
  - [x] 5.1 Create vote service module (voteService.js)
    - Implement submitVote(categoryId, option) with device fingerprinting
    - Add category unlock validation before vote submission
    - Implement duplicate vote detection and error handling
    - Implement hasUserVoted(categoryId, deviceId) function
    - Implement getUserVotes(deviceId) function
    - Implement subscribeToVotes(callback) for real-time vote updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4_
  
  - [ ]* 5.2 Write property test for vote data completeness
    - **Property 9: Vote data completeness**
    - **Validates: Requirements 4.1, 5.2**
  
  - [ ]* 5.3 Write property test for locked category vote rejection
    - **Property 10: Locked category vote rejection**
    - **Validates: Requirements 4.2**
  
  - [ ]* 5.4 Write property test for duplicate vote prevention
    - **Property 11: Duplicate vote prevention**
    - **Validates: Requirements 4.3, 5.4**
  
  - [ ]* 5.5 Write property test for vote persistence
    - **Property 12: Vote persistence round trip**
    - **Validates: Requirements 4.4, 8.3**
  
  - [ ]* 5.6 Write unit tests for vote service
    - Test vote submission with valid data succeeds
    - Test vote submission for locked category fails
    - Test duplicate vote submission fails
    - Test error handling for invalid options
    - _Requirements: 4.2, 4.3, 7.5_

- [ ] 6. Build user voting interface (mobile-first)
  - [x] 6.1 Create HTML structure (index.html)
    - Create mobile-optimized HTML with meta viewport tag
    - Add header with event title and progress indicator
    - Create waiting state container
    - Create category display container with nominee buttons
    - Add confirmation message container
    - Include Supabase and FingerprintJS scripts
    - _Requirements: 9.1, 10.1, 10.5_
  
  - [x] 6.2 Implement user interface styles (user.css)
    - Create awards night theme with elegant colors (gold, black, deep purple)
    - Style category card with large touch-friendly buttons (min 44x44px)
    - Implement mobile-first responsive design (320px-480px primary)
    - Add smooth transitions for category appearance
    - Style waiting state with animated loader
    - Create celebratory animation styles (confetti effect)
    - Style vote confirmation message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 6.3 Implement user interface logic (user.js)
    - Initialize device fingerprinting on page load
    - Fetch and display the currently unlocked category (or waiting state)
    - Subscribe to real-time category changes via Supabase
    - Implement vote button click handlers
    - Implement submitVote() with error handling and confirmation
    - Show celebratory animation on successful vote
    - Update progress indicator (X/27 voted)
    - Handle already-voted state display
    - Implement error message display
    - _Requirements: 3.1, 3.3, 4.1, 4.5, 5.5, 9.2, 9.4, 12.1, 12.2, 12.3_
  
  - [ ]* 6.4 Write property test for progress indicator accuracy
    - **Property 21: Progress indicator accuracy**
    - **Validates: Requirements 9.4**
  
  - [ ]* 6.5 Write property test for touch target sizing
    - **Property 22: Touch target sizing**
    - **Validates: Requirements 10.5**
  
  - [ ]* 6.6 Write unit tests for user interface
    - Test waiting state displays when no category unlocked
    - Test category displays when unlocked
    - Test vote confirmation appears after voting
    - Test already-voted indicator shows correctly
    - Test error messages display on vote failure
    - _Requirements: 3.4, 4.5, 12.2, 12.3_

- [x] 7. Checkpoint - Test user interface on mobile device
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Build admin panel interface
  - [x] 8.1 Create HTML structure (admin.html)
    - Create admin panel HTML with category list layout
    - Add category cards with unlock/lock buttons
    - Create vote count display sections for each category
    - Add connection status indicator
    - Include Supabase script
    - _Requirements: 11.1, 11.4, 12.4_
  
  - [x] 8.2 Implement admin panel styles (admin.css)
    - Style category list/grid layout
    - Create visual distinction for locked vs unlocked categories
    - Style unlock/lock buttons
    - Create vote count displays (bar charts or numbers)
    - Style connection status indicator
    - Make responsive for desktop screens
    - _Requirements: 11.2, 11.3_
  
  - [x] 8.3 Implement admin panel logic (admin.js)
    - Fetch all categories with vote counts on page load
    - Subscribe to real-time category and vote changes
    - Implement unlock button click handler
    - Implement lock button click handler
    - Update vote counts in real-time when votes come in
    - Display total votes per category
    - Handle connection errors and display status
    - _Requirements: 2.1, 2.2, 6.1, 6.2, 11.3, 11.5, 12.4_
  
  - [ ]* 8.4 Write property test for vote count accuracy
    - **Property 16: Vote count accuracy**
    - **Validates: Requirements 6.1, 6.3**
  
  - [ ]* 8.5 Write property test for admin vote count display
    - **Property 17: Admin vote count display**
    - **Validates: Requirements 6.4**
  
  - [ ]* 8.6 Write property test for total votes calculation
    - **Property 18: Total votes calculation**
    - **Validates: Requirements 11.5**
  
  - [ ]* 8.7 Write property test for category unlock status visual distinction
    - **Property 23: Category unlock status visual distinction**
    - **Validates: Requirements 11.2**
  
  - [ ]* 8.8 Write unit tests for admin panel
    - Test all 27 categories display
    - Test unlock button unlocks category
    - Test lock button locks category
    - Test vote counts update when votes submitted
    - Test connection status indicator shows on error
    - _Requirements: 11.1, 2.2, 6.2, 12.4_

- [ ] 9. Implement error handling and user feedback
  - [x] 9.1 Add comprehensive error handling to vote service
    - Handle Supabase connection errors with retry logic
    - Handle duplicate vote errors (23505 code)
    - Handle locked category errors
    - Handle invalid option errors
    - Implement error logging to console
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  
  - [x] 9.2 Add error handling to category service
    - Handle Supabase connection errors
    - Handle unlock/lock operation failures
    - Implement error logging
    - _Requirements: 12.4, 12.5_
  
  - [ ]* 9.3 Write property test for vote failure error messages
    - **Property 25: Vote failure error messages**
    - **Validates: Requirements 12.2**
  
  - [ ]* 9.4 Write property test for error logging
    - **Property 26: Error logging**
    - **Validates: Requirements 12.5**
  
  - [ ]* 9.5 Write unit tests for error handling
    - Test network error displays connection message
    - Test duplicate vote displays appropriate message
    - Test locked category vote displays error
    - Test errors are logged to console
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [ ] 10. Create deployment configuration
  - [x] 10.1 Create environment configuration
    - Create .env.example file with Supabase URL and key placeholders
    - Update supabaseClient.js to use environment variables
    - Create README.md with setup instructions
    - _Requirements: 8.1, 8.2_
  
  - [-] 10.2 Configure for Vercel deployment
    - Create vercel.json if needed for routing
    - Document environment variable setup in Vercel
    - Test deployment to Vercel
    - _Requirements: 8.1, 8.2_
  
  - [ ]* 10.3 Write integration tests
    - Test complete vote flow from user interface to database
    - Test real-time updates from admin unlock to user display
    - Test duplicate prevention across page reloads
    - _Requirements: 3.3, 4.1, 4.3, 5.4_

- [ ] 11. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations each
- Unit tests validate specific examples and edge cases
- The system is mobile-first - test on actual mobile devices or browser dev tools
- Device fingerprinting provides robust duplicate prevention
- Real-time updates via Supabase subscriptions eliminate need for polling
