# Glass Bead Game - LLM Edition

An LLM-based version of the Glass Bead Game where players respond to AI-generated topics and receive scores based on semantic distance and relevance.

## Game Concept

The Glass Bead Game is inspired by Hermann Hesse's novel of the same name. In this digital adaptation:

1. An AI proposes an initial thought-provoking topic
2. Players respond with their own insights, connections, or reflections
3. Responses are scored based on two criteria:
   - **Semantic Distance (1-10)**: How far the response has moved from the original topic while still maintaining a meaningful connection
   - **Relevance and Quality (1-10)**: How insightful and well-articulated the response is in relation to the topic
4. The total score is the sum of these two values (maximum 20 points)

## Features

- AI-generated thought-provoking topics
- Interactive response submission
- Detailed evaluation of responses with scoring
- Beautiful spring-based force-directed graph visualization (D3.js)
- Multiple AI model support (Gemini, Claude, DeepSeek)
- Cost-optimized for production deployment

## Technology Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Google Gemini API](https://ai.google.dev/) - Default AI model (most cost-effective)
- [Anthropic Claude API](https://anthropic.com/) - Optional premium AI model
- [DeepSeek API](https://deepseek.com/) - Optional budget AI model
- [D3.js](https://d3js.org/) - Dynamic force-directed graph visualization
- [Axios](https://axios-http.com/) - API requests
- [HeadlessUI](https://headlessui.com/) - Accessible UI components

## Getting Started

### Prerequisites

- Node.js 20.19.0 or later
- A Google Gemini API key (free tier available)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/glassbeadgame.git
   cd glassbeadgame
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your API key(s):
   ```
   # Required - Get a free key at https://aistudio.google.com/
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Optional - for Claude models
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   
   # Optional - for DeepSeek models
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   
   # Production mode - locks to Gemini only (hides model selector)
   NEXT_PUBLIC_PRODUCTION_MODE=true
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Cost Estimates

Using Gemini 3 Flash (default):
- **~$0.0036 per game** (5 rounds)
- 1,000 games/day = ~$3.60/day or $108/month
- Excellent quality-to-cost ratio for creative tasks

## Production Deployment

When deploying to production:

1. Set `NEXT_PUBLIC_PRODUCTION_MODE=true` in your environment variables
2. This locks the app to Gemini Flash only and hides the model selector
3. Most cost-effective option for public demos

## License

This project is licensed under the MIT License - see the LICENSE file for details.
