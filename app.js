const express = require("express");
const app = express();
require('dotenv').config();
const indexRouter = require("./routes");
const path = require("path");


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
io.on("connection", function(socket){
    socket.on("joinroom",function(){
        if( waitingusers.length > 0){
            let partner = waitingusers.shift();
            const roomname = `${socket.id}-${partner.id}`;
            socket.join(roomname);
            partner.join(roomname);

            io.to(roomname).emit("joined",roomname);
        }else{
            waitingusers.push(socket);
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


    try {
        await newMessage.save();
        console.log('Message saved to MongoDB');
    } catch (err) {
        console.error('Error saving message:', err);
    }

    })

    socket.on("message", async function(data){
        socket.broadcast.to(data.room).emit("message",data.message)

        // Save chat message to MongoDB
    const newMessage = new Message({
        room: data.room,
        senderId: socket.id,
        message: data.message
    });

    try {
        await newMessage.save();
    } catch (err) {
        console.error('Error saving message:', err);
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
        let index = waitingusers.findIndex((waitingUser) => waitingUser.id === socket.id );
        if(index !== -1){
        waitingusers.splice(index, 1);
    }//help to remove that index from waiting list from splice function
    })
})



app.use("/", indexRouter);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});


