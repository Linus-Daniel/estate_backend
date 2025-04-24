const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

// Store the io instance in the app for access in controllers
app.set('io', io);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('a user connected');

  // Join a conversation
  socket.on('join chat', (chatId) => {
    socket.join(chatId);
    console.log(`User joined chat: ${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});