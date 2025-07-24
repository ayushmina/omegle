const express = require("express");
const app = express();
require('dotenv').config();
const indexRouter = require("./routes");
const path = require("path");
const mongoose = require('mongoose');

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);

const db = require("./config/db");
db();
const Message = require("./models/message");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));



let waitingusers =[];
let connectedUsers = new Map(); // Track connected users and their rooms

function broadcastUserCount() {
    const totalUsers = waitingusers.length + connectedUsers.size;
    io.emit("userCount", totalUsers);
}

io.on("connection", function(socket){
    console.log(`User connected: ${socket.id}`);
    broadcastUserCount();
    
    socket.on("joinroom",function(){
        if( waitingusers.length > 0){
            let partner = waitingusers.shift();
            const roomname = `${socket.id}-${partner.id}`;
            socket.join(roomname);
            partner.join(roomname);

            // Track the connection
            connectedUsers.set(socket.id, { room: roomname, partner: partner.id });
            connectedUsers.set(partner.id, { room: roomname, partner: socket.id });

            io.to(roomname).emit("joined", {
                room: roomname,
                message: "You are now connected to a stranger!"
            });
            
            broadcastUserCount();
        }else{
            waitingusers.push(socket);
            broadcastUserCount();
        }
    });

    // Handle "next" functionality - disconnect current chat and find new partner
    socket.on("nextUser", function(){
        const currentConnection = connectedUsers.get(socket.id);
        
        if(currentConnection){
            // Notify the current partner that user left
            socket.to(currentConnection.room).emit("partnerLeft", {
                message: "Stranger has disconnected"
            });
            
            // Leave current room
            socket.leave(currentConnection.room);
            
            // Remove from connected users
            connectedUsers.delete(socket.id);
            connectedUsers.delete(currentConnection.partner);
            
            // Add partner back to waiting list if they're still connected
            const partnerSocket = io.sockets.sockets.get(currentConnection.partner);
            if(partnerSocket){
                waitingusers.push(partnerSocket);
            }
        }
        
        // Remove from waiting list if already there
        waitingusers = waitingusers.filter(user => user.id !== socket.id);
        
        // Try to find new partner immediately
        if( waitingusers.length > 0){
            let partner = waitingusers.shift();
            const roomname = `${socket.id}-${partner.id}`;
            socket.join(roomname);
            partner.join(roomname);

            // Track the new connection
            connectedUsers.set(socket.id, { room: roomname, partner: partner.id });
            connectedUsers.set(partner.id, { room: roomname, partner: socket.id });

            io.to(roomname).emit("joined", {
                room: roomname,
                message: "You are now connected to a stranger!"
            });
            
            broadcastUserCount();
        }else{
            waitingusers.push(socket);
            socket.emit("waiting", {
                message: "Looking for someone to chat with..."
            });
            broadcastUserCount();
        }
    });
    //typing...
    socket.on('userTyping', () => {
    showTypingIndicator();
});
    socket.on('typing', function(data) {
    socket.broadcast.to(data.room).emit('userTyping');
});




    socket.on("signalingMessage", async function(data){
        socket.broadcast.to(data.room).emit("signalingMessage",data.message);

        // Save signaling message only if MongoDB is connected
        if (mongoose.connection.readyState === 1) {
            try {
                // Parse the JSON string back to an object
                let parsedMessage;
                try {
                    parsedMessage = JSON.parse(data.message);
                } catch (err) {
                    console.error('Failed to parse signaling message:', err);
                    parsedMessage = data.message; // fallback
                }

                const newMessage = new Message({
                    room: data.room,
                    senderId: socket.id,
                    message: parsedMessage  // Store as an Object
                });

                await newMessage.save();
            } catch (err) {
                console.error('Error saving signaling message:', err);
            }
        }
    })

    socket.on("message", async function(data){
        socket.broadcast.to(data.room).emit("message",data.message)

        // Save chat message only if MongoDB is connected
        if (mongoose.connection.readyState === 1) {
            try {
                const newMessage = new Message({
                    room: data.room,
                    senderId: socket.id,
                    message: data.message
                });

                await newMessage.save();
            } catch (err) {
                console.error('Error saving message:', err);
            }
        }
    })

    socket.on("startVideoCall",function({room}){
        socket.broadcast.to(room).emit("incomingCall");
    })

    socket.on("rejectCall",function({room}){
        socket.broadcast.to(room).emit("callRejected");
    })

    socket.on("acceptCall",function({room}){
        socket.broadcast.to(room).emit("callAccepted");
    })

    socket.on("disconnect",function(){
        console.log(`User disconnected: ${socket.id}`);
        
        const currentConnection = connectedUsers.get(socket.id);
        
        if(currentConnection){
            // Notify partner that user disconnected
            socket.to(currentConnection.room).emit("partnerLeft", {
                message: "Stranger has disconnected"
            });
            
            // Remove from connected users
            connectedUsers.delete(socket.id);
            connectedUsers.delete(currentConnection.partner);
            
            // Add partner back to waiting list
            const partnerSocket = io.sockets.sockets.get(currentConnection.partner);
            if(partnerSocket){
                waitingusers.push(partnerSocket);
                partnerSocket.emit("waiting", {
                    message: "Looking for someone to chat with..."
                });
            }
        }
        
        // Remove from waiting list
        let index = waitingusers.findIndex((waitingUser) => waitingUser.id === socket.id );
        if(index !== -1){
            waitingusers.splice(index, 1);
        }
        
        broadcastUserCount();
    })
})



app.use("/", indexRouter);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});


