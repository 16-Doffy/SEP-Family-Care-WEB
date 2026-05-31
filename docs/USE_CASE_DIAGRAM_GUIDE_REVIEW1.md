# Family Care — Use Case Diagram Guide after Review 1

## 1. System boundary
Name the system boundary:

**Family Care Platform**

Do not put database, Docker, UI pages, or internal services as actors inside the boundary. They belong to architecture/deployment diagrams.

## 2. Main actors
Use these actors:

1. **Guest / Onboarding User**
2. **Family Manager**
3. **Family Member**
4. **Admin**
5. **Payment Gateway** external system
6. **Notification Service** external system
7. **AI Service** external system
8. **Wearable / GPS Device** external device

### Note about Deputy Member
Deputy Member should not be drawn as a separate main actor. It is a Family Member who receives delegated permissions from Family Manager.

Represent it as:

- Use case: **Grant Deputy Permission**
- Use case: **Revoke Deputy Permission**
- Note: `Deputy Member is a Family Member with delegated permissions.`

## 3. Use case groups

### A. Authentication & workspace setup
Actor: Guest / Onboarding User

- Register Account
- Login / Logout
- Reset Password
- Create Family Workspace
- Select Subscription Plan
- Join Family Workspace

Recommended relationships:

- `Create Family Workspace` <<include>> `Select Subscription Plan`
- `Join Family Workspace` <<include>> `Validate Invitation Code`

### B. Family & permission management
Actor: Family Manager

- Manage Family Profile
- Invite Member
- Remove Member
- Assign Member Role
- Grant Deputy Permission
- Revoke Deputy Permission
- Configure Member Profile

Recommended relationships:

- `Manage Family Members` can be a parent use case that includes `Invite Member`, `Remove Member`, and `Assign Member Role`.

### C. Finance / Family Fund / Budget planning
Actors: Family Manager, Family Member, Payment Gateway, AI Service

Use **Family Fund / Internal Ledger**, not real e-wallet wording.

Family Manager:

- Set Family Budget Plan
- Manage Expense Categories
- Record Shared Expense
- Approve / Reject Money Request
- View Plan vs Actual Report
- View Budget Warning
- Request AI Finance Prediction

Family Member:

- View Personal Wallet / Ledger
- View Transaction History
- Request Money
- Record Personal Expense
- Declare Personal Income / Financial Profile

Payment Gateway:

- Process Payment / Top-up Request
- Send Payment Confirmation / Webhook

AI Service:

- Generate Finance Prediction
- Suggest Saving Plan
- Classify Essential / Non-essential Expenses

Recommended relationships:

- `Request Money` -> Family Manager `Approve / Reject Money Request`
- `Request AI Finance Prediction` <<include>> `View Plan vs Actual Report`
- `Generate Finance Prediction` <<extend>> `View Plan vs Actual Report`

### D. Task & reward management
Actors: Family Manager, Family Member, Notification Service

Family Manager:

- Create Task
- Assign Task
- Create Recurring Task
- Approve / Reject Task Completion
- Configure Reward

Family Member:

- View Assigned Tasks
- Submit Task Completion Evidence
- Receive Reward

Notification Service:

- Send Task Notification
- Send Reward Notification

Recommended relationships:

- `Approve Task Completion` <<include>> `Credit Reward`
- `Create Recurring Task` <<extend>> `Create Task`

### E. SOS, wearable, GPS and safety tracking
Actors: Family Manager, Family Member, Wearable / GPS Device, Notification Service

Family Manager:

- Pair Wearable / GPS Device
- Configure SOS Settings
- View Member Route History
- View Movement Habit Analysis

Family Member:

- Trigger SOS from Mobile App
- Share Location
- View SOS Alert

Wearable / GPS Device:

- Trigger SOS from Wearable
- Send Fall Detection Signal
- Send Location Data
- Record Movement Route

Notification Service:

- Send SOS Alert Notification

Recommended relationships:

- `Trigger SOS from Wearable` <<include>> `Send Location Data`
- `Send Fall Detection Signal` <<extend>> `Trigger SOS from Wearable`
- `View Movement Habit Analysis` <<include>> `View Member Route History`
- `Send SOS Alert Notification` <<include>> `Trigger SOS from Mobile App` or `Trigger SOS from Wearable`

### F. Album & AI face classification
Actors: Family Manager, Family Member, AI Service

Family Manager:

- Create Album Category
- Edit / Delete Album Category
- Configure Album Classification Criteria

Family Member:

- Upload Photo / Video
- Assign Media to Category
- Confirm AI Face Tag
- View Shared Album
- Delete Own Media

AI Service:

- Suggest Face Tags
- Suggest Album Category

Recommended relationships:

- `Upload Photo / Video` <<include>> `Assign Media to Category` only if category is required.
- `Confirm AI Face Tag` <<extend>> `Suggest Face Tags`.

### G. Communication, calendar and AI assistant
Actors: Family Manager, Family Member, Notification Service, AI Service

All members:

- Group Chat
- Private Chat
- Manage / View Family Calendar
- Receive Calendar Reminder
- Ask AI Assistant

Notification Service:

- Send Push Notification
- Send Calendar Reminder

AI Service:

- Generate AI Response / Recommendation

### H. Admin system
Actor: Admin

- Manage Subscription Plans
- Manage Family Workspaces
- Manage Accounts
- View Subscription Summary
- View Revenue Statistics
- View Service Status
- View Provisioning Logs
- Lock / Unlock Account

Recommended relationship:

- `Manage Family Workspaces` can include `View Workspace Status` and `Lock / Unlock Account`.

## 4. Suggested diagram layout

Left side actors:

- Guest / Onboarding User
- Family Manager
- Family Member

Right side external systems:

- Payment Gateway
- Notification Service
- AI Service
- Wearable / GPS Device

Top actor:

- Admin

Inside the system boundary, group use cases into packages:

1. Authentication & Workspace
2. Family & Permission
3. Finance & Budget
4. Task & Reward
5. SOS & Device Tracking
6. Album & AI Classification
7. Communication & Calendar
8. Admin Management

## 5. What to avoid

- Do not draw Deputy Member as a separate main actor.
- Do not put Docker Infrastructure in the use case diagram unless the diagram is specifically for Admin/Deployment. Docker belongs better to deployment diagram.
- Do not use “real e-wallet” wording. Use “Family Fund”, “Internal Ledger”, or “Allowance Record”.
- Do not put implementation details like database tables, React pages, API endpoints, or Prisma models into the use case diagram.
