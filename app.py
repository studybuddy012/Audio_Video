import os
from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
app.config['SECRET_KEY'] = '9106'
# cors_allowed_origins="*" is required for cross-device testing
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    print(f"User joined room: {room}")
    # Notify others in the room
    emit('status', {'msg': 'A new user has joined.'}, to=room, include_self=False)

@socketio.on('chat_message')
def handle_chat(data):
    room = data['room']
    emit('chat_message', data, to=room, include_self=False)

# WebRTC Signaling Events
@socketio.on('signal')
def handle_signal(data):
    room = data['room']
    # Forward the signal (offer/answer/candidate) to the other user in the room
    emit('signal', data, to=room, include_self=False)

if __name__ == '__main__':
    # Use standard run for local, gunicorn will handle production
    socketio.run(app, debug=True)