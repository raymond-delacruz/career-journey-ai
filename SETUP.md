# Setup Guide for Career Journey AI

## Quick Start (Without LiveKit)

If you want to test the basic functionality without LiveKit:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

The app will work with basic speech recognition and synthesis, but LiveKit audio rooms will show a "Connecting..." state.

## Full Setup (With LiveKit)

### Option 1: Using Docker (Recommended)

1. **Install Docker:**
   - **Mac**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - **Windows**: Download Docker Desktop
   - **Linux**: Use your package manager (e.g., `sudo apt install docker.io docker-compose`)

2. **Start LiveKit server:**
   ```bash
   # Using newer Docker Compose syntax
   docker compose up -d
   
   # Or using older syntax
   docker-compose up -d
   
   # Or run directly with Docker
   docker run --rm -d --name livekit-server \
     -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
     -e LIVEKIT_API_KEY=devkey \
     -e LIVEKIT_API_SECRET=secret \
     livekit/livekit-server
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

### Option 2: Using LiveKit Cloud

1. **Sign up for LiveKit Cloud:**
   - Go to [cloud.livekit.io](https://cloud.livekit.io)
   - Create a free account
   - Create a new project

2. **Update environment variables:**
   ```bash
   # Edit .env.local
   LIVEKIT_API_KEY=your_api_key_from_cloud
   LIVEKIT_API_SECRET=your_api_secret_from_cloud
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

## Testing the Application

### Without LiveKit
- Basic speech recognition and synthesis will work
- Interview flow and feedback system are fully functional
- LiveKit audio room will show "Connecting..." state

### With LiveKit
- Full real-time audio communication
- High-quality audio streaming
- Professional interview experience
- Connection status indicators

## Troubleshooting

### Docker Issues
```bash
# Check if Docker is running
docker --version

# Check if LiveKit container is running
docker ps

# View LiveKit logs
docker logs livekit-server

# Stop and restart LiveKit
docker stop livekit-server
docker run --rm -d --name livekit-server \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_API_KEY=devkey \
  -e LIVEKIT_API_SECRET=secret \
  livekit/livekit-server
```

### Browser Issues
- **Chrome/Edge**: Best compatibility
- **Firefox**: Good compatibility
- **Safari**: Limited speech recognition
- **Mobile**: Basic functionality

### Audio Permission Issues
1. Click the microphone icon in your browser's address bar
2. Allow microphone access
3. Refresh the page
4. Test with a simple recording first

### Port Conflicts
If ports 7880-7882 are in use:
```bash
# Check what's using the ports
lsof -i :7880
lsof -i :7881
lsof -i :7882

# Kill processes if needed
sudo kill -9 <PID>
```

## Development Workflow

1. **Start LiveKit server:**
   ```bash
   docker compose up -d
   ```

2. **Start Next.js development server:**
   ```bash
   npm run dev
   ```

3. **Open multiple browser tabs to test:**
   - Each tab will join the same interview room
   - Test audio communication between tabs

4. **View logs:**
   ```bash
   # LiveKit logs
   docker compose logs -f livekit
   
   # Next.js logs
   # Check your terminal where npm run dev is running
   ```

5. **Stop services:**
   ```bash
   # Stop LiveKit
   docker compose down
   
   # Stop Next.js (Ctrl+C in terminal)
   ```

## Environment Variables Reference

```bash
# Required for LiveKit functionality
LIVEKIT_API_KEY=devkey                    # Your LiveKit API key
LIVEKIT_API_SECRET=secret                 # Your LiveKit API secret
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880  # LiveKit server URL

# Optional for AI feedback
OPENAI_API_KEY=your_openai_api_key        # OpenAI API key

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Your app URL
```

## Next Steps

1. Test the basic interview flow
2. Try the LiveKit audio room functionality
3. Experiment with different browsers
4. Customize questions in `app/interview/page.tsx`
5. Integrate real AI feedback via OpenAI API 