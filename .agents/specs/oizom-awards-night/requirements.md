# Requirements Document: Oizom Awards Night

## Introduction

The Oizom Awards Night is an interactive voting system for a company awards ceremony featuring 27 award categories. The system provides two distinct interfaces: an admin panel for controlling question flow and viewing results, and a user voting interface for submitting votes. The system enables real-time vote tracking with sequential question unlocking to create an engaging awards night experience.

## Glossary

- **Admin_Panel**: Web interface used by event administrators to control question unlocking and view vote results
- **User_Interface**: Web interface used by attendees to view unlocked questions and submit votes
- **Award_Category**: A specific award with a title and four nominee options (A, B, C, D)
- **Vote_Submission**: A user's selection of one nominee for a specific award category
- **Unlock_Status**: Boolean state indicating whether an award category is visible to users
- **Vote_Store**: Backend storage mechanism (JSON file or in-memory) for persisting votes and question states
- **Polling_Mechanism**: Client-side technique for periodically checking server for updates
- **User_Identifier**: Unique identifier (session ID, IP, or device fingerprint) to prevent duplicate voting

## Requirements

### Requirement 1: Award Category Management

**User Story:** As an event administrator, I want to manage 27 predefined award categories with their nominees, so that I can control the voting flow during the awards night.

#### Acceptance Criteria

1. THE System SHALL store 27 award categories with their titles and four nominees each (options A, B, C, D)
2. WHEN the system initializes, THE System SHALL load all award categories from the data source
3. THE System SHALL maintain an unlock status for each award category
4. WHEN the system starts, THE System SHALL set all award categories to locked status by default
5. THE Admin_Panel SHALL display all 27 award categories with their current unlock status

### Requirement 2: Sequential Question Unlocking

**User Story:** As an event administrator, I want to unlock award categories one at a time, so that I can control the pace of the awards ceremony and maintain audience engagement.

#### Acceptance Criteria

1. WHEN an administrator selects an award category in the Admin_Panel, THE System SHALL provide an unlock action
2. WHEN an administrator unlocks an award category, THE System SHALL change that category's unlock status to true
3. WHEN an award category is unlocked, THE System SHALL persist the unlock status to the Vote_Store
4. THE System SHALL allow only one award category to be unlocked at a time
5. WHEN an award category is already unlocked, THE Admin_Panel SHALL prevent unlocking additional categories until the current one is locked again

### Requirement 3: Real-Time User Interface Updates

**User Story:** As an awards night attendee, I want to see newly unlocked questions appear automatically, so that I can participate in voting without manual page refreshes.

#### Acceptance Criteria

1. WHEN the User_Interface loads, THE System SHALL establish a polling mechanism that checks for updates every 2-3 seconds
2. WHEN a polling request is made, THE System SHALL return the current list of unlocked award categories
3. WHEN a new award category is unlocked, THE User_Interface SHALL display it within 3 seconds
4. WHEN no award categories are unlocked, THE User_Interface SHALL display a waiting state message
5. THE Polling_Mechanism SHALL continue running throughout the user session

### Requirement 4: Vote Submission and Validation

**User Story:** As an awards night attendee, I want to vote for my favorite nominee in each category, so that I can participate in selecting award winners.

#### Acceptance Criteria

1. WHEN a user selects a nominee option (A, B, C, or D), THE System SHALL record the vote with the award category ID, selected option, User_Identifier, and timestamp
2. WHEN a vote is submitted, THE System SHALL validate that the award category is currently unlocked
3. WHEN a user has already voted for a specific award category, THE System SHALL reject subsequent votes for that same category
4. WHEN a vote is successfully submitted, THE System SHALL persist it to the Vote_Store immediately
5. WHEN a vote is successfully submitted, THE User_Interface SHALL display a confirmation message with celebratory visual feedback

### Requirement 5: User Identification and Duplicate Prevention

**User Story:** As an event administrator, I want to prevent users from voting multiple times for the same category, so that voting results are fair and accurate.

#### Acceptance Criteria

1. WHEN a user first accesses the User_Interface, THE System SHALL generate or retrieve a unique User_Identifier
2. THE System SHALL associate each Vote_Submission with a User_Identifier
3. WHEN checking for duplicate votes, THE System SHALL query the Vote_Store for existing votes matching both the User_Identifier and award category ID
4. IF a duplicate vote is detected, THEN THE System SHALL return an error response and maintain the original vote
5. THE User_Interface SHALL display which categories the user has already voted for

### Requirement 6: Real-Time Vote Tracking and Display

