const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const port = process.env.PORT || 3000;

app.set('view engine', 'hbs');

let activePlayers = [];
let currentPlayerIndex = 0;

app.get('/', (req, res) => {
  res.render('index');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  if (activePlayers.length >= 4) {
    socket.emit('serverFull');
    socket.disconnect();
    return;
  }

  socket.emit('activePlayers', activePlayers);

  socket.on('rollDice', () => {
    const currentPlayer = activePlayers[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.playerId !== socket.id) {
      return;
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;
    io.emit('diceRolled', { playerId: socket.id, diceValue });

    // Move turn to the next player
    currentPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[currentPlayerIndex];
    if (nextPlayer) {
      io.to(nextPlayer.playerId).emit('yourTurn');
    }
  });

  socket.on('joinGame', (playerName) => {
    if (activePlayers.length >= 4) {
      socket.emit('serverFull');
      return;
    }

    const playerId = socket.id;
    const newPlayer = { playerId, playerName };
    activePlayers.push(newPlayer);

    io.emit('playerJoined', newPlayer);
    io.emit('activePlayers', activePlayers);

    // If the current player is the first player to join, it's their turn
    if (activePlayers.length === 1) {
      io.to(playerId).emit('yourTurn');
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');

    const disconnectedPlayer = activePlayers.find((player) => player.playerId === socket.id);
    if (disconnectedPlayer) {
      activePlayers = activePlayers.filter((player) => player.playerId !== socket.id);
      io.emit('playerDisconnected', disconnectedPlayer.playerId);
      io.emit('activePlayers', activePlayers);

      // If the disconnected player was the current player, move turn to the next player
      if (currentPlayerIndex >= activePlayers.length) {
        currentPlayerIndex = 0;
        const nextPlayer = activePlayers[currentPlayerIndex];
        if (nextPlayer) {
          io.to(nextPlayer.playerId).emit('yourTurn');
        }
      }
    }
  });
});

http.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});
