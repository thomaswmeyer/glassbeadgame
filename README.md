# Glass Bead Game - LLM Edition

An LLM-based version of the Glass Bead Game where players respond to AI-generated topics and receive scores based on semantic distance and relevance.

## Game Concept

The Glass Bead Game is inspired by Hermann Hesse's novel of the same name. In this digital adaptation:

1. Claude (an LLM by Anthropic) proposes an initial thought-provoking topic
2. Players respond with their own insights, connections, or reflections
3. Responses are scored based on two criteria:
   - **Semantic Distance (1-10)**: How far the response has moved from the original topic while still maintaining a meaningful connection
   - **Relevance and Quality (1-10)**: How insightful and well-articulated the response is in relation to the topic
4. The total score is the sum of these two values (maximum 20 points)

## Features

- AI-generated thought-provoking topics using Claude
- Interactive response submission
- Detailed evaluation of responses with scoring
- Beautiful and intuitive user interface

## Getting Started

### Prerequisites

- Node.js 16.8 or later
- An Anthropic API key

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

3. Create a `.env.local` file in the root directory and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Technology Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Anthropic Claude API](https://anthropic.com/) - For generating topics and evaluating responses
- [Axios](https://axios-http.com/) - For API requests
- [HeadlessUI](https://headlessui.com/) - Accessible UI components

## License

This project is licensed under the MIT License - see the LICENSE file for details.
