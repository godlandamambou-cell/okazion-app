// ==========================================
// OKAZION STORE - SERVEUR NODE.JS PRODUCTION
// ==========================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Connexion Supabase Production
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xvrhubmhscaazmhytmla.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_EQB1DluDwn4QT58HJt6hJg_Bw170zA1";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check de production
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    app: 'okazion.store',
    timestamp: new Date().toISOString(),
    agora_chat_app_key: "611245890#1429081"
  });
});

// API Endpoint : Récupérer toutes les annonces
app.get('/api/annonces', async (req, res) => {
  try {
    const { data, error } = await supabase.from('annonces').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint : Publier une annonce
app.post('/api/annonces', async (req, res) => {
  try {
    const { title, price, city, category, type, condition, description, photos } = req.body;
    const { data, error } = await supabase.from('annonces').insert([{
      title, price, city, category, type, condition, description, photos
    }]).select();

    if (error) throw error;
    
    // Diffusion temps réel via Socket.io à tous les clients connectés
    io.emit('new_annonce', data[0]);

    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gestion du Temps Réel (WebSockets & Agora Chat Relay)
io.on('connection', (socket) => {
  console.log(`[OKAZION SOCKET] Client connecté : ${socket.id}`);

  socket.on('join_chat_room', (roomID) => {
    socket.join(roomID);
    console.log(`Socket ${socket.id} a rejoint la discussion ${roomID}`);
  });

  socket.on('send_chat_message', (data) => {
    io.to(data.roomID).emit('receive_chat_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`[OKAZION SOCKET] Client déconnecté : ${socket.id}`);
  });
});

// --- INTÉGRATION DU FRONTEND STATIQUE ---
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[OKAZION PRODUCTION] Serveur en écoute sur le port ${PORT}`);
});