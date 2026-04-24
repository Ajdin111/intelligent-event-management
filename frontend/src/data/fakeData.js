export const currentUser = {
  name: 'Alex',
  role: 'Attendee',
  notificationCount: 2,
}

export const upcomingEvents = [
  {
    id: 1,
    title: 'AI & Machine Learning Summit 2026',
    date: 'April 15, 2026',
    locationType: 'Online',
    ticketTier: 'VIP Pass',
    spotsLeft: 45,
    image: 'https://picsum.photos/seed/sxsw/600/340',
  },
  {
    id: 2,
    title: 'Global Tech Conference',
    date: 'May 8, 2026',
    locationType: 'San Francisco, CA',
    ticketTier: 'Early Bird',
    spotsLeft: 120,
    image: 'https://picsum.photos/seed/techconf/600/340',
  },
  {
    id: 3,
    title: 'Startup Ecosystem Workshop',
    date: 'June 2, 2026',
    locationType: 'Hybrid',
    ticketTier: 'Standard',
    spotsLeft: 32,
    image: 'https://picsum.photos/seed/startup/600/340',
  },
]

export const recommendedEvents = [
  {
    id: 4,
    title: 'Code & Coffee Hackathon',
    date: 'April 20, 2026',
    locationType: 'Online',
    ticketTier: 'Free',
    spotsLeft: 200,
    recommended: true,
    image: 'https://picsum.photos/seed/hackathon/600/340',
  },
  {
    id: 5,
    title: 'Mathematics & Data Science Workshop',
    date: 'May 1, 2026',
    locationType: 'Berlin, Germany',
    ticketTier: 'Standard',
    spotsLeft: 15,
    recommended: true,
    image: 'https://picsum.photos/seed/mathws/600/340',
  },
]
