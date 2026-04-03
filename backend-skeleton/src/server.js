import cors from 'cors';
import express from 'express';
import http from 'http';
import { devicesRouter } from './routes/devices.js';
import { keysRouter } from './routes/keys.js';
import { messagesRouter } from './routes/messages.js';
import { parentRouter } from './routes/parent.js';
import { callsRouter } from './routes/calls.js';
import { createSocketServer } from './socket/index.js';

const app = express();
const server = http.createServer(app);
const { io, emitToUser } = createSocketServer(server);

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
  });
});

app.use('/devices', devicesRouter);
app.use('/users', keysRouter);
app.use('/messages', messagesRouter({ io, emitToUser }));
app.use('/calls', callsRouter);
app.use('/api/parent', parentRouter);

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Pulse backend skeleton listening on ${port}`);
});
