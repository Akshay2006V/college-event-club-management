// server/seed.js -- populates the database with realistic sample data
require('dotenv').config();
const { connect, getDb, close } = require('./config/db');

// Date helper: returns YYYY-MM-DD for a day relative to today.
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const clubs = [
  {
    name: 'Robotics & Innovation Club',
    category: 'Technical',
    description: 'A club for students passionate about robotics, automation and embedded systems.',
    coordinator: 'Dr. S. Raman',
    email: 'robotics@example.com',
    establishedYear: 2016,
    members: 62,
  },
  {
    name: 'Cultural Arts Club',
    category: 'Cultural',
    description: 'Promotes music, dance, drama and fine arts across the campus.',
    coordinator: 'Ms. Priya Menon',
    email: 'cultural@example.com',
    establishedYear: 2012,
    members: 95,
  },
  {
    name: 'Sports & Fitness Club',
    category: 'Sports',
    description: 'Organises intra-college tournaments and fitness activities.',
    coordinator: 'Mr. K. Aditya',
    email: 'sports@example.com',
    establishedYear: 2014,
    members: 120,
  },
  {
    name: 'Debate & Literary Club',
    category: 'Literary',
    description: 'Encourages public speaking, debate, writing and critical thinking.',
    coordinator: 'Dr. A. Fisher',
    email: 'debate@example.com',
    establishedYear: 2018,
    members: 40,
  },
  {
    name: 'Green Campus Club',
    category: 'Social Service',
    description: 'Leads sustainability drives, tree planting and cleanliness campaigns.',
    coordinator: 'Ms. L. Harika',
    email: 'green@example.com',
    establishedYear: 2020,
    members: 55,
  },
];

async function run() {
  try {
    const db = await connect();
    await db.collection('clubs').deleteMany({});
    await db.collection('events').deleteMany({});

    const insertedClubs = await db.collection('clubs').insertMany(clubs);
    const ids = insertedClubs.insertedIds;
    const [robotics, cultural, sports, debate, green] = Object.values(ids);

    const events = [
      {
        title: 'RoboFest 2026 - Line Follower Challenge',
        clubId: robotics,
        date: day(7),
        time: '10:00',
        venue: 'Mechanical Block, Lab 204',
        description: 'Inter-college line follower robot competition with prizes and workshops.',
        capacity: 80,
        status: 'Upcoming',
        registrations: 34,
      },
      {
        title: 'Garba & Cultural Night',
        clubId: cultural,
        date: day(14),
        time: '18:30',
        venue: 'College Grounds',
        description: 'An evening of music, dance and food celebrating cultural diversity.',
        capacity: 300,
        status: 'Upcoming',
        registrations: 142,
      },
      {
        title: 'Inter-Branch Cricket Tournament',
        clubId: sports,
        date: day(21),
        time: '08:00',
        venue: 'Sports Complex',
        description: 'T20 cricket tournament between branches. Register your team now.',
        capacity: 120,
        status: 'Upcoming',
        registrations: 67,
      },
      {
        title: 'National Level Debate Competition',
        clubId: debate,
        date: day(30),
        time: '09:30',
        venue: 'Seminar Hall A',
        description: 'Debate on current affairs and technology policy for national level selection.',
        capacity: 60,
        status: 'Upcoming',
        registrations: 22,
      },
      {
        title: 'Tree Plantation Drive',
        clubId: green,
        date: day(-5),
        time: '07:30',
        venue: 'Campus Main Gate',
        description: 'Student volunteers planted 200 saplings across the campus.',
        capacity: 100,
        status: 'Completed',
        registrations: 88,
      },
      {
        title: 'IoT Workshop for Beginners',
        clubId: robotics,
        date: day(3),
        time: '14:00',
        venue: 'Electronics Lab, Block B',
        description: 'Hands-on workshop on Arduino, sensors and basic IoT projects.',
        capacity: 45,
        status: 'Ongoing',
        registrations: 45,
      },
    ];

    await db.collection('events').insertMany(events);
    console.log(`Seeded ${clubs.length} clubs and ${events.length} events.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

run();
