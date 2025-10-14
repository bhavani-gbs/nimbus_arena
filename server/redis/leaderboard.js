import { createClient } from 'redis';

export class LeaderboardManager {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    
    this.client.connect().catch(console.error);
  }

  async updateScore(username, score) {
    try {
      await this.client.zAdd('leaderboard', { score, value: username });
    } catch (error) {
      console.error('Redis update error:', error);
    }
  }

  async getTop(count = 10) {
    try {
      const result = await this.client.zRevRangeWithScores('leaderboard', 0, count - 1);
      return result.map((item, index) => ({
        rank: index + 1,
        username: item.value,
        score: Math.floor(item.score)
      }));
    } catch (error) {
      console.error('Redis getTop error:', error);
      return [];
    }
  }
}