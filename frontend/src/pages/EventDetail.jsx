import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsApi } from '../services/api'

// Per-event cover images — themed to each event's spirit
const COVERS = {
  1: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=1600&q=80', // Vector Summit — AI neural network
  2: 'https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?auto=format&fit=crop&w=1600&q=80', // ReactNext — frontend code
  3: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1600&q=80', // Product Craft — product whiteboard
  4: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1600&q=80',    // EdgeCloud — cloud servers
  5: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',    // Warehouse — data analytics
  6: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?auto=format&fit=crop&w=1600&q=80', // PlatformCon — DevOps pipeline
  7: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1600&q=80',    // ZeroTrust — cybersecurity
  8: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1600&q=80',    // Interface — UI/UX design
  9: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1600&q=80', // Model Eval — ML models
}
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80'

// Full fake detail for each event — title, tiers, agenda, reviews
const FAKE = {
  1: {
    title: 'Vector Summit 2026',
    category: 'AI & ML', organizer: 'Northwind Labs',
    date: 'May 14, 2026', time: '09:00 – 18:00', location: 'San Francisco, CA',
    rating: 4.7, reviewCount: 234,
    description: 'Two days of hands-on sessions on embeddings, retrieval, and agentic workflows from teams shipping in production. Expect technical keynotes from practitioners shipping at scale, five workshop tracks with live labs, and a curated networking reception on the evening of day one.\n\nAll ticket tiers include access to the main stage, workshop tracks, lunch on both days, and a post-event video library.',
    tiers: [
      { name: 'Community',  price: 0,   total: 150, sold: 128 },
      { name: 'Standard',   price: 199, total: 300, sold: 210 },
      { name: 'Early Bird', price: 149, total: 200, sold: 200 },
      { name: 'VIP',        price: 599, total: 50,  sold: 14  },
    ],
    tracks: [
      { name: 'Main Stage', sessions: [
        { time: '09:00', title: 'Opening Keynote: Retrieval in 2026', speaker: 'D. Park',     room: 'Hall A', duration: '45min' },
        { time: '10:00', title: "Evals that don't lie",               speaker: 'M. Osei',    room: 'Hall A', duration: '45min' },
        { time: '11:00', title: 'Panel: Agent architectures',         speaker: '4 speakers', room: 'Hall A', duration: '60min' },
        { time: '14:00', title: 'Fireside: Post-transformer?',        speaker: 'R. Lim',     room: 'Hall A', duration: '45min' },
      ]},
      { name: 'Workshop Track', sessions: [
        { time: '10:00', title: 'Hands-on: RAG pipelines',      speaker: 'S. Novak',    room: 'Lab 1', duration: '90min' },
        { time: '13:00', title: 'Hands-on: Evaluation harness', speaker: 'J. Tran',     room: 'Lab 1', duration: '90min' },
        { time: '15:00', title: 'Building tool-using agents',   speaker: 'A. Ferreira', room: 'Lab 2', duration: '60min' },
      ]},
      { name: 'Community', sessions: [
        { time: '11:30', title: 'Lightning talks (block 1)', speaker: '6 speakers', room: 'Hall B',  duration: '30min' },
        { time: '15:30', title: 'Lightning talks (block 2)', speaker: '6 speakers', room: 'Hall B',  duration: '30min' },
        { time: '17:00', title: 'Networking reception',      speaker: 'Open',       room: 'Atrium', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 72 }, { stars: 4, pct: 20 },
      { stars: 3, pct: 5  }, { stars: 2, pct: 2  }, { stars: 1, pct: 1 },
    ],
    reviews: [
      { id: 1, rating: 5, text: "Strongest line-up I've seen this year. Workshops actually went deep.", date: '3 days ago' },
      { id: 2, rating: 4, text: 'Great sessions; registration queue was long on day one.',              date: '4 days ago' },
      { id: 3, rating: 5, text: 'The eval workshop alone was worth the ticket.',                        date: '6 days ago' },
      { id: 4, rating: 2, text: 'Content solid, catering was mid. Please more tea.',                   date: '1 week ago' },
    ],
  },
  2: {
    title: 'ReactNext: Motion',
    category: 'Frontend', organizer: 'Parallel',
    date: 'Jun 18, 2026', time: '09:30 – 16:30', location: 'Berlin, DE',
    rating: 4.5, reviewCount: 89,
    description: 'A full day of React-focused sessions covering animation, state management, and the latest patterns emerging from the ecosystem. Hands-on workshops with real project reviews and live Q&A with open-source maintainers.',
    tiers: [
      { name: 'Community', price: 0,  total: 250, sold: 228 },
      { name: 'Workshop',  price: 79, total: 80,  sold: 60  },
    ],
    tracks: [
      { name: 'Main Track', sessions: [
        { time: '09:30', title: 'The Motion API in 2026',         speaker: 'K. Laurent', room: 'Stage A', duration: '45min' },
        { time: '10:30', title: 'Server Components in production', speaker: 'J. Chen',   room: 'Stage A', duration: '45min' },
        { time: '14:00', title: 'Panel: State management in 2026', speaker: '3 speakers', room: 'Stage A', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 60 }, { stars: 4, pct: 25 },
      { stars: 3, pct: 10 }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Best frontend conf I have attended. Every talk was directly applicable.', date: '2 days ago' },
      { id: 2, rating: 4, text: 'Great vibe, loved the live coding sessions.',                             date: '5 days ago' },
    ],
  },
  3: {
    title: 'Product Craft Summit',
    category: 'Product', organizer: 'Orbit',
    date: 'Aug 22, 2026', time: '10:00 – 16:00', location: 'Toronto, CA',
    rating: 4.3, reviewCount: 64,
    description: 'A community-driven summit for product managers, designers, and founders focused on building products that matter. Sessions cover discovery, prioritization, metrics, and shipping with conviction.',
    tiers: [
      { name: 'Community', price: 0,   total: 400, sold: 340 },
      { name: 'Pro',        price: 149, total: 100, sold: 42  },
    ],
    tracks: [
      { name: 'Discovery Track', sessions: [
        { time: '10:00', title: 'Jobs-to-be-done in practice', speaker: 'A. Park',    room: 'Room 1', duration: '45min' },
        { time: '11:00', title: 'Continuous discovery habits', speaker: 'T. Torres',  room: 'Room 1', duration: '45min' },
        { time: '14:00', title: 'Metrics that matter',         speaker: 'L. Gupta',   room: 'Room 1', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 55 }, { stars: 4, pct: 28 },
      { stars: 3, pct: 12 }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Finally a product conf that skips the fluff and goes deep.',       date: '1 day ago'  },
      { id: 2, rating: 4, text: 'Great talks. Would love more workshops next time.',                date: '3 days ago' },
      { id: 3, rating: 4, text: 'Good energy, solid speakers. Toronto venue was excellent.',       date: '5 days ago' },
    ],
  },
  4: {
    title: 'EdgeCloud Conf',
    category: 'Cloud', organizer: 'Helix Platform',
    date: 'Jun 03, 2026', time: '09:00 – 17:00', location: 'Austin, TX',
    rating: 4.4, reviewCount: 118,
    description: 'Two days at the frontier of distributed cloud architecture — edge computing, multi-region deployments, and cost-optimisation strategies used by teams running global infrastructure. Deep technical content, no marketing fluff.',
    tiers: [
      { name: 'Standard', price: 249, total: 400, sold: 312 },
      { name: 'VIP',      price: 499, total: 60,  sold: 28  },
    ],
    tracks: [
      { name: 'Infrastructure', sessions: [
        { time: '09:00', title: 'Multi-region without the pain',   speaker: 'D. Watts',  room: 'Hall A', duration: '45min' },
        { time: '10:00', title: 'Edge caching at scale',           speaker: 'M. Singh',  room: 'Hall A', duration: '45min' },
        { time: '14:00', title: 'Cost-optimisation war stories',   speaker: '3 speakers', room: 'Hall A', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 58 }, { stars: 4, pct: 26 },
      { stars: 3, pct: 10 }, { stars: 2, pct: 4  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'The best cloud architecture event I have been to — genuinely technical.', date: '2 days ago' },
      { id: 2, rating: 4, text: 'Day 2 sessions were outstanding. Austin was a great venue.',              date: '4 days ago' },
    ],
  },
  5: {
    title: 'Warehouse & Lakehouse Days',
    category: 'Data', organizer: 'Stratus Data',
    date: 'Jul 15, 2026', time: '09:00 – 17:00', location: 'New York, NY',
    rating: 4.6, reviewCount: 97,
    description: 'The practitioner conference for data engineers and analytics engineers building modern data platforms. Sessions cover DuckDB, Iceberg, dbt, and real-world lakehouse architectures from teams at scale.',
    tiers: [
      { name: 'Standard', price: 349, total: 500, sold: 290 },
      { name: 'Workshop', price: 499, total: 80,  sold: 55  },
    ],
    tracks: [
      { name: 'Architecture', sessions: [
        { time: '09:00', title: 'Lakehouse vs Warehouse in 2026',    speaker: 'K. Novak',  room: 'Hall B', duration: '45min' },
        { time: '10:00', title: 'dbt best practices at scale',       speaker: 'A. Chen',   room: 'Hall B', duration: '45min' },
        { time: '14:00', title: 'Apache Iceberg in production',      speaker: 'R. Yamada', room: 'Hall B', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 65 }, { stars: 4, pct: 22 },
      { stars: 3, pct: 8  }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Every session was worth attending. Finally a conference without vendor pitches.', date: '1 day ago'  },
      { id: 2, rating: 5, text: 'The Iceberg talk alone justified the ticket price.',                              date: '3 days ago' },
      { id: 3, rating: 4, text: 'Great hallway track too. Met some fantastic engineers.',                         date: '5 days ago' },
    ],
  },
  6: {
    title: 'PlatformCon',
    category: 'DevOps', organizer: 'Runbook',
    date: 'Aug 05, 2026', time: '09:00 – 17:00', location: 'Remote',
    rating: 4.3, reviewCount: 73,
    description: 'The conference for platform engineers, SREs, and DevOps teams. Sessions on golden paths, developer experience, Kubernetes, and platform as a product from teams building internal developer platforms at scale.',
    tiers: [
      { name: 'Community', price: 0,   total: 1000, sold: 844 },
      { name: 'Pro',        price: 249, total: 150,  sold: 94  },
    ],
    tracks: [
      { name: 'Platform Engineering', sessions: [
        { time: '09:00', title: 'Platform as a product',            speaker: 'N. Patel',  room: 'Virtual A', duration: '45min' },
        { time: '10:00', title: 'Golden paths that developers love', speaker: 'C. Kim',   room: 'Virtual A', duration: '45min' },
        { time: '14:00', title: 'Kubernetes operator patterns',     speaker: 'F. Garcia', room: 'Virtual A', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 52 }, { stars: 4, pct: 30 },
      { stars: 3, pct: 13 }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Best remote conference experience I have had — production quality was top notch.', date: '2 days ago' },
      { id: 2, rating: 4, text: 'Really appreciated the platform-as-product focus. Very applicable.',               date: '4 days ago' },
    ],
  },
  7: {
    title: 'ZeroTrust World',
    category: 'Security', organizer: 'Aegis Security',
    date: 'Jul 02, 2026', time: '09:00 – 17:00', location: 'Remote',
    rating: 4.5, reviewCount: 152,
    description: 'The global security conference for engineers and security teams implementing zero-trust architectures. Hands-on labs, red team vs blue team exercises, and deep dives into identity, access, and threat modelling.',
    tiers: [
      { name: 'Standard', price: 149, total: 2000, sold: 760 },
      { name: 'VIP',      price: 349, total: 200,  sold: 88  },
    ],
    tracks: [
      { name: 'Zero Trust', sessions: [
        { time: '09:00', title: 'Zero trust: beyond the buzzword',  speaker: 'S. Lee',    room: 'Virtual Main', duration: '45min' },
        { time: '10:00', title: 'Identity-first security in 2026',  speaker: 'M. Brown',  room: 'Virtual Main', duration: '45min' },
        { time: '14:00', title: 'Red team: live zero-trust bypass', speaker: '2 speakers', room: 'Virtual Lab',  duration: '90min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 62 }, { stars: 4, pct: 24 },
      { stars: 3, pct: 9  }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'The red team lab was the highlight of my year. Incredibly educational.',          date: '2 days ago' },
      { id: 2, rating: 5, text: 'Dense, technical, and practical. Exactly what security conferences should be.',  date: '5 days ago' },
      { id: 3, rating: 4, text: 'Strong speaker lineup. Wish there were more networking opportunities online.',   date: '1 week ago' },
    ],
  },
  8: {
    title: 'Interface 2026',
    category: 'Design', organizer: 'Studio Kilo',
    date: 'Sep 09, 2026', time: '10:00 – 18:00', location: 'Amsterdam, NL',
    rating: 4.8, reviewCount: 203,
    description: 'Europe\'s premier design conference. Two days of talks on interaction design, design systems, and the intersection of design and engineering. Expect sharp critique, beautiful work, and the people behind it.',
    tiers: [
      { name: 'Standard', price: 399, total: 300, sold: 226 },
      { name: 'VIP',      price: 699, total: 50,  sold: 32  },
    ],
    tracks: [
      { name: 'Design Systems', sessions: [
        { time: '10:00', title: 'Tokens at scale: a year later',   speaker: 'A. Müller', room: 'Main Hall', duration: '45min' },
        { time: '11:00', title: 'Motion design in production',     speaker: 'L. Sato',   room: 'Main Hall', duration: '45min' },
        { time: '15:00', title: 'Design eng: the role of 2026',   speaker: '3 speakers', room: 'Main Hall', duration: '60min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 78 }, { stars: 4, pct: 16 },
      { stars: 3, pct: 4  }, { stars: 2, pct: 1  }, { stars: 1, pct: 1 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Flawlessly produced. The Amsterdam venue was a perfect choice.',             date: '1 day ago'  },
      { id: 2, rating: 5, text: 'Every talk was a masterclass. One of the best events I have ever attended.', date: '3 days ago' },
      { id: 3, rating: 5, text: 'The design systems track alone was worth the trip from London.',             date: '5 days ago' },
    ],
  },
  9: {
    title: 'Model Eval Workshop',
    category: 'AI & ML', organizer: 'Northwind Labs',
    date: 'Oct 01, 2026', time: '09:00 – 16:00', location: 'Remote',
    rating: 4.4, reviewCount: 41,
    description: 'A focused half-day workshop on building reliable evaluation harnesses for language models. Covers automated evals, human preference data, red-teaming, and measuring regression across model versions.',
    tiers: [
      { name: 'Standard', price: 99,  total: 800, sold: 280 },
      { name: 'Pro',       price: 199, total: 100, sold: 34  },
    ],
    tracks: [
      { name: 'Evaluations', sessions: [
        { time: '09:00', title: 'Why evals fail and how to fix them',   speaker: 'D. Kim',   room: 'Virtual', duration: '45min' },
        { time: '10:00', title: 'Building automated eval pipelines',    speaker: 'P. Nair',  room: 'Virtual', duration: '60min' },
        { time: '14:00', title: 'Human preference data at scale',       speaker: 'S. Costa', room: 'Virtual', duration: '45min' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 58 }, { stars: 4, pct: 28 },
      { stars: 3, pct: 10 }, { stars: 2, pct: 3  }, { stars: 1, pct: 1 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Best practical ML evaluation content anywhere. Dense and immediately useful.', date: '2 days ago' },
      { id: 2, rating: 4, text: 'Well-structured workshop. The pipeline session saved me days of work.',       date: '4 days ago' },
    ],
  },
}

function getFake(id) {
  return FAKE[id] ?? {
    title: 'TeqEvent',
    category: 'Tech', organizer: 'TeqEvent',
    date: 'TBD', time: 'TBD', location: 'TBD',
    rating: 0, reviewCount: 0,
    description: 'Full event details will be published soon.',
    tiers: [{ name: 'Standard', price: 99, total: 200, sold: 0 }],
    tracks: [],
    breakdown: [
      { stars: 5, pct: 0 }, { stars: 4, pct: 0 },
      { stars: 3, pct: 0 }, { stars: 2, pct: 0 }, { stars: 1, pct: 0 },
    ],
    reviews: [],
  }
}

// ── icons ────────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoCal = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="12" height="11" rx="1.3" />
    <line x1="0.5" y1="5" x2="12.5" y2="5" />
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round" />
    <line x1="9.5" y1="0" x2="9.5" y2="3" strokeLinecap="round" />
  </svg>
)
const IcoClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6.5" cy="6.5" r="6" />
    <path d="M6.5 3.5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoPin = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7.5-3.5 7.5S3 7 3 4.5A3.5 3.5 0 0 1 6.5 1Z" strokeLinejoin="round" />
    <circle cx="6.5" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
const IcoGroup = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5" cy="4" r="2.2" />
    <path d="M0.5 12c0-2.5 2-4.5 4.5-4.5S9.5 9.5 9.5 12" strokeLinecap="round" />
    <circle cx="9.5" cy="4" r="1.7" />
    <path d="M11 7.5c1.2.6 2 1.9 2 3.5" strokeLinecap="round" />
  </svg>
)
const IcoSave = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 1l1.8 3.5 3.7.5-2.7 2.7.6 3.8L7 9.5l-3.4 2 .6-3.8L1.5 5l3.7-.5z" strokeLinejoin="round" />
  </svg>
)
const IcoShare = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
  </svg>
)

function StarRow({ rating, size = 13 }) {
  return (
    <span className="ed-stars">
      {[1,2,3,4,5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 13 13"
          fill={n <= Math.round(rating) ? '#ffffff' : 'none'}
          stroke="currentColor" strokeWidth="1.3">
          <path d="M6.5 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6.5 9l-3 1.5.5-3.5L1.5 4.5 5 4z"
            strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTier, setSelectedTier] = useState(0)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const numId = Number(id)

    // Reject non-numeric, negative, or non-integer IDs immediately
    if (!id || isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
      setEvent(null)
      setLoading(false)
      return
    }

    eventsApi.getById(id)
      .then(res => {
        const real = res.data
        const fake = FAKE[numId] ?? null
        if (!fake) {
          // Real event exists in DB but we have no fake enrichment — use real data only
          setEvent({
            title: real.title,
            category: 'Tech', organizer: 'TeqEvent',
            date: real.start_datetime
              ? new Date(real.start_datetime).toLocaleDateString('en-US',
                  { month: 'long', day: 'numeric', year: 'numeric' })
              : 'TBD',
            time: 'TBD',
            location: real.physical_address
              || (real.location_type === 'online' ? 'Remote' : 'TBD'),
            rating: 0, reviewCount: 0,
            description: real.description || 'No description available.',
            tiers: [{ name: 'Standard', price: real.is_free ? 0 : 99, total: real.capacity || 100, sold: 0 }],
            tracks: [], breakdown: [], reviews: [],
          })
        } else {
          setEvent({
            ...fake,
            title: real.title || fake.title,
            description: real.description || fake.description,
            location: real.physical_address
              || (real.location_type === 'online' ? 'Remote' : fake.location),
            date: real.start_datetime
              ? new Date(real.start_datetime).toLocaleDateString('en-US',
                  { month: 'long', day: 'numeric', year: 'numeric' })
              : fake.date,
          })
        }
      })
      .catch(() => {
        const fake = FAKE[numId] ?? null
        // If we have demo data for this ID, show it regardless of API error.
        // Only show "not found" when the ID isn't in our known event set.
        setEvent(fake)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="ed-state">Loading…</div>
  if (!event)  return <div className="ed-state">Event not found.</div>

  const cover      = COVERS[Number(id)] || DEFAULT_COVER
  const tier       = event.tiers[selectedTier]
  const soldOut    = tier && tier.sold >= tier.total
  const available  = tier ? tier.total - tier.sold : 0
  const subtotal   = tier
    ? (tier.price === 0 ? 'Free' : `$${(tier.price * quantity).toLocaleString()}`)
    : '—'
  const hasRating  = event.reviewCount > 0
  const hasSamples = event.reviews.length > 0

  return (
    <div className="ed-wrap">

      {/* back */}
      <button className="ed-back" onClick={() => navigate('/events')}>
        <IcoBack /> Back to discover
      </button>

      {/* hero */}
      <div className="ed-hero-frame">
        <div className="ed-hero">
          <img src={cover} alt={event.title} className="ed-hero-img" />
          <div className="ed-hero-overlay" />
        </div>
      </div>

      {/* meta bar */}
      <div className="ed-meta-bar">
        <div className="ed-meta-left">
          <span className="ed-cat-pill">{event.category}</span>
          {hasRating && (
            <div className="ed-rating-row">
              <StarRow rating={event.rating} />
              <span className="ed-rating-val">{event.rating}</span>
              <span className="ed-rating-count">· {event.reviewCount} reviews</span>
            </div>
          )}
        </div>
        <div className="ed-actions">
          <button className="ed-action-btn"><IcoSave /> Save</button>
          <button className="ed-action-btn"><IcoShare /> Share</button>
        </div>
      </div>

      {/* title */}
      <h1 className="ed-title">{event.title}</h1>

      {/* info row */}
      <div className="ed-info-row">
        <span className="ed-info-item"><IcoCal />   {event.date}</span>
        <span className="ed-info-item"><IcoClock /> {event.time}</span>
        <span className="ed-info-item"><IcoPin />   {event.location}</span>
        <span className="ed-info-item"><IcoGroup /> Hosted by {event.organizer}</span>
      </div>

      {/* two-column body */}
      <div className="ed-body">

        {/* ── left ── */}
        <div className="ed-main">

          <section className="ed-section">
            <h2 className="ed-section-h">About this event</h2>
            {event.description.split('\n\n').map((p, i) => (
              <p key={i} className="ed-desc">{p}</p>
            ))}
          </section>

          {event.tracks.length > 0 && (
            <section className="ed-section">
              <h2 className="ed-section-h">Agenda</h2>
              <div className="ed-tracks">
                {event.tracks.map(track => (
                  <div key={track.name} className="ed-track">
                    <div className="ed-track-head">
                      <span className="ed-track-bar" />
                      <span className="ed-track-name">{track.name}</span>
                      <span className="ed-track-count">· {track.sessions.length} sessions</span>
                    </div>
                    {track.sessions.map((s, i) => (
                      <div key={i} className="ed-session">
                        <span className="ed-session-time">{s.time}</span>
                        <div className="ed-session-info">
                          <span className="ed-session-title">{s.title}</span>
                          <span className="ed-session-meta">{s.speaker} · {s.room}</span>
                        </div>
                        <span className="ed-session-dur">{s.duration}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ed-section">
            <h2 className="ed-section-h">Reviews & ratings</h2>
            {hasRating ? (
              <>
                {/* aggregate summary — uses total reviewCount */}
                <div className="ed-review-summary">
                  <div className="ed-score-col">
                    <span className="ed-score-num">{event.rating}</span>
                    <StarRow rating={event.rating} size={14} />
                    <span className="ed-score-sub">{event.reviewCount} reviews</span>
                  </div>
                  <div className="ed-bars">
                    {event.breakdown.map(r => (
                      <div key={r.stars} className="ed-bar-row">
                        <span className="ed-bar-label">{r.stars}</span>
                        <div className="ed-bar-track">
                          <div className="ed-bar-fill" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="ed-bar-pct">{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* sample review cards — subset of all reviews */}
                {hasSamples && (
                  <div className="ed-review-list">
                    {event.reviews.map(r => (
                      <div key={r.id} className="ed-review-card">
                        <div className="ed-review-head">
                          <StarRow rating={r.rating} size={12} />
                          <span className="ed-review-date">{r.date}</span>
                        </div>
                        <p className="ed-review-text">{r.text}</p>
                        <span className="ed-review-author">Anonymous attendee</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="ed-desc">No reviews yet. Be the first to attend and share your experience.</p>
            )}
          </section>
        </div>

        {/* ── right sidebar ── */}
        <aside className="ed-sidebar">
          <div className="ed-ticket-box">
            <p className="ed-ticket-label">CHOOSE A TIER</p>
            <div className="ed-tiers">
              {event.tiers.map((t, i) => {
                const out  = t.sold >= t.total
                const left = t.total - t.sold
                const fill = Math.round((t.sold / t.total) * 100)
                return (
                  <button
                    key={t.name}
                    disabled={out}
                    onClick={() => { if (!out) { setSelectedTier(i); setQuantity(1) } }}
                    className={[
                      'ed-tier',
                      selectedTier === i && !out ? 'ed-tier--active' : '',
                      out ? 'ed-tier--soldout' : '',
                    ].join(' ')}
                  >
                    <div className="ed-tier-row">
                      <span className="ed-tier-name">{t.name}</span>
                      <span className="ed-tier-price">
                        {out ? 'Sold out' : t.price === 0 ? 'Free' : `$${t.price}`}
                      </span>
                    </div>
                    <span className="ed-tier-avail">
                      {out ? 'No spots remaining' : `${left} of ${t.total} left`}
                    </span>
                    <div className="ed-tier-track">
                      <div className="ed-tier-fill" style={{ width: `${fill}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {!soldOut && (
              <>
                <div className="ed-qty-row">
                  <span className="ed-qty-label">Quantity</span>
                  <div className="ed-qty-ctrl">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                    <span>{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(available, q + 1))}>+</button>
                  </div>
                </div>
                <div className="ed-subtotal-row">
                  <span>Subtotal</span>
                  <strong className="ed-subtotal-val">{subtotal}</strong>
                </div>
              </>
            )}

            <button className="ed-register-btn" disabled={soldOut}>
              {soldOut ? 'Sold out' : 'Register now →'}
            </button>

            {!soldOut && (
              <p className="ed-register-note">
                Secure checkout · Refundable up to 7 days before event
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
