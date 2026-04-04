# Vyapari — The Smart Merchant
**Autonomous E-Commerce Operations & Personalization Platform**

---

## Project Structure

```
vyapari/
├── backend/
│   ├── main.py                  # FastAPI app (all routes)
│   ├── requirements.txt
│   ├── data/
│   │   ├── seed.py              # Run once to generate mock data
│   │   └── *.json               # Generated after seed.py
│   └── modules/
│       ├── recommender.py       # SVD + semantic search
│       ├── inventory_agent.py   # Inventory & pricing agent
│       ├── review_agent.py      # Sentiment + response generation
│       └── decision_store.py    # SQLite HITL audit log
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/               # Dashboard, Recommendations, Inventory, Reviews, Decisions, CustomerHome
    │   └── components/UI.jsx    # Shared components
    ├── package.json
    └── vite.config.js
```

---

## Setup & Run

### Step 1 — Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate mock data (run once)
python data/seed.py

# Start the API server
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

**Optional:** Add OpenAI key for AI-generated review responses:
```bash
export OPENAI_API_KEY=sk-...     # Without this, template responses are used
```

---

### Step 2 — Frontend

```bash
cd frontend

npm install
npm run dev
```

Dashboard available at: http://localhost:5173

---

## How to Demo

1. Open the dashboard → you'll see stock and review stats
2. Click **Run Inventory Scan** → agent flags low-stock & overpriced products
3. Go to **Decisions** tab → approve or reject each agent recommendation
4. Click **Process Reviews** → agent classifies sentiment and drafts responses
5. Go to **Reviews** tab → edit drafts and approve/reject them
6. Go to **Recommendations** → enter User ID (U001–U050) or search naturally

---

## Customer Dashboard (Store)

The platform now includes a public‑facing **Customer Dashboard** (accessible via the **Store** link in the sidebar) that demonstrates the end‑user shopping experience:

- **Product catalogue** with realistic mock data (25 products across 5 categories)
- **Personalised recommendation strip** powered by SVD collaborative filtering
- **Semantic search** that understands natural‑language queries
- **Stock indicators** and category badges
- **Add‑to‑cart** and **view‑details** actions (UI only — no checkout in MVP)

To try the customer dashboard:
1. Start the backend and frontend as described above.
2. Navigate to **http://localhost:5173/store** (or click **Store** in the sidebar).
3. Browse products, use the search bar, and see recommendations tailored to user `U001`.

This surface fulfills the **Customer Dashboard** requirements from the TRD and completes the three‑surface architecture (Customer, Seller, HITL).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| Recommendation Engine | scikit-surprise (SVD) |
| Sentiment Classification | HuggingFace distilbert-base-uncased-finetuned-sst-2-english |
| Review Response | OpenAI GPT-3.5-turbo (template fallback if no key) |
| Decision Store | SQLite |
| Frontend | React 18 + Vite + Tailwind CSS |
| Charts | Recharts |

---

## Key Design Decisions

- **Human-in-the-Loop first**: No agent action executes without operator approval
- **Confidence scores**: Every decision shows how confident the agent is (0–1)
- **Audit log**: Every decision — approved or rejected — stored permanently with reasoning
- **Graceful degradation**: Works without GPU, without OpenAI key, with minimal hardware
- **Simulated data**: No external APIs needed to demo — fully self-contained
