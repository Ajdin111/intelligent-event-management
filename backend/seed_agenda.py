"""
Seed agenda data (tracks + sessions) for all 9 events.
Run from backend/ directory:
    python seed_agenda.py

Idempotent — skips any event that already has tracks.
"""
import sys
from datetime import datetime, timedelta, date

sys.path.insert(0, '.')

from app.db.session import SessionLocal
from app.models.agenda import Track, AgendaSession
from app.models.event import Event

# ---------------------------------------------------------------------------
# Agenda definitions keyed by event_id.
# Each session: (hour, minute, duration_minutes, title, speaker, location)
# ---------------------------------------------------------------------------

AGENDA = {
    1: {  # Vector Summit 2026
        'tracks': [
            {
                'name': 'Main Stage', 'color': '#4A9EFF', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Opening Keynote: Retrieval in 2026',  'D. Park',     'Hall A'),
                    (10, 0,  45, "Evals That Don't Lie",                'M. Osei',     'Hall A'),
                    (11, 0,  60, 'Panel: Agent Architectures',          '4 speakers',  'Hall A'),
                    (14, 0,  45, 'Fireside: Post-Transformer?',         'R. Lim',      'Hall A'),
                ],
            },
            {
                'name': 'Workshop Track', 'color': '#7C5DFA', 'order_index': 1,
                'sessions': [
                    (10, 0,  90, 'Hands-on: RAG Pipelines',         'S. Novak',    'Lab 1'),
                    (13, 0,  90, 'Hands-on: Evaluation Harness',     'J. Tran',     'Lab 1'),
                    (15, 0,  60, 'Building Tool-Using Agents',       'A. Ferreira', 'Lab 2'),
                ],
            },
            {
                'name': 'Community', 'color': '#22C55E', 'order_index': 2,
                'sessions': [
                    (11, 30, 30, 'Lightning Talks — Block 1', '6 speakers', 'Hall B'),
                    (15, 30, 30, 'Lightning Talks — Block 2', '6 speakers', 'Hall B'),
                    (17, 0,  60, 'Networking Reception',      'Open',       'Atrium'),
                ],
            },
        ],
    },
    2: {  # ReactNext: Motion
        'tracks': [
            {
                'name': 'Main Track', 'color': '#4A9EFF', 'order_index': 0,
                'sessions': [
                    (9,  30, 45, 'The Motion API in 2026',          'K. Laurent',  'Stage A'),
                    (10, 30, 45, 'Server Components in Production',  'J. Chen',     'Stage A'),
                    (12, 0,  60, 'Zustand vs RSC: State in 2026',   'L. Kim',      'Stage A'),
                    (14, 0,  60, 'Panel: State Management in 2026', '3 speakers',  'Stage A'),
                ],
            },
        ],
    },
    3: {  # Product Craft Summit
        'tracks': [
            {
                'name': 'Discovery Track', 'color': '#F59E0B', 'order_index': 0,
                'sessions': [
                    (10, 0,  45, 'Jobs-to-be-Done in Practice',     'A. Park',   'Room 1'),
                    (11, 0,  45, 'Continuous Discovery Habits',      'T. Torres', 'Room 1'),
                    (13, 0,  60, 'Metrics That Matter',              'L. Gupta',  'Room 1'),
                    (14, 30, 45, 'Shipping With Conviction',         'M. Ortega', 'Room 1'),
                ],
            },
            {
                'name': 'Design Track', 'color': '#EC4899', 'order_index': 1,
                'sessions': [
                    (10, 0,  45, 'From Research to Roadmap',        'S. Yamada', 'Room 2'),
                    (11, 30, 45, 'Prioritisation Frameworks Demystified', 'B. Nkosi', 'Room 2'),
                    (14, 0,  60, 'Panel: Product in Uncertain Times', '4 speakers', 'Room 2'),
                ],
            },
        ],
    },
    4: {  # EdgeCloud Conf
        'tracks': [
            {
                'name': 'Infrastructure', 'color': '#06B6D4', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Multi-Region Without the Pain',       'D. Watts',   'Hall A'),
                    (10, 0,  45, 'Edge Caching at Scale',               'M. Singh',   'Hall A'),
                    (11, 0,  60, 'FinOps: Cost-Optimisation War Stories','3 speakers', 'Hall A'),
                    (14, 0,  90, 'Workshop: Deploying to the Edge',     'C. Reyes',   'Lab 1'),
                ],
            },
        ],
    },
    5: {  # Warehouse & Lakehouse Days
        'tracks': [
            {
                'name': 'Architecture', 'color': '#8B5CF6', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Lakehouse vs Warehouse in 2026',   'K. Novak',  'Hall B'),
                    (10, 0,  45, 'dbt Best Practices at Scale',      'A. Chen',   'Hall B'),
                    (11, 0,  60, 'Apache Iceberg in Production',     'R. Yamada', 'Hall B'),
                    (14, 0,  45, 'DuckDB for the Working Engineer',  'P. Dubois', 'Hall B'),
                ],
            },
            {
                'name': 'Tooling & Ops', 'color': '#10B981', 'order_index': 1,
                'sessions': [
                    (10, 0,  60, 'Data Contracts: Theory to Practice', 'N. Müller', 'Room C'),
                    (13, 0,  45, 'Observability for Data Pipelines',   'S. Ito',    'Room C'),
                    (14, 30, 60, 'Panel: The Future of the Data Stack','4 speakers','Room C'),
                ],
            },
        ],
    },
    6: {  # PlatformCon
        'tracks': [
            {
                'name': 'Platform Engineering', 'color': '#F97316', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Platform as a Product',              'N. Patel',  'Virtual A'),
                    (10, 0,  45, 'Golden Paths That Developers Love',  'C. Kim',    'Virtual A'),
                    (11, 0,  60, 'Kubernetes Operator Patterns',       'F. Garcia', 'Virtual A'),
                    (14, 0,  45, 'Panel: IDP in Practice',            '3 speakers','Virtual A'),
                ],
            },
        ],
    },
    7: {  # ZeroTrust World
        'tracks': [
            {
                'name': 'Zero Trust', 'color': '#EF4444', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Zero Trust: Beyond the Buzzword',   'S. Lee',    'Virtual Main'),
                    (10, 0,  45, 'Identity-First Security in 2026',   'M. Brown',  'Virtual Main'),
                    (11, 0,  60, 'Panel: Real-World ZT Deployments',  '3 speakers','Virtual Main'),
                    (14, 0,  90, 'Red Team: Live Zero-Trust Bypass',  '2 speakers','Virtual Lab'),
                ],
            },
            {
                'name': 'Threat Modelling', 'color': '#6366F1', 'order_index': 1,
                'sessions': [
                    (10, 30, 45, 'Supply Chain Attacks in Practice',  'A. Petrov', 'Virtual B'),
                    (13, 0,  60, 'Hands-on: Threat Modelling Workshop','R. Okeke', 'Virtual B'),
                ],
            },
        ],
    },
    8: {  # Interface 2026
        'tracks': [
            {
                'name': 'Design Systems', 'color': '#EC4899', 'order_index': 0,
                'sessions': [
                    (10, 0,  45, 'Tokens at Scale: A Year Later',     'A. Müller', 'Main Hall'),
                    (11, 0,  45, 'Motion Design in Production',       'L. Sato',   'Main Hall'),
                    (14, 0,  60, 'Design Engineering: The Role of 2026','3 speakers','Main Hall'),
                    (15, 30, 45, 'Closing Keynote: What Comes After', 'T. Bauer',  'Main Hall'),
                ],
            },
            {
                'name': 'Craft', 'color': '#7C5DFA', 'order_index': 1,
                'sessions': [
                    (10, 30, 60, 'Typography at the Edge of Display',  'C. Delacroix','Room B'),
                    (13, 0,  45, 'Accessible Motion by Default',       'M. Johansson','Room B'),
                    (14, 15, 60, 'Workshop: Figma Variables Deep Dive','P. Walsh',   'Room B'),
                ],
            },
        ],
    },
    9: {  # Model Eval Workshop
        'tracks': [
            {
                'name': 'Evaluations', 'color': '#4A9EFF', 'order_index': 0,
                'sessions': [
                    (9,  0,  45, 'Why Evals Fail and How to Fix Them',   'D. Kim',   'Virtual'),
                    (10, 0,  60, 'Building Automated Eval Pipelines',    'P. Nair',  'Virtual'),
                    (11, 30, 30, 'Lightning: Five Eval Anti-Patterns',   'S. Costa', 'Virtual'),
                    (14, 0,  45, 'Human Preference Data at Scale',       'S. Costa', 'Virtual'),
                    (15, 0,  60, 'Measuring Regression Across Versions', 'R. Pham',  'Virtual'),
                ],
            },
        ],
    },
}


