# Career Journey AI

An AI-powered interview coaching application that helps users practice their interview skills with real-time voice interaction, LiveKit audio rooms, and feedback.

## Features

- **Job-specific Setup**: Choose your job title, experience level, and target company
- **LiveKit Audio Rooms**: High-quality real-time audio communication
- **Voice Interaction**: Questions are spoken aloud using text-to-speech
- **Real-time Transcription**: Your answers are transcribed as you speak
- **AI Feedback**: Get detailed analysis and improvement suggestions after the interview
- **Progress Tracking**: Visual progress indicator throughout the interview
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Real-time Audio**: LiveKit for high-quality voice communication
- **Styling**: Tailwind CSS
- **Voice Features**: Web Speech API (Speech Recognition & Synthesis)
- **Audio Recording**: MediaRecorder API
- **AI Integration**: Ready for OpenAI API integration

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for LiveKit server)
- Modern web browser with microphone access
- (Optional) OpenAI API key for real AI feedback

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd interview-coach-ai
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Start the LiveKit server:
\`\`\`bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or using Docker directly
docker run --rm -it -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \\
  -e LIVEKIT_API_KEY=devkey \\
  -e LIVEKIT_API_SECRET=secret \\
  livekit/livekit-server
\`\`\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### LiveKit Setup

The application uses LiveKit for real-time audio communication. For development:

1. **Local Development**: Use the provided Docker setup (recommended)
2. **LiveKit Cloud**: Sign up at [cloud.livekit.io](https://cloud.livekit.io) and update your `.env.local`:
   \`\`\`
   LIVEKIT_API_KEY=your_api_key
   LIVEKIT_API_SECRET=your_api_secret
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   \`\`\`

## Usage

1. **Setup**: Select your job title, experience level, and optionally specify a target company
2. **Audio Room**: Connect to the LiveKit audio room for high-quality communication
3. **Interview**: Answer questions using your microphone - they'll be transcribed in real-time
4. **Progress**: Track your progress through the interview questions
5. **Feedback**: Receive detailed AI-powered analysis and improvement suggestions
6. **Review**: View your complete transcript and performance metrics

## Architecture

### LiveKit Integration
- **Audio Rooms**: Each interview session creates a unique LiveKit room
- **Real-time Communication**: High-quality audio streaming
- **Token-based Authentication**: Secure room access with JWT tokens
- **Audio-only Mode**: Optimized for interview scenarios

### Components
- **Interview Setup**: Job configuration and room creation
- **LiveKit Room**: Real-time audio communication
- **Speech Recognition**: Browser-based transcription
- **AI Feedback**: Performance analysis and recommendations

## Browser Compatibility

- **Chrome/Edge**: Full support for all features including LiveKit
- **Firefox**: Full support for all features including LiveKit
- **Safari**: Limited speech recognition support, LiveKit works
- **Mobile**: Basic functionality (may have limited voice features)

## Development

### Running LiveKit Server
\`\`\`bash
# Start LiveKit server
docker-compose up -d

# View logs
docker-compose logs -f livekit

# Stop server
docker-compose down
\`\`\`

### Environment Variables
\`\`\`bash
# LiveKit Configuration
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880

# Optional: OpenAI for real AI feedback
OPENAI_API_KEY=your_openai_api_key
\`\`\`

## Current Features

- ✅ LiveKit audio rooms for real-time communication
- ✅ Speech-to-text transcription
- ✅ Text-to-speech for questions
- ✅ Mock AI feedback system
- ✅ Progress tracking and interview flow
- ✅ Responsive design

## Future Enhancements

- Real OpenAI integration for intelligent feedback
- Video recording capabilities
- Multiple interview types (technical, behavioral, etc.)
- Interview history and progress tracking
- Custom question sets
- Collaborative features with mentors
- Screen sharing for technical interviews

## Troubleshooting

### LiveKit Connection Issues
1. Ensure Docker is running and LiveKit server is started
2. Check that ports 7880, 7881, and 7882 are not in use
3. Verify environment variables are set correctly
4. Check browser console for WebRTC errors

### Audio Issues
1. Grant microphone permissions in your browser
2. Check that no other applications are using your microphone
3. Test with different browsers if issues persist

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with LiveKit server running
5. Submit a pull request

## License

MIT License - see LICENSE file for details 