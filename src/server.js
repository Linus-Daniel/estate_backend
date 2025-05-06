require('dotenv').config();
const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Message = require('./models/Message'); // Make sure you have this model
const { authenticateSocket } = require('./middleware/auth');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    console.log('Starting connections...');
    await connectDB();
    console.log('Database connected successfully.');

    const server = http.createServer(app);
    
    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      }
    });

    // Set io instance on app for access in routes
    app.set('io', io);

    // Socket.io middleware for authentication
    io.use(async (socket, next) => {
      try {
        await authenticateSocket(socket);
        next();
      } catch (err) {
        console.error('Socket authentication failed:', err.message);
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      console.log(`User ${socket.user?.id} connected with socket ID: ${socket.id}`);

      // Handle joining chat rooms
      socket.on('joinChat', async (chatId) => {
        try {
          if (!chatId) {
            throw new Error('Chat ID is required');
          }
          
          socket.join(chatId);
          console.log(`User ${socket.user.id} joined chat: ${chatId}`);

          // Mark messages as read when joining
          await Message.updateMany(
            { 
              chat: chatId, 
              recipient: socket.user.id, 
              read: false 
            },
            { 
              $set: { 
                read: true, 
                readAt: new Date() 
              } 
            }
          );
        } catch (err) {
          console.error('Error joining chat:', err.message);
          socket.emit('error', { message: 'Failed to join chat' });
        }
      });

      // Handle sending messages
      socket.on('sendMessage', async ({ chatId, content }, callback) => {
        try {
          if (!chatId || !content) {
            throw new Error('Chat ID and content are required');
          }

          // Create and save message to database
          const message = new Message({
            chat: chatId,
            sender: socket.user.id,
            content,
            read: false
          });

          const savedMessage = await message.save();
          const populatedMessage = await Message.findById(savedMessage._id)
            .populate('sender', 'name avatar');

          // Broadcast to all in the chat room including sender
          io.to(chatId).emit('newMessage', populatedMessage);

          // Acknowledge to sender
          if (typeof callback === 'function') {
            callback({ 
              status: 'success', 
              message: populatedMessage 
            });
          }
        } catch (err) {
          console.error('Error sending message:', err.message);
          if (typeof callback === 'function') {
            callback({ 
              status: 'error', 
              message: err.message 
            });
          }
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicator
      socket.on('typing', (chatId) => {
        if (!chatId) return;
        
        socket.to(chatId).emit('userTyping', { 
          userId: socket.user.id,
          chatId 
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user?.id} disconnected (socket ID: ${socket.id})`);
      });

      // Error handling for individual socket
      socket.on('error', (err) => {
        console.error('Socket error:', err);
      });
    });

    // Global error handling
    io.on('connection_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();