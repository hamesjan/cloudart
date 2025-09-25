// server.js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080, host: "0.0.0.0" });
console.log("🚀 CloudArt WS server listening on :8080");

let players = new Map();

function broadcastState() {
  const state = [];
  players.forEach((val, id) => state.push({ id, ...val }));
  const msg = JSON.stringify({ type: "state", players: state });
  console.log(msg);
  wss.clients.forEach(c => {
    if (c.readyState === c.OPEN) c.send(msg);
  });
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 9);
  players.set(id, { player: "unknown", x:0, y:0, z:0, pitch:0, roll:0, yaw:0, throttle:0 });

  // send welcome only to this client
  ws.send(JSON.stringify({ type: "welcome", id }));

  // tell others a new player joined
  const joinMsg = JSON.stringify({ type: "playerJoined", id });
  wss.clients.forEach(c => {
    if (c.readyState === c.OPEN && c !== ws) {
      c.send(joinMsg);
    }
  });

  console.log(`✅ Client ${id} connected`);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      players.set(id, { id, ...data });
    } catch (e) {
      console.error("Bad msg", msg.toString());
    }
  });

  ws.on("close", () => {
    console.log(`❌ Client ${id} disconnected`);
    players.delete(id);

    const leaveMsg = JSON.stringify({ type: "playerLeft", id });
    wss.clients.forEach(c => {
      if (c.readyState === c.OPEN) c.send(leaveMsg);
    });
  });
});


setInterval(broadcastState, 50); // 20 Hz
