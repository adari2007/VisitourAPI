import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { environment } from './config/environment.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { errorHandler } from './middleware/index.js';
import authRoutes from './routes/auth.js';
import itineraryRoutes from './routes/itineraries.js';
import entryRoutes from './routes/entries.js';

const app = express();
const server = http.createServer(app);

// Socket.io setup for real-time updates
const io = new Server(server, {
  cors: {
    origin: environment.cors.origin,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({ origin: environment.cors.origin }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/entries', entryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-itinerary', (itineraryId: string) => {
    socket.join(`itinerary:${itineraryId}`);
    console.log(`User joined itinerary: ${itineraryId}`);
  });

  socket.on('leave-itinerary', (itineraryId: string) => {
    socket.leave(`itinerary:${itineraryId}`);
    console.log(`User left itinerary: ${itineraryId}`);
  });

  socket.on('itinerary-updated', (data: any) => {
    io.to(`itinerary:${data.itineraryId}`).emit('itinerary-updated', data);
  });

  socket.on('entry-created', (data: any) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-created', data);
  });

  socket.on('entry-updated', (data: any) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-updated', data);
  });

  socket.on('entry-deleted', (data: any) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-deleted', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start server
async function start() {
  try {
    console.log('Starting server...');
    await initializeDatabase();
    console.log('Database initialized');


    server.listen(environment.port, () => {
      console.log(`✓ Server running on http://localhost:${environment.port}`);
      console.log(`✓ WebSocket available at ws://localhost:${environment.port}`);
      console.log(`✓ Database: ${environment.nodeEnv} mode`);
      console.log(`✓ CORS origin: ${environment.cors.origin}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
});

start();

