const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start everything inside an async block
(async () => {

  
  try {
    console.log("starting connections")
    await connectDB(); // First: connect to DB
    console.log('Database connected successfully.');

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
      },
    });

    app.set('io', io);

    io.on('connection', (socket) => {
      console.log('A user connected');

      socket.on('join chat', (chatId) => {
        socket.join(chatId);
        console.log(`User joined chat: ${chatId}`);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected');
      });
    });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1); // Kill process if DB or anything fails
  }
})();
