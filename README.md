# College Event & Club Management System

A full-stack web application for managing student clubs and campus events. It combines a
vanilla HTML/CSS/JavaScript front end with a Node.js + Express API and MongoDB, and covers
the complete Create / Read / Update / Delete workflow plus event registration.

The project uses all four core web technologies:

| Technology | How it is used here |
|---|---|
| **HTML** | Semantic pages: dashboard, clubs, events and accessible forms |
| **CSS** | One external stylesheet, consistent theme, responsive layout (mobile + desktop) |
| **JavaScript** | DOM updates, modals, client-side validation, toasts, fetch calls to the API |
| **MongoDB** | Two collections (`clubs`, `events`) with full Create / Read / Update / Delete |

A **Node.js + Express** server sits between the browser and MongoDB (browser JavaScript cannot
connect to MongoDB directly and must never hold database credentials).

## Preview

![EventHub dashboard](docs/screenshots/dashboard.jpg)

The events page, with status filters, seat tracking and registration:

![Events page](docs/screenshots/events.jpg)

---

## 1. Features

- Dashboard with a featured-event billboard, live counts (clubs, events, registrations, upcoming events) and event/club shelves.
- **Clubs:** create, view, edit, delete; category filter and search; coordinator and member details.
- **Events:** create, view, edit, delete; linked to a club via `$lookup`; search and status filter
  (Upcoming / Ongoing / Completed).
- **Registration:** students can register for an event; the count is capped at capacity
  using an atomic MongoDB update.
- Deleting a club also removes its events (keeps data consistent).
- JavaScript validation on every form plus server-side validation as a second line of defence.
- Clear success / error toasts and friendly "record not found" messages.
- Realistic sample data via a seed script.

---

## 2. Folder structure

```
college-event-club-management/
├── package.json            # dependencies and npm scripts
├── .env.example            # template for configuration (copy to .env)
├── .gitignore              # keeps node_modules and .env out of version control
├── README.md               # this file
├── server/
│   ├── server.js           # Express app entry point
│   ├── config/db.js        # MongoDB connection (single shared client)
│   ├── utils.js            # validation / response helpers
│   ├── seed.js             # sample data loader
│   └── routes/
│       ├── dashboard.js    # summary statistics endpoint
│       ├── clubs.js        # CRUD for clubs collection
│       └── events.js       # CRUD + registration for events collection
└── public/
    ├── index.html          # dashboard
    ├── clubs.html          # clubs page
    ├── events.html         # events page
    ├── css/style.css       # all styling (responsive)
    └── js/
        ├── common.js       # toast, api(), validation & date helpers
        ├── dashboard.js    # dashboard logic
        ├── clubs.js        # clubs page logic
        └── events.js       # events page logic
```

---

## 3. Setup and run

### Prerequisites
- **Node.js 18+** and npm — <https://nodejs.org>
- A **MongoDB Atlas** account (free M0 cluster) — <https://www.mongodb.com/atlas>

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a MongoDB Atlas cluster**
   - Sign up and create a free M0 cluster.
   - Database Access → Add a database user (save the password).
   - Network Access → Add IP address → `0.0.0.0/0` (allow access from anywhere).
   - Database → Connect → Drivers → Node.js → copy the connection string.

3. **Configure environment**
   - Copy `.env.example` to a new file named `.env`.
   - Replace `<username>` and `<password>` in `MONGODB_URI` with your Atlas user.
   - Example:
     ```
     PORT=5000
     MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     DB_NAME=college_events
     ```
   - ⚠️ **Never commit the `.env` file.** It is git-ignored and contains your credentials.

4. **Load sample data (optional but recommended)**
   ```bash
   npm run seed
   ```

5. **Start the server**
   ```bash
   npm start
   ```
   Then open **<http://localhost:5000>** in your browser.
   (Use `npm run dev` for auto-restart while developing.)

---

## 4. Database design

**Collection: `clubs`**
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `name` | String | Required |
| `category` | String | Technical / Cultural / Sports / Literary / … |
| `description` | String | |
| `coordinator` | String | Required |
| `email` | String | Required, validated |
| `establishedYear` | Number | |
| `members` | Number | |
| `createdAt`, `updatedAt` | Date | |

**Collection: `events`**
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `title` | String | Required |
| `clubId` | ObjectId (stored as String) | Reference to `clubs._id` |
| `date`, `time` | String | ISO date / HH:MM |
| `venue` | String | Required |
| `description` | String | |
| `capacity` | Number | Must be > 0 |
| `registrations` | Number | Incremented on registration |
| `participants` | Array | `{ name, email, registeredAt }` |
| `status` | String | Upcoming / Ongoing / Completed |

Events are joined with their club using an aggregation `$lookup` in `GET /api/events`.

---

## 5. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Counts and upcoming events |
| GET | `/api/clubs` | List clubs |
| GET | `/api/clubs/:id` | Get one club |
| POST | `/api/clubs` | Create club |
| PUT | `/api/clubs/:id` | Update club |
| DELETE | `/api/clubs/:id` | Delete club (and its events) |
| GET | `/api/events` | List events (with club name) |
| GET | `/api/events/:id` | Get one event |
| POST | `/api/events` | Create event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| POST | `/api/events/:id/register` | Register a participant |

---

## 6. Sample test cases

| # | Test | Input | Expected result | Actual result |
|---|---|---|---|---|
| 1 | Add club with empty name | name = "" | Error toast, no record saved | Pass |
| 2 | Add club with invalid email | email = "abc" | "Enter a valid email address." | Pass |
| 3 | Add valid club | all required fields filled | "Club created successfully." | Pass |
| 4 | Edit club | change members to 80 | Club card shows 80 members | Pass |
| 5 | Delete club | confirm delete | Club removed; linked events removed | Pass |
| 6 | Add event with no club selected | clubId = "" | "Please select an organising club." | Pass |
| 7 | Add event with capacity 0 | capacity = 0 | "Capacity must be greater than zero." | Pass |
| 8 | Add valid event | title, club, date, venue, capacity | "Event created successfully." | Pass |
| 9 | Register participant | valid name + email | Count increases by 1 | Pass |
| 10 | Register when event is full | registrations = capacity | "This event is full." | Pass |
| 11 | Fetch deleted record | GET /api/clubs/:id (deleted) | 404 "Club not found." | Pass |
| 12 | Status filter | select "Completed" | Only completed events shown | Pass |

These checks are automated in `tests/api-smoke-test.js`; run `npm run test:api` while the
server is running to reproduce the results.

---

## 7. Troubleshooting

- **"MONGODB_URI is missing or still a placeholder"** → you haven't created `/ edited `.env` properly.
- **"Cannot reach the server"** → run `npm start` and keep the terminal open.
- **Atlas connection times out** → add `0.0.0.0/0` to Network Access, and check the username/password.
- **Port already in use** → change `PORT` in `.env` (e.g. 5001) and open that port in the browser.

---

## 8. External references

- Express.js documentation — <https://expressjs.com>
- MongoDB Node.js driver — <https://www.mongodb.com/docs/drivers/node/current/>
- MongoDB Atlas — <https://www.mongodb.com/atlas>
- MDN Web Docs (HTML / CSS / JavaScript) — <https://developer.mozilla.org>

---

## License

© 2026 Akshay Vankayala. All rights reserved.

This project and its source code are the property of Akshay Vankayala. See
[LICENSE](LICENSE) for the full copyright notice.
