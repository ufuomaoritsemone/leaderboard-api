const Redis = require('ioredis');
// Connects to the Redis instance using the REDIS_URL environment variable
const redis = new Redis(process.env.REDIS_URL);

module.exports = async function handler(req, res) {
  // Add CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const KV_KEY = 'dd2104_leaderboard';

  try {
    if (req.method === 'GET') {
      const data = await redis.get(KV_KEY);
      const records = data ? JSON.parse(data) : [];
      return res.status(200).json(records);

    } else if (req.method === 'POST') {
      const { name, time, difficulty, seconds } = req.body;
      
      if (!name || seconds === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const data = await redis.get(KV_KEY);
      let records = data ? JSON.parse(data) : [];
      
      records.push({
        name: String(name).toUpperCase(),
        time,
        difficulty: String(difficulty).toLowerCase(),
        seconds: Number(seconds),
        date: new Date().toISOString()
      });

      // Sort: Difficulty (Impossible > Hard > Easy), then Time (seconds ascending)
      const diffWeight = { 'impossible': 3, 'hard': 2, 'easy': 1 };
      records.sort((a, b) => {
          const weightA = diffWeight[a.difficulty] || 0;
          const weightB = diffWeight[b.difficulty] || 0;
          if (weightB !== weightA) return weightB - weightA;
          return a.seconds - b.seconds;
      });

      // Keep top 50
      if (records.length > 50) records.splice(50);

      await redis.set(KV_KEY, JSON.stringify(records));
      
      return res.status(200).json(records);
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
