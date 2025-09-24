// server.js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080, host: "0.0.0.0" });
console.log("🚀 CloudArt WS server listening on :8080");

let players = new Map();

function broadcastState() {
  const state = [];
  players.forEach((val, id) => state.push({ id, ...val }));
  const msg = JSON.stringify({ type: "state", players: state });
  wss.clients.forEach(c => {
    if (c.readyState === c.OPEN) c.send(msg);
  });
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 9);
  players.set(id, { player: "unknown", x:0, y:0, z:0, pitch:0, roll:0, yaw:0, throttle:0 });
  ws.send(JSON.stringify({ type: "welcome", id }));
  console.log(`✅ Client ${id} connected`);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      // store data while preserving id
      players.set(id, { id, ...data });
    } catch (e) {
      console.error("Bad msg", msg.toString());
    }
  });

  ws.on("close", () => {
    console.log(`❌ Client ${id} disconnected`);
    players.delete(id);
  });
});

setInterval(broadcastState, 50); // 20 Hz
