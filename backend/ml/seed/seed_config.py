# ─── Seed Configuration ───────────────────────────────────────────────────────
# All constants and distributions used by seed_data.py.
# Tweak these values to change the shape of the generated data.

import random
from datetime import datetime, timedelta

# ─── Volume ───────────────────────────────────────────────────────────────────

N_USERS         = 120
N_ORGANIZERS    = 10
N_EVENTS        = 80
N_CATEGORIES    = 8

# Reviews are generated per confirmed registration — this is the probability
# that a confirmed attendee of a past event leaves a review.
REVIEW_RATE     = 0.65

# ─── Categories ───────────────────────────────────────────────────────────────

CATEGORIES = [
    {"name": "AI & Machine Learning", "description": "Artificial intelligence and ML events"},
    {"name": "Web Development",       "description": "Frontend, backend and fullstack events"},
    {"name": "Cloud & DevOps",        "description": "Infrastructure, CI/CD and cloud platforms"},
    {"name": "Cybersecurity",         "description": "Security, privacy and ethical hacking"},
    {"name": "Data Science",          "description": "Data engineering, analytics and visualization"},
    {"name": "Product & Design",      "description": "UX, product management and design systems"},
    {"name": "Startup & Business",    "description": "Entrepreneurship, funding and growth"},
    {"name": "Networking",            "description": "Professional networking and community events"},
]

# ─── Event Templates ──────────────────────────────────────────────────────────
# Each template defines the "personality" of events in that category.
# fill_rate_range: how much of capacity typically gets filled (min, max)
# price_range:     ticket price in USD (0 = free tier exists)
# capacity_range:  event capacity

EVENT_TEMPLATES = {
    "AI & Machine Learning": {
        "fill_rate_range": (0.70, 0.98),
        "price_range":     (99, 499),
        "capacity_range":  (100, 600),
        "location_types":  ["physical", "online", "hybrid"],
        "location_weights":[0.3, 0.5, 0.2],
        "titles": [
            "AI & ML Summit",
            "Machine Learning Conference",
            "Deep Learning Workshop",
            "LLM Engineering Day",
            "Vector Search Summit",
            "MLOps Conference",
            "AI Product Workshop",
            "Generative AI Summit",
        ],
    },
    "Web Development": {
        "fill_rate_range": (0.55, 0.90),
        "price_range":     (0, 299),
        "capacity_range":  (80, 400),
        "location_types":  ["physical", "online", "hybrid"],
        "location_weights":[0.4, 0.4, 0.2],
        "titles": [
            "React & Frontend Summit",
            "Full Stack Conference",
            "JavaScript Days",
            "Web Performance Workshop",
            "CSS & Design Systems Day",
            "Node.js Conference",
            "TypeScript Summit",
            "Web3 Developer Day",
        ],
    },
    "Cloud & DevOps": {
        "fill_rate_range": (0.60, 0.95),
        "price_range":     (149, 599),
        "capacity_range":  (100, 500),
        "location_types":  ["physical", "online", "hybrid"],
        "location_weights":[0.3, 0.5, 0.2],
        "titles": [
            "CloudNative Conference",
            "DevOps Summit",
            "Kubernetes Day",
            "Platform Engineering Conf",
            "SRE & Reliability Summit",
            "GitOps Conference",
            "FinOps Summit",
            "Infrastructure as Code Day",
        ],
    },
    "Cybersecurity": {
        "fill_rate_range": (0.65, 0.95),
        "price_range":     (99, 399),
        "capacity_range":  (80, 300),
        "location_types":  ["physical", "online"],
        "location_weights":[0.5, 0.5],
        "titles": [
            "Zero Trust World",
            "AppSec Conference",
            "Red Team Summit",
            "Security Engineering Day",
            "Threat Intelligence Conf",
            "Pentesting Workshop",
            "Cloud Security Summit",
            "DevSecOps Day",
        ],
    },
    "Data Science": {
        "fill_rate_range": (0.60, 0.92),
        "price_range":     (99, 449),
        "capacity_range":  (100, 500),
        "location_types":  ["physical", "online", "hybrid"],
        "location_weights":[0.35, 0.45, 0.2],
        "titles": [
            "Data Engineering Summit",
            "Analytics Conference",
            "dbt & Lakehouse Days",
            "Data Platform Conference",
            "Streaming Data Summit",
            "DataOps Conference",
            "BI & Visualization Day",
            "Open Data Workshop",
        ],
    },
    "Product & Design": {
        "fill_rate_range": (0.50, 0.85),
        "price_range":     (0, 349),
        "capacity_range":  (60, 300),
        "location_types":  ["physical", "online", "hybrid"],
        "location_weights":[0.5, 0.3, 0.2],
        "titles": [
            "Product Craft Summit",
            "UX Research Conference",
            "Design Systems Day",
            "Interface Conference",
            "Product Management Summit",
            "Figma & Design Tools Day",
            "Growth & Retention Conf",
            "Service Design Summit",
        ],
    },
    "Startup & Business": {
        "fill_rate_range": (0.45, 0.85),
        "price_range":     (0, 199),
        "capacity_range":  (50, 250),
        "location_types":  ["physical", "hybrid"],
        "location_weights":[0.7, 0.3],
        "titles": [
            "Startup Founders Summit",
            "Early Stage Conference",
            "Venture & Growth Day",
            "B2B SaaS Conference",
            "Founder Networking Night",
            "Pitch Competition",
            "Product-Market Fit Workshop",
            "Fundraising Masterclass",
        ],
    },
    "Networking": {
        "fill_rate_range": (0.40, 0.80),
        "price_range":     (0, 49),
        "capacity_range":  (30, 150),
        "location_types":  ["physical"],
        "location_weights":[1.0],
        "titles": [
            "Tech Networking Night",
            "Developer Mixer",
            "Women in Tech Meetup",
            "Founders Happy Hour",
            "Remote Worker Meetup",
            "Career Fair & Networking",
            "Community Hack Night",
            "Open Source Meetup",
        ],
    },
}

