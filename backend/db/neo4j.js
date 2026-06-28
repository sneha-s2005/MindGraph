const neo4j = require('neo4j-driver');

let driver;

function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      console.warn('⚠️  Neo4j credentials not set. Graph features will be unavailable.');
      return null;
    }

    console.log(`Connecting to Neo4j at ${uri} as user: ${username}`);
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    console.log('✅ Neo4j driver initialized');

    // Asynchronously create constraints and indexes for production query optimization
    (async () => {
      try {
        const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
        await session.run(`CREATE CONSTRAINT user_id_constraint IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`);
        await session.run(`CREATE INDEX habit_name_idx IF NOT EXISTS FOR (h:Habit) ON (h.name)`);
        await session.run(`CREATE INDEX person_name_idx IF NOT EXISTS FOR (p:Person) ON (p.name)`);
        await session.run(`CREATE INDEX activity_name_idx IF NOT EXISTS FOR (a:Activity) ON (a.name)`);
        await session.run(`CREATE INDEX goal_title_idx IF NOT EXISTS FOR (g:Goal) ON (g.title)`);
        await session.close();
        console.log('✅ Neo4j database indexes & constraints verified');
      } catch (err) {
        console.warn('⚠️ Failed to initialize Neo4j database indexes:', err.message);
      }
    })();
  }
  return driver;
}

/**
 * Run a Cypher query and return records as plain JS objects.
 * @param {string} cypher
 * @param {object} params
 * @returns {Promise<object[]>}
 */
async function runQuery(cypher, params = {}) {
  const d = getDriver();
  if (!d) throw new Error('Neo4j is not configured.');

  const database = process.env.NEO4J_DATABASE || 'neo4j';
  const session = d.session({ database });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const obj = {};
      record.keys.forEach((key) => {
        const value = record.get(key);
        // Convert Neo4j integers to JS numbers
        if (neo4j.isInt(value)) {
          obj[key] = value.toNumber();
        } else if (value && typeof value === 'object' && value.properties) {
          // Node object — extract properties
          const props = {};
          Object.entries(value.properties).forEach(([k, v]) => {
            props[k] = neo4j.isInt(v) ? v.toNumber() : v;
          });
          obj[key] = props;
        } else {
          obj[key] = value;
        }
      });
      return obj;
    });
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

process.on('SIGTERM', closeDriver);
process.on('SIGINT', closeDriver);

module.exports = { runQuery, getDriver, closeDriver };
