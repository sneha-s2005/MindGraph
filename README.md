<img width="4320" height="1440" alt="hh26 main poster 2 with sponsors 3x1 (4320 x 1440 px) (2)" src="https://github.com/user-attachments/assets/c698b2cd-da84-4cb0-9276-125c6a7244aa" />


# 🚀 MindGraph

> Track your habits. Map your mind. Intercept burnout before it happens.

---

## 📌 Problem & Domain

Burnout is a silent productivity killer. Gallup reports that **77% of knowledge workers** have experienced burnout in their current role. Most professionals only recognize severe burnout after **3+ months** of progressive decline, costing the global economy **$125–$190 billion** annually in healthcare costs and lost productivity.

The root cause is structural: existing tracking apps are passive. They record isolated data columns (e.g., mood on Monday, sleep on Tuesday) but cannot see the relationship between them. Without the ability to traverse behavioral relationships, no app can actively intercept burnout before it peaks.

**Themes Selected (at least one):**
- [x] Human Experience & Productivity  
- [ ] Climate & Sustainability Systems  
- [ ] HealthTech & Bio Platforms  
- [ ] Learning & Knowledge Systems  
- [ ] Work, Finance & Digital Economy  
- [ ] Infrastructure, Mobility & Smart Systems  
- [ ] Trust, Identity & Security  
- [ ] Media, Social & Interactive Platforms  
- [ ] Public Systems, Governance and Civic Tech  
- [ ] Developer Tools & Software Infrastructure  

*(You can select multiple themes if applicable)*

---

## 🎯 Objective

MindGraph is an AI-Powered Behavioral Intelligence OS that treats your daily life like it actually is — one connected system, not separate apps. It serves remote and hybrid knowledge workers who struggle with work-life balance and are at risk of mental exhaustion.

MindGraph solves this by:
1. **Low-Friction Logging**: A 30-second daily log for sleep, mood, energy, stress, and core habits.
2. **Graph Traversal**: Storing behaviors as interconnected nodes in a **Neo4j AuraDB** graph, enabling instant discovery of multi-hop behavioral patterns (e.g., how skipping meditation on high-stress days impacts mood and productivity).
3. **Proactive Intervention**: Calculating a real-time Burnout Risk Score and generating daily personalized AI wellness coaching insights via OpenAI GPT-3.5/GPT-4 based on active graph data.

---

## 🧠 Team & Approach

### Team Name:  
`Dark Pulse`

### Team Members:  
- **Manoj H.G (Lead)** — [GitHub](https://github.com/manojhg321) | Lead Developer  
- **Dileep MK** — [GitHub](https://github.com/dileep-mk) | Backend & Database Developer  
- **Sneha S** — [GitHub](https://github.com/sneha-s2005) | Frontend & AI Integration  
- **Chinmay J C** — [GitHub](https://github.com/chinmaychoudhari620) | UI/UX & QA  

### Your Approach:
- **Why we chose this**: We wanted to build a wellness tracker that captures real human complexity. Tabular databases struggle with causal connections across various factors, so we chose Neo4j to model relationship paths directly: `(User)-[:COMPLETED]->(HabitLog)-[:ON_DAY]->(MoodEntry)`.
- **Key challenges addressed**: Handling offline/spotty internet connections while keeping the graph updated. We solved this with a **dual-save and sync pattern** using AsyncStorage locally, which dynamically falls back to local calculations if the backend server is unreachable.
- **Pivots & Breakthroughs**: Scaled local calculations for the complex Behavioral Intelligence Score (BIS), burnout risk gauge needle animation, and correlation paths so that the client UI is fully functional and responsive even offline.

---

## 🛠️ Tech Stack

### Core Technologies Used:
- **Frontend**: Expo SDK 56 & React Native 0.85, TypeScript 6.0, AsyncStorage, react-native-svg, react-native-chart-kit
- **Backend**: Node.js & Express.js REST API
- **Database**: Neo4j AuraDB (Graph Database, Cypher Query Language)
- **APIs**: OpenAI API (GPT-3.5-turbo & GPT-4)
- **Hosting**: Render.com (hosted backend API and React Native Web build hosting)

### Additional Technologies Used (Optional):
- [x] AI / ML  
- [ ] Web3 / Blockchain  
- [ ] Cyber Security  
- [x] Cloud  

---

## 🏆 Sponsored Track (Optional)

Select if your project participates in any track:

- [x] **Expo Track** – Built using Expo  
- [x] **Neo4j Track** – Powered by Neo4j AuraDB graph database and Cypher queries