# ─── Sentiment Templates ──────────────────────────────────────────────────────
# Realistic review comments per sentiment class.
# Used to generate training data for the sentiment model.

POSITIVE_COMMENTS = [
    "Absolutely loved this event. The speakers were top-notch and incredibly insightful.",
    "One of the best conferences I have attended. Learned so much and met great people.",
    "Fantastic organization and amazing content. Will definitely come back next year.",
    "The workshops were hands-on and practical. Exactly what I needed.",
    "Incredible lineup of speakers. Every session was worth attending.",
    "Well organized, great venue, and the networking opportunities were excellent.",
    "Best event of the year for me. The content was cutting edge and very relevant.",
    "Exceeded my expectations in every way. Highly recommend to anyone in the field.",
    "The quality of talks was outstanding. I left with actionable insights.",
    "Really well put together. The team did a fantastic job with everything.",
    "Great mix of technical depth and practical advice. Loved every session.",
    "The speakers were world-class and the community was warm and welcoming.",
    "This event is a must-attend. Everything from registration to the closing keynote was smooth.",
    "I came expecting good content and got exceptional content. Very happy I attended.",
    "Phenomenal event. The workshops alone were worth the ticket price.",
    "Super valuable networking. Made connections that will last years.",
    "Loved the format — a great balance between talks and interactive sessions.",
    "The content was extremely relevant to my work. Already applying what I learned.",
    "Outstanding event from start to finish. The team clearly put in a lot of effort.",
    "Brilliant speakers, great venue, and a wonderful community. Highly recommended.",
    "I have been attending this event for three years and it keeps getting better.",
    "Every session I attended was high quality. No filler content at all.",
    "The live demos and hands-on labs were fantastic. Very practical and useful.",
    "Great event with a strong focus on real-world applications. Loved it.",
    "The agenda was perfectly balanced. Something for everyone at every level.",
]

NEUTRAL_COMMENTS = [
    "Decent event overall. Some sessions were great, others felt a bit average.",
    "Good conference but nothing that really blew me away. Worth attending.",
    "Okay experience. The venue was nice but some talks ran over time.",
    "Mixed feelings. A few sessions were excellent but others were too basic.",
    "Not bad. I learned a few things but expected more depth in the workshops.",
    "Pretty standard conference experience. Good but not outstanding.",
    "Some talks were really good and some felt repetitive. Average overall.",
    "The event was fine. Registration was smooth but the content was hit or miss.",
    "It was okay. A couple of talks stood out but most were fairly standard.",
    "Reasonable event. The catering was good but the sessions could be deeper.",
    "Average experience. I have been to better events in this space.",
    "The event had its moments but overall felt a bit uneven.",
    "Decent lineup but a few sessions were clearly under-prepared.",
    "Not the best event I have attended but not the worst either. It was fine.",
    "Some good networking opportunities but the technical content was too shallow.",
    "The morning sessions were great but the afternoon felt rushed and thin.",
    "An okay event. Worth attending once but probably not again.",
    "Good effort from the organizers. A few rough edges but generally fine.",
    "The keynote was strong but the breakout sessions were inconsistent.",
    "Middling experience. The venue was great but the content needed more polish.",
]