**User Story:** As an event administrator, I want to view live vote counts for each nominee, so that I can monitor voting progress and announce winners.

#### Acceptance Criteria

1. WHEN the Admin_Panel displays an award category, THE System SHALL show the current vote count for each of the four nominee options
2. WHEN a new vote is submitted, THE Admin_Panel SHALL update the displayed vote counts within 3 seconds
3. THE System SHALL calculate vote counts by querying all Vote_Submissions for each award category
4. THE Admin_Panel SHALL display vote counts as numerical values for each option (A, B, C, D)
5. THE Admin_Panel SHALL update vote counts automatically through polling or real-time updates

### Requirement 7: Backend API Endpoints

**User Story:** As a system developer, I want RESTful API endpoints for all system operations, so that the frontend interfaces can interact with the backend services.

#### Acceptance Criteria

1. THE System SHALL provide a GET endpoint that returns all award categories with their unlock status and vote counts
2. THE System SHALL provide a POST endpoint that unlocks a specific award category by ID
3. THE System SHALL provide a POST endpoint that accepts vote submissions with award category ID, selected option, and User_Identifier
4. THE System SHALL provide a GET endpoint that returns unlocked award categories for the User_Interface
5. WHEN any endpoint receives invalid data, THE System SHALL return appropriate HTTP error codes (400, 404, 500) with descriptive error messages

### Requirement 8: Data Persistence

**User Story:** As an event administrator, I want all votes and system state to be persisted, so that data is not lost if the server restarts during the event.

#### Acceptance Criteria

1. THE System SHALL store all award categories, unlock statuses, and vote submissions in the Vote_Store
2. WHEN the system starts, THE System SHALL load existing data from the Vote_Store
3. WHEN a vote is submitted, THE System SHALL write it to the Vote_Store before returning a success response
4. WHEN an unlock status changes, THE System SHALL update the Vote_Store immediately
5. THE Vote_Store SHALL use either a JSON file or in-memory storage as configured

### Requirement 9: Awards Night Themed User Interface

**User Story:** As an awards night attendee, I want a visually appealing and celebratory interface, so that the voting experience matches the excitement of an awards ceremony.

#### Acceptance Criteria

1. THE User_Interface SHALL use an elegant color scheme appropriate for an awards night theme (gold, black, deep purple, or similar)
2. WHEN a user votes, THE User_Interface SHALL display celebratory animations (confetti, sparkles, or similar effects)
3. THE User_Interface SHALL display smooth transitions when new award categories appear
4. THE User_Interface SHALL show a progress indicator displaying how many categories the user has voted for
5. WHEN waiting for questions, THE User_Interface SHALL display an engaging waiting state with thematic graphics

### Requirement 10: Responsive Design

**User Story:** As an awards night attendee, I want to vote from any device, so that I can participate whether I'm using a phone, tablet, or computer.

#### Acceptance Criteria

1. THE User_Interface SHALL render correctly on mobile devices with screen widths from 320px to 480px
2. THE User_Interface SHALL render correctly on tablet devices with screen widths from 481px to 1024px
3. THE User_Interface SHALL render correctly on desktop devices with screen widths above 1024px
4. WHEN the viewport size changes, THE User_Interface SHALL adapt layout and font sizes appropriately
5. THE User_Interface SHALL ensure all interactive elements are easily tappable on touch devices (minimum 44x44px touch targets)

### Requirement 11: Admin Panel Interface

**User Story:** As an event administrator, I want a clear and functional admin panel, so that I can efficiently manage the awards ceremony flow.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display all 27 award categories in a list or grid format
2. THE Admin_Panel SHALL visually distinguish between locked and unlocked award categories
3. WHEN an award category is selected, THE Admin_Panel SHALL display detailed vote counts for all four nominees
4. THE Admin_Panel SHALL provide clear unlock/lock buttons for each award category
5. THE Admin_Panel SHALL display the total number of votes received for each award category

### Requirement 12: Error Handling and User Feedback

**User Story:** As a system user, I want clear feedback when errors occur, so that I understand what went wrong and what to do next.

#### Acceptance Criteria

1. WHEN a network error occurs during polling, THE User_Interface SHALL display a connection error message and continue retrying
2. WHEN a vote submission fails, THE User_Interface SHALL display an error message explaining the failure reason
3. WHEN a user attempts to vote for a locked category, THE System SHALL return an error and the User_Interface SHALL display an appropriate message
4. WHEN the Admin_Panel cannot connect to the backend, THE Admin_Panel SHALL display a connection status indicator
5. THE System SHALL log all errors to the server console for debugging purposes
