import { createClient } from 'redis';
 export class LeaderboardManager {
 constructor() {
 this.client = createClient({
 url: process.env.REDIS_URL || 'redis://localhost:6379'
 });
 this.client.connect().catch(console.error);
 }
 async updateScore(username, score) {
 await this.client.zIncrBy('leaderboard', score, username);
 }
 async getTop(count = 10) {
 const result = await this.client.zRangeWithScores('leaderboard', 0, count - 1, {
 REV: true
 });
 return result.map((item, index) => ({
 rank: index + 1,
 username: item.value,
 score: item.score
 }));
 }
 async getUserRank(username) {
 const rank = await this.client.zRevRank('leaderboard', username);
 const score = await this.client.zScore('leaderboard', username);
 return {
 rank: rank !== null ? rank + 1 : null,
 score: score || 0
 };
 }
 }