def make_dt(event_date: date, hour: int, minute: int) -> datetime:
    return datetime(event_date.year, event_date.month, event_date.day, hour, minute)


def seed():
    db = SessionLocal()
    try:
        events = db.query(Event).filter(Event.id.in_(AGENDA.keys())).all()
        event_map = {e.id: e for e in events}

        seeded, skipped = 0, 0

        for event_id, agenda in AGENDA.items():
            event = event_map.get(event_id)
            if not event:
                print(f"  [SKIP] Event {event_id} not found in DB")
                continue

            existing = db.query(Track).filter(Track.event_id == event_id).count()
            if existing > 0:
                print(f"  [SKIP] Event {event_id} already has {existing} track(s)")
                skipped += 1
                continue

            event_date = event.start_datetime.date()

            for track_def in agenda['tracks']:
                track = Track(
                    event_id=event_id,
                    name=track_def['name'],
                    color=track_def.get('color'),
                    order_index=track_def['order_index'],
                )
                db.add(track)
                db.flush()  # get track.id

                for idx, (hour, minute, dur, title, speaker, location) in enumerate(track_def['sessions']):
                    start = make_dt(event_date, hour, minute)
                    end = start + timedelta(minutes=dur)
                    session = AgendaSession(
                        track_id=track.id,
                        event_id=event_id,
                        title=title,
                        speaker_name=speaker,
                        location=location,
                        start_datetime=start,
                        end_datetime=end,
                        order_index=idx,
                        requires_registration=False,
                    )
                    db.add(session)

            db.commit()
            n_tracks = len(agenda['tracks'])
            n_sessions = sum(len(t['sessions']) for t in agenda['tracks'])
            print(f"  [OK]   Event {event_id} — {n_tracks} track(s), {n_sessions} session(s)")
            seeded += 1

        print(f"\nDone. Seeded: {seeded}  Skipped: {skipped}")
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    print("Seeding agenda data...")
    seed()