NEGATIVE_COMMENTS = [
    "Very disappointed. The sessions were too shallow and felt like sales pitches.",
    "Not worth the ticket price. Most talks were generic and surface-level.",
    "Poor organization. Rooms were overcrowded and the schedule kept slipping.",
    "Expected much more. The content was outdated and the speakers underprepared.",
    "Would not recommend. The venue was too small and the wifi was unusable.",
    "Frustrating experience. Sessions ran late and the audio quality was terrible.",
    "Very basic content. Nothing I could not find in a 10-minute blog post.",
    "The event felt poorly planned. Long queues, disorganized sessions, and weak content.",
    "A lot of hype but little substance. Most sessions were thinly veiled ads.",
    "Disappointing overall. The agenda was misleading about what would actually be covered.",
    "The technical level was far too low for the advertised audience.",
    "Not what was promised. The workshops were cut short and the speakers were unprepared.",
    "I left after the second session. The quality was just not there.",
    "Overpriced for what it delivered. Very generic content across the board.",
    "Chaotic organization and weak speakers. Hard to recommend to anyone.",
    "The event was way too crowded and the session rooms were far too small.",
    "Terrible experience. Poor sound, bad lighting, and content that felt recycled.",
    "The organizers clearly did not vet the speakers. Most talks were a waste of time.",
    "Nothing actionable or insightful. I have seen better free meetups.",
    "Very underwhelming. I expected depth and got a surface-level overview of everything.",
]

# ─── Location Data ────────────────────────────────────────────────────────────

PHYSICAL_LOCATIONS = [
    "San Francisco, CA",
    "New York, NY",
    "Austin, TX",
    "Seattle, WA",
    "Boston, MA",
    "Chicago, IL",
    "Los Angeles, CA",
    "Amsterdam, NL",
    "Berlin, DE",
    "London, UK",
    "Toronto, CA",
    "Singapore, SG",
]

ONLINE_LINKS = [
    "https://zoom.us/j/teqevent",
    "https://meet.google.com/teqevent",
    "https://teams.microsoft.com/teqevent",
    "https://hopin.com/teqevent",
    "https://streamyard.com/teqevent",
]

# ─── User Name Data ───────────────────────────────────────────────────────────

FIRST_NAMES = [
    "Alice", "Bob", "Carol", "David", "Emma", "Frank", "Grace", "Henry",
    "Isabella", "James", "Karen", "Liam", "Mia", "Noah", "Olivia", "Paul",
    "Quinn", "Rachel", "Samuel", "Tara", "Uma", "Victor", "Wendy", "Xander",
    "Yara", "Zane", "Sofia", "Lucas", "Ava", "Ethan", "Chloe", "Mason",
    "Lily", "Logan", "Ella", "Aiden", "Zoe", "Jackson", "Nora", "Carter",
    "Hannah", "Owen", "Layla", "Caleb", "Riley", "Dylan", "Aria", "Ryan",
    "Scarlett", "Nathan", "Penelope", "Isaac", "Aurora", "Hunter", "Stella",
    "Christian", "Maya", "Connor", "Leah", "Evan", "Violet", "Aaron",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Chen", "Park", "Kim", "Patel", "Shah", "Kumar",
]

# ─── Date Ranges ──────────────────────────────────────────────────────────────

# Past events: used for demand forecasting training (we know final registration counts)
# Future events: used for live forecast demo
PAST_EVENT_RATIO  = 0.75   # 75% of events are in the past (closed)
FUTURE_EVENT_RATIO = 0.25  # 25% are upcoming (published, open for registration)

# How far back/forward to spread events
PAST_DAYS_RANGE   = 365    # up to 1 year ago
FUTURE_DAYS_RANGE = 180    # up to 6 months from now

# ─── Registration Timing ──────────────────────────────────────────────────────
# Simulates the registration velocity curve:
# Most registrations happen close to the event (last 2 weeks)
# and right after publishing (first week).
EARLY_REGISTRATION_WEIGHT  = 0.25   # first 10% of the sale window
LATE_REGISTRATION_WEIGHT   = 0.55   # last 20% of the sale window
STEADY_REGISTRATION_WEIGHT = 0.20   # middle period