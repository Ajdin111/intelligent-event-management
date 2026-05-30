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
    "Truly inspiring. Left feeling motivated and full of new ideas to try.",
    "The speakers brought real depth and practical experience to every topic.",
    "Loved the energy in the room. Everyone was engaged and enthusiastic.",
    "Exceptional value for money. One of the best investments I have made this year.",
    "The organizers thought of everything. Smooth from start to finish.",
    "This event sets the standard for what a tech conference should be.",
    "Walked away with new skills, new contacts, and a lot of inspiration.",
    "The breakout sessions were intimate and incredibly valuable.",
    "Perfect pacing throughout the day. Never felt rushed or bored.",
    "The hands-on workshops were the highlight for me. Incredibly well run.",
    "Brilliant event. The speakers were engaging, knowledgeable, and passionate.",
    "So glad I attended. The networking alone made it worth every penny.",
    "The production quality was excellent. Felt very professional throughout.",
    "Really appreciated the diversity of topics covered. Something new every hour.",
    "An absolute highlight of my year. Cannot wait for the next edition.",
    "The speakers delivered beyond expectations. Every talk was a gem.",
    "I left with pages of notes and a long list of things to implement.",
    "The community here is unlike any other. Friendly, helpful, and inspiring.",
    "Everything was top quality — the venue, the catering, the content.",
    "This is the event I recommend to every colleague without hesitation.",
    "Fantastic experience from beginning to end. Zero complaints.",
    "The interactive format made it so much more engaging than a typical conference.",
    "World-class speakers sharing real stories and lessons. Absolutely worth it.",
    "The workshops were deeply practical. I used what I learned the very next day.",
    "Incredible atmosphere. You could feel the passion and expertise in every room.",
    "Best organized event I have ever attended. The logistics were flawless.",
    "Loved the mix of keynotes and smaller workshops. Great variety.",
    "The content was fresh and forward-looking. Nothing felt outdated.",
    "Really inspiring day. The speakers shared vulnerabilities and lessons learned.",
    "Everything clicked — the people, the venue, the content. A perfect event.",
    "The team behind this clearly cares deeply about quality. It shows.",
    "Highly practical and immediately useful. Rare for a conference of this size.",
    "Every talk delivered real value. I was engaged from the first session to the last.",
    "The event felt curated and intentional. Not a single wasted slot.",
    "Loved the Q&A sessions. The speakers were generous with their time and knowledge.",
    "One of those events that reminds you why you love this industry.",
    "Exceeded every expectation. I will be back and bringing my whole team.",
    "The speakers were honest and direct. No fluff, just real insights.",
    "Everything was smooth and well-run. A pleasure to attend.",
    "The content quality was consistently high across all tracks.",
    "Walked in curious and walked out inspired. Highly recommend.",
    "The networking breaks were perfectly timed and genuinely useful.",
    "A career-defining day. Met people and learned things I will carry forward.",
    "Loved the focus on practical application rather than theory.",
    "The event struck the perfect balance between depth and accessibility.",
    "One of the best uses of a working day I can remember.",
    "Engaging, relevant, and incredibly well delivered. Five stars.",
    "The speakers clearly prepared thoroughly. No generic content anywhere.",
    "A fantastic community event. Felt welcoming from the moment I arrived.",
    "Top-tier content delivered with real passion. Absolutely worth attending.",
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
    "Had some high points but also some low ones. Came out roughly neutral.",
    "The event delivered on some promises but fell short on others.",
    "Worth the time but not the full ticket price in my opinion.",
    "A few memorable moments but largely forgettable sessions.",
    "The organization was solid but the content did not match the marketing.",
    "Reasonable value. A few sessions were truly excellent and saved the day.",
    "Mixed bag. I got something out of it but left feeling underwhelmed.",
    "The first half was strong. The second half lost momentum significantly.",
    "Satisfactory overall. Nothing transformative but useful in places.",
    "The workshops were decent but nothing I could not find online for free.",
    "Solid event with a few standout sessions. Could be more consistent.",
    "Came away with a handful of useful takeaways. Not bad, not great.",
    "Some speakers were fantastic. Others felt underprepared. It balanced out.",
    "The content was appropriate but not particularly inspiring.",
    "Fine event. The logistics worked well but the programming was inconsistent.",
    "Would cautiously recommend. Depends on what tracks you attend.",
    "A few gems in there but you had to work to find them.",
    "The opening session was excellent. The rest was serviceable.",
    "Adequate event for the price. Not a must-attend but worth a visit.",
    "Solid enough. I got what I needed but was not blown away.",
    "The event met basic expectations without surpassing them.",
    "Good in parts. The technical sessions were stronger than the panels.",
    "A reasonable day out. Some value but nothing I will remember in a year.",
    "The format worked well. Content execution was uneven.",
    "Three or four really strong talks and the rest were filler.",
    "Okay event. I would attend again if the lineup improved.",
    "Some interesting ideas were shared but the depth was lacking overall.",
    "The venue and catering were great. The content was average.",
    "Neither particularly good nor bad. A standard conference experience.",
    "Had potential but did not fully deliver. A decent but forgettable day.",
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
    "Complete waste of a day. I learned nothing and made no useful connections.",
    "The content felt like it was written five years ago. Completely irrelevant.",
    "Shocking lack of quality control. Several speakers were visibly underprepared.",
    "The conference was disorganized from the start. Queues, delays, and confusion everywhere.",
    "I paid a lot for this and got very little. Extremely poor value.",
    "The sessions were padded with filler content and sponsor messages.",
    "Felt like a trade show disguised as a conference. Too much selling, not enough learning.",
    "The live demos failed repeatedly. It was embarrassing to watch.",
    "I left early because the content was so far below expectations.",
    "The workshop facilitators clearly had not prepared. It was a mess.",
    "Terrible audio and video quality made most sessions hard to follow.",
    "The schedule was completely ignored. Sessions started late and ended early.",
    "Very poor experience. I regret attending and would not return.",
    "The speakers repeated the same basic points session after session.",
    "Far too much advertising disguised as content. Felt manipulative.",
    "The event description was wildly misleading. Nothing matched what was promised.",
    "Boring and uninspiring from start to finish. A real letdown.",
    "The Q&A sessions were cut every time just as they got interesting.",
    "Appalling value. The free coffee was the highlight of the day.",
    "I have attended student hackathons with better content than this.",
    "The organizers were unresponsive and the venue was chaotic.",
    "Nothing new, nothing deep, nothing useful. Extremely disappointing.",
    "The technical sessions were at a beginner level despite being advertised otherwise.",
    "A poorly run event that clearly prioritized profit over attendee experience.",
    "Wasted my time and money. Will not be returning.",
    "The event had no clear focus and the sessions felt randomly assembled.",
    "The panelists contradicted each other without any moderation. Frustrating.",
    "Far too much dead time between sessions. Poor scheduling.",
    "I expected innovation and got a rehash of things said at conferences five years ago.",
    "The worst conference I have attended in recent memory. A real disappointment.",
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