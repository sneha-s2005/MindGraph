# MindGraph — Hackathon Submission Materials

This file contains the complete content for the **PowerPoint Slide Deck** and the **DEV.TO / Medium Blog Post** as specified in the hackathon guidelines (Day 7).

---

## 📊 PowerPoint Slide Deck (5 Slides)

### Slide 1 — PROBLEM
* **Title:** You're burning out and you don't even know it
* **Key Statistics:**
  * **77%** of knowledge workers have experienced burnout in their current role (Gallup 2023).
  * Most professionals only recognize severe burnout after **3+ months** of progressive decline.
  * Burnout costs the global economy **$125–$190 billion** annually in healthcare costs and lost productivity.
* **The Root Problem:**
  * Existing tracking apps are *passive* (they record data but do not analyze relationships).
  * People cannot visualize the complex, interconnected behavioral habits that predict high stress levels.
  * We lack an early warning system that actively intercepts burnout before it peaks.

---

### Slide 2 — SOLUTION
* **Title:** MindGraph: Your AI-Powered Behavioral Intelligence OS
* **Core Value Proposition:**
  * **30-Second Logging:** Quick, low-friction slider for mood + checkboxes for energy and habits.
  * **Neo4j Graph Database:** Instantly connects moods, daily energy, and habit nodes to map relationships.
  * **Early Warning Engine:** Predictive algorithm computes a real-time burnout score based on trend analysis, energy depletion, and skipped habits.
  * **Personalized AI Coach:** Delivers 3 daily, hyper-personalized insights using GPT-3.5 based on your active graph.
* **User Journey:**
  * `Log daily habits` ➔ `Graph connections` ➔ `Predict burnout risk` ➔ `Personalized AI advice` ➔ `Act on warnings`

---

### Slide 3 — TECH STACK
* **Title:** Built for intelligence, not just storage
* **Frontend:**
  * **Expo & React Native:** Clean tabbed navigation, responsive SVG rendering, and haptic feedback.
  * **react-native-chart-kit:** Elegant 7-day mood trend visualization.
* **Backend:**
  * **Express.js (Node.js):** REST API routes connecting the mobile app to Neo4j.
* **Database & AI:**
  * **Neo4j AuraDB:** Graph database to capture complex habit correlations using Cypher queries.
  * **OpenAI API:** GPT-3.5-turbo wellness engine parsing structured graph data into actionable coach summaries.
* **Prototyping & Infrastructure:**
  * **Base44 / Render.com:** Complete API hosting, environment separation, and rapid local iteration.

---

### Slide 4 — DEMO
* **Title:** See MindGraph in action
* **Interactive Features:**
  * **Screen 1 (Home/Dashboard):** Displays your dynamic, animated circular Burnout Risk Gauge (Safe/Caution/Burnout Risk), time-based greeting, and current logging streak.
  * **Screen 2 (Log Screen):** Emoji-reactive slider, Low/Medium/High energy select buttons, habit checkboxes with haptic feedback, and notes input.
  * **Screen 3 (Insights Screen):** Staggered cards showing top habit-mood correlations, the weekly chart, and the GPT-3.5 AI Insight card.
* **Neo4j Graph Relationship Model:**
  * `(User)-[:LOGGED]->(MoodEntry)`
  * `(User)-[:COMPLETED]->(HabitLog)-[:FOR_HABIT]->(Habit)`
  * `(HabitLog)-[:ON_DAY]->(MoodEntry)`

---

### Slide 5 — BUSINESS MODEL
* **Title:** Scalable from day one
* **Go-To-Market & Pricing Structure:**
  * **Free Tier:** 7-day analytics history, core habit trackers, and local AI advice.
  * **Pro Tier ($9.99/mo):** Unlimited historical graph tracking, deep AI pattern recognition, and custom habits.
  * **Enterprise Tier ($49/user/mo):** Anonymous team wellness dashboards and HR burnout prevention analytics.
* **Addressable Market:**
  * Over **50M+** remote and hybrid knowledge workers globally who struggle with work-life integration.
* **Financial Projection:**
  * Target: **$1M ARR** within 18 months by securing 10,000 active Pro subscribers.

---

## ✍️ DEV.TO / Medium Blog Post

### How I Built an AI-Powered Habit Graph App in 7 Days as a Solo Beginner Using Neo4j, Expo, and Antigravity

**Introduction**
Burnout is a silent productivity killer. As a solo beginner entering the HACKHAZARDS '26 hackathon, I set out to build a tool that didn't just count habits, but understood how they affect our mental well-being. The result is **MindGraph**—an AI-powered wellness dashboard that correlates daily habits with mental health.

**Why I Chose Neo4j for Behavioral Analytics**
Most tracking apps use standard SQL tables to record habits. However, human experience isn't tabular; it's a web of connected events. By choosing a graph database like **Neo4j AuraDB**, I was able to model relationship paths directly: `(User)-[:COMPLETED]->(HabitLog)-[:ON_DAY]->(MoodEntry)`. Using Neo4j's Cypher query language, finding the top habits on high-mood days is simplified into matching patterns rather than performing heavy SQL JOIN queries. This relationship-first architecture allows MindGraph to dynamically evaluate the correlation between sleeping 7+ hours and having a high mood of 8/10.

**How Antigravity Helped Me Accelerate the Build**
Building a full-stack mobile-first application in a single week is daunting for a beginner. Using the Antigravity AI assistant, I was able to scaffold the Expo frontend using TypeScript, create the Express.js API, write the complex Cypher queries for Neo4j, and handle fallback local storage. The AI acted as a pair programmer, explaining graph database connections, optimizing the SVG needle rotations for the burnout risk gauge, and helping me resolve React Native Web animation issues with strict platform checks.

**The Biggest Technical Challenge**
The most challenging part of the project was connecting the Expo frontend to the Neo4j backend during offline environments. To ensure a premium UX, I designed a **dual-save and sync pattern**. When a user logs mood and habits, it is saved instantly to local AsyncStorage so the application remains functional offline. Then, the client attempts to sync the payload to the Neo4j backend. If the backend is unreachable or the user is offline, the app dynamically falls back to calculating burnout indicators and trends locally, ensuring the UI is always responsive.

**Key Takeaways**
If I were to start over, I would begin testing deployments on Render.com earlier to iron out network routing. Nonetheless, the hackathon prototype is a success. By combining a graph database, AI intelligence, and a clean mobile interface, MindGraph demonstrates that we can proactively intercept burnout before it takes a toll.

**Links:**
* **GitHub Repository:** [Insert GitHub URL]
* **Expo Go / Base44 Demo:** [Insert Demo Link]
* **Tags:** `#neo4j` `#expo` `#reactnative` `#ai` `#hackathon` `#buildinpublic`
