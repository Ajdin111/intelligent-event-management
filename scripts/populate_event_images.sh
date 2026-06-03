#!/usr/bin/env bash
# Populate every event with a topic-matched TECH cover image.
# Uses curated Unsplash tech photos (stable CDN), downloads each once into
# backend/uploads, then sets events.cover_image by theme in the docker DB.
# (No associative arrays -> works on macOS bash 3.2.)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPLOAD_DIR="$ROOT/backend/uploads"
DB="intelligent-event-management-db-1"
mkdir -p "$UPLOAD_DIR"

# theme -> Unsplash photo id (all verified tech imagery)
img_id() {
  case "$1" in
    ai)       echo "1485827404703-89b55fcc595e" ;;  # white humanoid robot / AI
    ai2)      echo "1620712943543-bcc4688e7485" ;;  # glowing AI brain
    cloud)    echo "1451187580459-43490279c0fa" ;;  # network / connectivity
    server)   echo "1558494949-ef010cbdcc31"   ;;  # data center server room
    data)     echo "1591238372338-22d30c883a86" ;;  # data infrastructure racks
    circuit)  echo "1518770660439-4636190af475" ;;  # circuit board
    security) echo "1550751827-4bd374c3f58b"   ;;  # cybersecurity padlock
    matrix)   echo "1526374965328-7f61d4dc18c5" ;;  # matrix code / privacy
    code1)    echo "1517694712202-14dd9538aa97" ;;  # code on screen
    code2)    echo "1461749280684-dccba630e2f6" ;;  # colorful code
    code3)    echo "1573164713714-d95e436ab8d6" ;;  # programming code
    code4)    echo "1487058792275-0ad4aaf24ca7" ;;  # code editor
    laptop1)  echo "1504384308090-c894fdcc538d" ;;  # laptop workspace coding
    laptop2)  echo "1488590528505-98d2b5aba04b" ;;  # macbook on desk
    laptop3)  echo "1531297484001-80022131f5a1" ;;  # laptop dark
    crypto)   echo "1639762681485-074b7f938ba0" ;;  # crypto / fintech
  esac
}

THEMES="ai ai2 cloud server data circuit security matrix code1 code2 code3 code4 laptop1 laptop2 laptop3 crypto"

# download each unique image once -> uploads/tech-<theme>.jpg
for t in $THEMES; do
  out="$UPLOAD_DIR/tech-$t.jpg"; id="$(img_id "$t")"
  if [ ! -s "$out" ]; then
    for a in 1 2 3; do
      c="$(curl -s -o "$out" -w "%{http_code}" -L "https://images.unsplash.com/photo-$id?w=1200&h=600&fit=crop&q=80")"
      { [ "$c" = "200" ] && [ -s "$out" ]; } && break; sleep 1
    done
  fi
  [ -s "$out" ] || echo "WARN: failed to fetch theme $t"
done

# pick theme by title (rotate within category by id for variety)
theme_for() {
  local t; t="$(echo "$1" | tr '[:upper:]' '[:lower:]')"; local id="$2"; local even=$((id % 2))
  case "$t" in
    *ai*|*machine\ learning*|*generative*|*llmop*|*vector*|*data\ science*) [ $even -eq 0 ] && echo ai || echo ai2 ;;
    *kubernetes*|*cloud*|*serverless*|*edge*|*infrastructure*|*platform*)   [ $even -eq 0 ] && echo cloud || echo server ;;
    *security*|*privacy*|*zero\ trust*)                                     [ $even -eq 0 ] && echo security || echo matrix ;;
    *blockchain*|*fintech*|*crypto*)                                        echo crypto ;;
    *data*)                                                                 [ $even -eq 0 ] && echo data || echo server ;;
    *devops*|*sre*|*observability*|*microservices*|*delivery*|*distributed*) [ $even -eq 0 ] && echo data || echo circuit ;;
    *react*|*frontend*|*full\ stack*|*typescript*|*javascript*|*web*|*developer\ experience*|*graphql*|*api*)
        case $((id % 4)) in 0) echo code1;; 1) echo code2;; 2) echo code3;; *) echo code4;; esac ;;
    *ux*|*design*)                                                          echo circuit ;;
    *rust*|*systems*|*architecture*|*python*|*testing*|*quality*|*mobile*|*open\ source*|*productivity*)
        case $((id % 3)) in 0) echo laptop1;; 1) echo laptop2;; *) echo code3;; esac ;;
    *startup*|*founder*|*growth*|*pitch*|*network*)                         echo crypto ;;
    *leadership*|*product*|*agile*|*scrum*|*career*|*remote*|*healthtech*)  [ $even -eq 0 ] && echo laptop3 || echo laptop2 ;;
    *workshop*|*bootcamp*|*masterclass*|*intensive*)                        echo laptop1 ;;
    *)                                                                      echo circuit ;;
  esac
}

rows="$(docker exec "$DB" psql -U postgres -d event_management -At -F '|' \
  -c "SELECT id, title FROM events WHERE deleted_at IS NULL ORDER BY id;")"

ok=0
while IFS='|' read -r id title; do
  [ -z "$id" ] && continue
  th="$(theme_for "$title" "$id")"; p="/uploads/tech-$th.jpg"
  docker exec "$DB" psql -U postgres -d event_management -q \
    -c "UPDATE events SET cover_image='$p' WHERE id=$id;"
  echo "id=$id [$th] $title -> $p"
  ok=$((ok+1))
done <<< "$rows"
echo "Updated $ok events."
