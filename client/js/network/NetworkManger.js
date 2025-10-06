export class NetworkManager {
 constructor() {
 this.ws = null;
 this.connected = false;
 this.listeners = new Map();
 }
 connect(token) {
 this.ws = new WebSocket('ws://localhost:3000');
 this.ws.onopen = () => {
 this.connected = true;
 console.log('Connected to server');
 // Authenticate
 this.send({
 type: 'AUTH',
 token: token
 });
 };
 this.ws.onmessage = (event) => {
 const data = JSON.parse(event.data);
 this.emit(data.type, data);
 };
 this.ws.onerror = (error) => {
 console.error('WebSocket error:', error);
 };
 this.ws.onclose = () => {
 this.connected = false;
 console.log('Disconnected from server');
console.log('Disconnected from server');
 // Try to reconnect after 3 seconds
 setTimeout(() => {
 if (!this.connected) {
 this.connect(token);
 }
 }, 3000);
 };
 }
 send(data) {
 if (this.ws && this.ws.readyState === WebSocket.OPEN) {
 this.ws.send(JSON.stringify(data));
 }
 }
 on(event, callback) {
 if (!this.listeners.has(event)) {
 this.listeners.set(event, []);
 }
 this.listeners.get(event).push(callback);
 }
 emit(event, data) {
 if (this.listeners.has(event)) {
 this.listeners.get(event).forEach(callback => callback(data));
 }
 }
 disconnect() {
 if (this.ws) {
 this.ws.close();
 }
 }
 }