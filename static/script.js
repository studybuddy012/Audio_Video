const socket = io();
let localStream;
let peerConnection;
let roomId;
let iceCandidateQueue = [];

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// 1. Join Room
function joinRoom() {
    roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Please enter a room ID");
    
    socket.emit('join', { room: roomId });
    document.getElementById('setup-container').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    
    initMedia();
}

// 2. Initialize Camera/Mic
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
        console.warn("Camera failed, trying audio only", e);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            alert("No media devices found.");
            return;
        }
    }
    document.getElementById('localVideo').srcObject = localStream;
}

// 3. WebRTC Connection Setup
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    updateStatus("Connecting...");

    // Add local tracks to the connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
        updateStatus("Connected");
    };

    // Handle ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { room: roomId, type: 'candidate', candidate: event.candidate });
        }
    };
}

// 4. Signaling Logic (Offer/Answer/Candidates)
async function startCall() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { room: roomId, type: 'offer', offer: offer });
}

socket.on('signal', async (data) => {
    if (!peerConnection) createPeerConnection();

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { room: roomId, type: 'answer', answer: answer });
        processIceQueue();
    } 
    else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        processIceQueue();
    } 
    else if (data.type === 'candidate') {
        if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
            iceCandidateQueue.push(data.candidate);
        }
    }
});

function processIceQueue() {
    while (iceCandidateQueue.length > 0) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.shift()));
    }
}

// Chat Logic
function sendMessage() {
    const msg = document.getElementById('chat-input-field').value;
    if (!msg) return;
    socket.emit('chat_message', { room: roomId, message: msg });
    appendMessage("You: " + msg);
    document.getElementById('chat-input-field').value = '';
}

socket.on('chat_message', (data) => {
    appendMessage("Them: " + data.message);
});

function appendMessage(text) {
    const div = document.createElement('div');
    div.innerText = text;
    document.getElementById('chat-messages').appendChild(div);
}

function updateStatus(text) {
    document.getElementById('call-status').innerText = "Status: " + text;
}