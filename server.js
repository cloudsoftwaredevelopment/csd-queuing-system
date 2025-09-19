const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let queueSystem = {
  queues: [],
  activeServices: [],
  nextQueueNumbers: {},
  totalServed: 0,
  categories: ["Cashier", "Registrar"],
  reservations: []
};

// Serve static frontend files (your index.html, styles.css, script.js)
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Send current state to the new client
  socket.emit("queue_state", queueSystem);

  // When employee updates queue
  socket.on("update_queue", (data) => {
    queueSystem = data;
    console.log("Queue updated, broadcasting...");
    io.emit("queue_state", queueSystem); // broadcast to everyone
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
