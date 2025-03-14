"use client";

import { useState, KeyboardEvent, useEffect } from 'react';
import axios from 'axios';
import ModelSelector from './ModelSelector';
import SimpleConceptGraph from './SimpleConceptGraph';

interface Score {
  semanticDistance: number;
  relevanceQuality: number;
  total: number;
  originalTopicConnection?: number;
  currentConnection?: {
    semanticDistance: number;
    similarity: number;
    subtotal: number;
  };
  originalConnection?: {
    semanticDistance: number;
    similarity: number;
    subtotal: number;
  };
}

interface GameHistory {
  round: number;
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  player: 'human' | 'ai';
}

interface PlayerScore {
  human: number;
  ai: number;
}

type CurrentEvaluation = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  player: 'human' | 'ai';
  finalEvaluation?: string;
};

export default function GameInterface() {
  const [topic, setTopic] = useState<string>('');
  const [originalTopic, setOriginalTopic] = useState<string>('');
  const [topicDefinition, setTopicDefinition] = useState<string>('');
  const [showDefinition, setShowDefinition] = useState<boolean>(false);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState<boolean>(false);
  const [originalTopicDefinition, setOriginalTopicDefinition] = useState<string>('');
  const [showOriginalDefinition, setShowOriginalDefinition] = useState<boolean>(false);
  const [isLoadingOriginalDefinition, setIsLoadingOriginalDefinition] = useState<boolean>(false);
  const [response, setResponse] = useState<string>('');
  const [evaluation, setEvaluation] = useState<string>('');
  const [scores, setScores] = useState<Score | null>(null);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [showingResults, setShowingResults] = useState<boolean>(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<CurrentEvaluation | null>(null);
  const [totalScores, setTotalScores] = useState<PlayerScore>({ human: 0, ai: 0 });
  const [currentPlayer, setCurrentPlayer] = useState<'human' | 'ai'>('human');
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [finalEvaluation, setFinalEvaluation] = useState<string>('');
  
  // New state variables for user settings
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [aiGoesFirst, setAiGoesFirst] = useState<boolean>(false);
  const [circleEnabled, setCircleEnabled] = useState<boolean>(false);
  const [roundOptions] = useState<number[]>([4, 6, 8, 10, 12, 14, 16, 20]);
  
  // Simplified difficulty level - single setting for both concept and AI
  type DifficultyLevel = 'secondary' | 'university' | 'unlimited';
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('university');
  const difficultyLevels: DifficultyLevel[] = ['secondary', 'university', 'unlimited'];
  
  // Difficulty level descriptions
  const difficultyDescriptions = {
    secondary: "High school level concepts and vocabulary",
    university: "Undergraduate level academic concepts",
    unlimited: "Advanced, specialized, and abstract concepts"
  };

  // Use maxRounds instead of hardcoded value
  const FINAL_ROUND = maxRounds;

  // Add a state variable to track graph key for forcing re-renders
  const [graphKey, setGraphKey] = useState<number>(0);

  const generateFirstTopic = async () => {
    console.log('=== GENERATING FIRST TOPIC ===');
    console.log('aiGoesFirst setting:', aiGoesFirst);
    
    // First, make sure the game is not started to prevent AI from responding to loading message
    setGameStarted(false);
    setIsGeneratingTopic(true);
    
    // Set a temporary loading message as the topic
    setTopic('Generating new topic...');
    setShowingResults(false);
    setCurrentEvaluation(null);
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    setGameCompleted(false);
    
    // Set the current player immediately based on aiGoesFirst
    const initialPlayer = aiGoesFirst ? 'ai' : 'human';
    console.log('Setting initial player to:', initialPlayer);
    setCurrentPlayer(initialPlayer);
    
    try {
      const result = await axios.post('/api/generate-topic', {
        difficulty: difficulty
      });
      const newTopic = result.data.topic;
      setTopic(newTopic);
      setOriginalTopic(newTopic); // Store the original topic
      setResponse('');
      setEvaluation('');
      setScores(null);
      
      // Reset graph key only when starting a new game
      setGraphKey(prevKey => prevKey + 1);
      
      // Ensure the player is set correctly again after the API call
      console.log('Confirming player after API call:', initialPlayer);
      setCurrentPlayer(initialPlayer);
      setCurrentRound(1);
      setGameHistory([]);
      setTotalScores({ human: 0, ai: 0 });
      
      // Only now that we have a real topic, start the game
      setGameStarted(true);
    } catch (error) {
      console.error('Error generating topic:', error);
      alert('Failed to generate topic. Please try again.');
    } finally {
      setIsGeneratingTopic(false);
      // Log the final state
      console.log('Topic generation completed. Current player:', aiGoesFirst ? 'ai' : 'human');
    }
  };

  const fetchTopicDefinition = async () => {
    if (!topic || isLoadingDefinition) return;
    
    setIsLoadingDefinition(true);
    try {
      const result = await axios.post('/api/get-definition', {
        topic,
      });
      
      setTopicDefinition(result.data.definition);
      setShowDefinition(true);
    } catch (error) {
      console.error('Error fetching definition:', error);
      setTopicDefinition('Unable to fetch definition at this time.');
      setShowDefinition(true);
    } finally {
      setIsLoadingDefinition(false);
    }
  };

  const fetchOriginalTopicDefinition = async () => {
    if (!originalTopic || isLoadingOriginalDefinition) return;
    
    setIsLoadingOriginalDefinition(true);
    try {
      const result = await axios.post('/api/get-definition', {
        topic: originalTopic,
      });
      
      setOriginalTopicDefinition(result.data.definition);
      setShowOriginalDefinition(true);
    } catch (error) {
      console.error('Error fetching original topic definition:', error);
      setOriginalTopicDefinition('Unable to fetch definition at this time.');
      setShowOriginalDefinition(true);
    } finally {
      setIsLoadingOriginalDefinition(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && response.trim()) {
      e.preventDefault();
      evaluateResponse();
    }
  };

  const evaluateResponse = async () => {
    if (!topic || !response) return;
    
    setIsEvaluating(true);
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        let evaluationEndpoint = '/api/evaluate-response';
        let requestBody: any = { 
          topic, 
          response,
          difficulty: difficulty // Use the single difficulty level
        };
        
        // For the final round with circle enabled, use the special evaluation endpoint
        if (currentRound === maxRounds && circleEnabled) {
          evaluationEndpoint = '/api/evaluate-final-response';
          requestBody = { 
            currentTopic: topic, 
            originalTopic: originalTopic, 
            response,
            difficulty: difficulty // Use the single difficulty level
          };
        }
        
        console.log(`Evaluation attempt ${retries + 1}/${maxRetries}`);
        const res = await fetch(evaluationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error(`HTTP error ${res.status}:`, errorData);
          throw new Error(`HTTP error ${res.status}: ${errorData.error || 'Unknown error'}`);
        }

        const data = await res.json();
        
        // Handle final round evaluation differently if circle is enabled
        if (currentRound === maxRounds && circleEnabled) {
          setCurrentEvaluation({
            topic,
            response,
            player: currentPlayer,
            evaluation: data.evaluation,
            finalEvaluation: data.finalEvaluation,
            scores: data.scores,
          });
          setGameCompleted(true);
        } else {
          setCurrentEvaluation({
            topic,
            response,
            player: currentPlayer,
            evaluation: data.evaluation,
            scores: data.scores,
          });
          
          // Set game completed if it's the final round (even without circle)
          if (currentRound === maxRounds) {
            setGameCompleted(true);
          }
        }
        
        setTotalScores(prev => ({
          ...prev,
          human: prev.human + data.scores.total
        }));
        setShowingResults(true);
        
        // Add to game history
        setGameHistory(prev => [
          ...prev,
          {
            round: currentRound,
            topic,
            response,
            evaluation: data.evaluation,
            scores: data.scores,
            player: 'human'
          }
        ]);
        
        // No need to update graph key here - the SimpleConceptGraph component will handle the animation
        // based on changes to gameHistory
        
        setResponse('');
        
        // Success, exit the retry loop
        break;
        
      } catch (error) {
        console.error(`Evaluation attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          alert('Failed to evaluate response after multiple attempts. Please try again.');
        } else {
          // Wait before retrying (exponential backoff)
          const backoffTime = 1000 * Math.pow(2, retries);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }
    }
    
    setIsEvaluating(false);
  };

  const evaluateAiResponse = async (aiResponse: string) => {
    if (!topic || !aiResponse) return;
    
    setIsEvaluating(true);
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        let evaluationEndpoint = '/api/evaluate-response';
        let requestBody: any = { 
          topic, 
          response: aiResponse,
          difficulty: difficulty // Use the single difficulty level
        };
        
        // For the final round with circle enabled, use the special evaluation endpoint
        if (currentRound === maxRounds && circleEnabled) {
          evaluationEndpoint = '/api/evaluate-final-response';
          requestBody = { 
            currentTopic: topic, 
            originalTopic: originalTopic, 
            response: aiResponse,
            difficulty: difficulty // Use the single difficulty level
          };
        }
        
        console.log(`AI evaluation attempt ${retries + 1}/${maxRetries}`);
        const res = await fetch(evaluationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error(`HTTP error ${res.status}:`, errorData);
          throw new Error(`HTTP error ${res.status}: ${errorData.error || 'Unknown error'}`);
        }

        const data = await res.json();
        
        // Handle final round evaluation differently if circle is enabled
        if (currentRound === maxRounds && circleEnabled) {
          setCurrentEvaluation({
            topic,
            response: aiResponse,
            player: 'ai',
            evaluation: data.evaluation,
            finalEvaluation: data.finalEvaluation,
            scores: data.scores,
          });
        } else {
          setCurrentEvaluation({
            topic,
            response: aiResponse,
            player: 'ai',
            evaluation: data.evaluation,
            scores: data.scores,
          });
        }
        
        setTotalScores(prev => ({
          ...prev,
          ai: prev.ai + data.scores.total
        }));
        setShowingResults(true);
        
        // Add to game history
        setGameHistory(prev => [
          ...prev,
          {
            round: currentRound,
            topic,
            response: aiResponse,
            evaluation: data.evaluation,
            scores: data.scores,
            player: 'ai'
          }
        ]);
        
        // No need to update graph key here - the SimpleConceptGraph component will handle the animation
        // based on changes to gameHistory
        
        // Set game completed if it's the final round
        if (currentRound === maxRounds) {
          setGameCompleted(true);
        }
        
        // Success, exit the retry loop
        break;
        
      } catch (error) {
        console.error(`AI evaluation attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries >= maxRetries) {
          // If all retries fail, create a fallback evaluation
          const fallbackScores = {
            semanticDistance: 5,
            relevanceQuality: 5,
            total: 10
          };
          
          setCurrentEvaluation({
            topic,
            response: aiResponse,
            player: 'ai',
            evaluation: "I couldn't evaluate this response properly. Here's a default score.",
            scores: fallbackScores,
          });
          
          setTotalScores(prev => ({
            ...prev,
            ai: prev.ai + fallbackScores.total
          }));
          
          setShowingResults(true);
          
          // Add to game history with fallback evaluation
          setGameHistory(prev => [
            ...prev,
            {
              round: currentRound,
              topic,
              response: aiResponse,
              evaluation: "Evaluation failed. Default score applied.",
              scores: fallbackScores,
              player: 'ai'
            }
          ]);
          
          // Set game completed if it's the final round
          if (currentRound === maxRounds) {
            setGameCompleted(true);
          }
        } else {
          // Wait before retrying (exponential backoff)
          const backoffTime = 1000 * Math.pow(2, retries);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }
    }
    
    setIsEvaluating(false);
  };

  const handleNextTurn = () => {
    // If game is completed, don't proceed
    if (gameCompleted) return;
    
    console.log('=== NEXT TURN ===');
    console.log('Current round:', currentRound);
    console.log('Current player:', currentPlayer);
    console.log('Current response state:', response);
    console.log('Current evaluation state:', currentEvaluation);
    console.log('Game history:', gameHistory);
    
    // Get the response that will become the next topic
    let nextTopic = '';
    
    if (currentPlayer === 'human') {
      // If it's currently human's turn, use their response as the next topic
      nextTopic = response;
      console.log('Using human response as next topic:', nextTopic);
    } else if (currentEvaluation) {
      // If it's AI's turn, use the AI's response from the evaluation
      nextTopic = currentEvaluation.response;
      console.log('Using AI response as next topic:', nextTopic);
    } else {
      console.error('Current evaluation is null:', currentEvaluation);
      console.error('Current player is AI but no evaluation is available');
    }
    
    if (!nextTopic || !nextTopic.trim()) {
      console.error('No valid next topic found!');
      console.error('Response value:', response);
      console.error('Current evaluation:', JSON.stringify(currentEvaluation, null, 2));
      console.error('Current player:', currentPlayer);
      
      // Try to recover by using the last response from game history
      if (gameHistory.length > 0) {
        const lastEntry = gameHistory[gameHistory.length - 1];
        console.log('Attempting to recover using last game history entry:', lastEntry);
        if (lastEntry && lastEntry.response) {
          nextTopic = lastEntry.response;
          console.log('Recovered next topic from game history:', nextTopic);
        }
      }
      
      // If still no valid topic, alert the user
      if (!nextTopic || !nextTopic.trim()) {
        console.error('Recovery failed, no valid topic found in game history');
        alert('Error: Could not determine the next topic. Please restart the game.');
        return;
      }
    }
    
    // Use the player's response as the next topic
    console.log('Setting next topic:', nextTopic);
    setTopic(nextTopic);
    
    // Increment round and reset states
    setCurrentRound(prev => prev + 1);
    setShowingResults(false);
    setCurrentEvaluation(null);
    setResponse('');
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    
    // We don't need to update the graph key here since the gameHistory hasn't changed yet
    // The graph will update when the next response is evaluated
    
    // Switch players
    const nextPlayer = currentPlayer === 'human' ? 'ai' : 'human';
    console.log('Switching player to:', nextPlayer);
    setCurrentPlayer(nextPlayer);
  };

  // AI's turn to respond
  useEffect(() => {
    const aiTakeTurn = async () => {
      if (gameStarted && currentPlayer === 'ai' && !showingResults && !isGeneratingTopic) {
        // Skip AI turn if the topic is still loading
        if (topic === 'Generating new topic...') {
          console.log('Skipping AI turn because topic is still loading');
          return;
        }
        
        console.log('=== AI TURN STARTED ===');
        console.log('Current round:', currentRound);
        console.log('Current topic:', topic);
        console.log('Original topic:', originalTopic);
        console.log('Game history length:', gameHistory.length);
        console.log('Full game history:', JSON.stringify(gameHistory, null, 2));
        console.log('Max rounds:', maxRounds);
        console.log('Difficulty level:', difficulty);
        console.log('Circle enabled:', circleEnabled);
        
        setIsAiThinking(true);
        try {
          // For the final round with circle enabled, we need to inform the AI that it needs to connect back to the original topic
          const endpoint = (currentRound === maxRounds && circleEnabled) ? '/api/ai-final-response' : '/api/ai-response';
          console.log('Using endpoint:', endpoint);
          
          // Prepare game history in the correct format
          const formattedHistory = gameHistory.map(item => ({
            round: item.round,
            topic: item.topic,
            response: item.response,
            evaluation: item.evaluation,
            scores: item.scores,
            player: item.player
          }));
          
          console.log('Sending request to AI endpoint:', {
            endpoint,
            topic,
            originalTopic,
            gameHistoryLength: formattedHistory.length,
            difficulty: difficulty
          });
          
          // Create a simplified payload for debugging
          const debugPayload = {
            topic,
            originalTopic,
            gameHistoryCount: formattedHistory.length,
            difficulty: difficulty,
            circleEnabled: circleEnabled
          };
          console.log('Request payload (simplified):', JSON.stringify(debugPayload));
          
          // Get AI response to the current topic
          console.log('Making axios request...');
          const result = await axios.post(endpoint, {
            topic,
            originalTopic: originalTopic,
            gameHistory: formattedHistory,
            difficulty: difficulty,
            circleEnabled: circleEnabled
          });
          
          console.log('Axios request completed');
          console.log('Response status:', result.status);
          console.log('Response data:', result.data);
          
          let aiResponse = result.data.response;
          console.log('Received AI response:', aiResponse);
          
          // Ensure we have a valid response
          if (!aiResponse || !aiResponse.trim()) {
            console.warn('Empty AI response received, generating a fallback response');
            
            // Generate a fallback response based on the current topic
            aiResponse = `Response to ${topic}`;
            console.log('Generated fallback response:', aiResponse);
          }
          
          console.log('Final AI response:', aiResponse);
          setResponse(aiResponse);
          
          // Wait a moment to simulate thinking
          console.log('Waiting before evaluation...');
          setTimeout(() => {
            console.log('Timeout completed, evaluating AI response');
            // Call evaluate directly with the response instead of using the state
            evaluateAiResponse(aiResponse);
          }, 1500);
          
        } catch (error: any) {
          console.error('=== AI RESPONSE ERROR ===');
          console.error('Error getting AI response:', error);
          
          // Provide more detailed error information
          if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
            console.error('Error response headers:', error.response.headers);
          } else if (error.request) {
            console.error('Error request:', error.request);
          } else {
            console.error('Error message:', error.message);
          }
          console.error('Error config:', error.config);
          console.error('Error stack:', error.stack);
          
          // Generate a fallback response based on the current topic
          const aiResponse = `Response to ${topic}`;
          console.log('Generated fallback response after error:', aiResponse);
          
          setResponse(aiResponse);
          
          // Wait a moment to simulate thinking
          setTimeout(() => {
            // Call evaluate directly with the response instead of using the state
            evaluateAiResponse(aiResponse);
          }, 1500);
          
          setIsAiThinking(false);
        }
      }
    };
    
    aiTakeTurn();
  }, [currentPlayer, gameStarted, showingResults, currentRound, topic, originalTopic, gameHistory, maxRounds, difficulty, circleEnabled, isGeneratingTopic]);

  const handleRestart = () => {
    console.log('=== RESTARTING GAME ===');
    console.log('aiGoesFirst setting:', aiGoesFirst);
    
    // First, make sure the game is not started to prevent AI from responding during restart
    setGameStarted(false);
    
    // Immediately clear the topic and response to prevent showing previous game data
    setTopic('');
    setOriginalTopic('');
    setResponse('');
    
    setGameHistory([]);
    setCurrentRound(1);
    setTotalScores({ human: 0, ai: 0 });
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    setOriginalTopicDefinition('');
    setTopicDefinition('');
    setGameCompleted(false);
    setCurrentEvaluation(null);
    setEvaluation('');
    setScores(null);
    setFinalEvaluation('');
    setShowingResults(false);
    // Don't set currentPlayer here, let generateFirstTopic handle it
    
    // Generate the first topic which will set gameStarted to true when ready
    generateFirstTopic();
    
    // Log the current player after generateFirstTopic is called
    console.log('Current player after restart:', aiGoesFirst ? 'ai' : 'human');
  };

  // Add function to return to settings screen
  const handleReturnToSettings = () => {
    console.log('=== RETURNING TO SETTINGS ===');
    
    // First set gameStarted to false to prevent AI from taking a turn
    setGameStarted(false);
    
    // Then reset all other state
    setGameHistory([]);
    setCurrentRound(1);
    setTotalScores({ human: 0, ai: 0 });
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    setOriginalTopicDefinition('');
    setTopicDefinition('');
    setGameCompleted(false);
    setCurrentEvaluation(null);
    setResponse('');
    setEvaluation('');
    setScores(null);
    setFinalEvaluation('');
    setTopic('');
    setOriginalTopic('');
    setShowingResults(false);
    
    // Reset to default player (this won't trigger AI turn since gameStarted is false)
    setCurrentPlayer('human');
    
    console.log('Game state reset completed');
  };

  const getPlayerTurn = () => {
    return currentRound % 2 === 1 ? 'human' : 'ai';
  };

  const getRemainingRounds = () => {
    return maxRounds - currentRound + 1;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">The Glass Bead Game</h1>
      
      {!gameStarted ? (
        <div className="text-center">
          <p className="mb-6 text-lg">
            Welcome to the Glass Bead Game! In this game, you'll compete against an AI opponent
            in a journey of connected concepts.
          </p>
          
          {/* Game settings */}
          <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-3 text-left">Game Settings:</h3>
            
            <div className="mb-4">
              <label className="block text-left mb-2 font-medium">Number of Rounds:</label>
              <div className="flex flex-wrap gap-2 justify-center">
                {roundOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => setMaxRounds(option)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      maxRounds === option 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-left mb-2 font-medium">Who Goes First:</label>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setAiGoesFirst(false)}
                  className={`px-4 py-2 rounded ${
                    !aiGoesFirst 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  You First
                </button>
                <button
                  onClick={() => setAiGoesFirst(true)}
                  className={`px-4 py-2 rounded ${
                    aiGoesFirst 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  AI First
                </button>
              </div>
            </div>
            
            {/* Circle mode checkbox */}
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="circleEnabled"
                  checked={circleEnabled}
                  onChange={(e) => setCircleEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="circleEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable Circle Mode
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                In Circle Mode, the final round must connect back to the original starting topic.
              </p>
            </div>
            
            {/* Single difficulty selector */}
            <div className="mb-0">
              <label className="block text-left mb-2 font-medium">Game Difficulty:</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {difficultyLevels.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {difficultyDescriptions[difficulty]}
              </p>
            </div>
          </div>
          
          {/* Add the ModelSelector component */}
          <ModelSelector />
          
          <div className="mb-6 text-center">
            <button
              onClick={generateFirstTopic}
              disabled={isGeneratingTopic}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
            </button>
          </div>
          
          <div className="mb-6 text-left max-w-md mx-auto">
            <h3 className="font-bold mb-2">Rules:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>The game starts with a randomly generated topic.</li>
              <li>You and the AI will take turns responding to the current topic with a brief answer.</li>
              <li><strong>Responses should be brief</strong> - ideally a single word or short phrase (1-5 words). The quality of the conceptual connection is what matters, not the length of your response.</li>
              <li>Each response becomes the topic for the next round.</li>
              <li>The game lasts for {maxRounds} rounds ({Math.ceil(maxRounds/2)} turns each).</li>
              {circleEnabled && (
                <li>In the final round, the response must connect back to the original starting topic.</li>
              )}
              <li>Responses are evaluated based on:
                <ul className="list-disc pl-5 mt-1">
                  <li><strong>Semantic Distance (1-10):</strong> How semantically remote yet meaningfully connected is the overall topic from the prompt? Higher scores for connections that are not obvious.</li>
                  <li><strong>Similarity (1-10):</strong> How well do the ideas map onto each other? For example, stock market crash and flocking behavior.</li>
                </ul>
              </li>
              {circleEnabled && (
                <li>The final round is scored based on both the connection to the previous topic and the connection back to the original topic.</li>
              )}
              <li>The player with the highest total score at the end wins!</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main game area - left side */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <h2 className="text-xl font-semibold mr-2">Topic:</h2>
                {currentRound === 1 && (
                  <span className="text-xs bg-yellow-100 px-2 py-1 rounded-full">Starting Topic</span>
                )}
                {currentRound === maxRounds && circleEnabled && (
                  <span className="text-xs bg-red-100 px-2 py-1 rounded-full">Final Round - Connect back to "{originalTopic}"</span>
                )}
                {currentRound === maxRounds && !circleEnabled && (
                  <span className="text-xs bg-orange-100 px-2 py-1 rounded-full">Final Round</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Round {currentRound}/{maxRounds}</span>
                <div className="flex gap-2">
                  <span className="text-sm font-medium bg-blue-100 px-3 py-1 rounded-full">You: {totalScores.human}</span>
                  <span className="text-sm font-medium bg-red-100 px-3 py-1 rounded-full">AI: {totalScores.ai}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xl font-medium">
                  {isGeneratingTopic ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating new topic...
                    </span>
                  ) : (
                    topic
                  )}
                </p>
                <button 
                  onClick={fetchTopicDefinition}
                  disabled={isLoadingDefinition || isGeneratingTopic}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 flex items-center"
                  title="Show definition"
                >
                  {isLoadingDefinition ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Definition
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {showDefinition && (
              <div className="p-3 bg-blue-50 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Definition:</p>
                <p>{topicDefinition}</p>
              </div>
            )}

            {currentRound === maxRounds && circleEnabled && (
              <div className="p-3 bg-yellow-50 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Final Round Instructions:</p>
                <p>This is the final round! Your response should connect both to the current topic "{topic}" AND back to the original topic "{originalTopic}".</p>
                
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={fetchOriginalTopicDefinition}
                    disabled={isLoadingOriginalDefinition}
                    className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-full text-yellow-800 flex items-center"
                    title="Show original topic definition"
                  >
                    {isLoadingOriginalDefinition ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Original Topic Definition
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {showOriginalDefinition && (
              <div className="p-3 bg-yellow-100 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Original Topic Definition ("{originalTopic}"):</p>
                <p>{originalTopicDefinition}</p>
              </div>
            )}

            {!showingResults ? (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {currentPlayer === 'human' ? 'Your Response:' : 'AI is thinking...'}
                </h2>
                
                {currentPlayer === 'human' ? (
                  <>
                    <input
                      type="text"
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full p-4 border border-gray-300 rounded-lg"
                      placeholder={currentRound === maxRounds && circleEnabled
                        ? `Type a brief response (1-5 words) that connects to both "${topic}" and "${originalTopic}"...` 
                        : "Type a brief response (1-5 words) and press Enter..."}
                      disabled={isEvaluating}
                      autoFocus
                    />
                    <p className="text-sm text-gray-500 mt-1">Keep your response concise (1-5 words) for best results. The quality of the conceptual connection is what matters.</p>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={evaluateResponse}
                        disabled={isEvaluating || !response.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
                      >
                        {isEvaluating ? 'Evaluating...' : 'Submit'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center min-h-[60px]">
                    <div className="flex items-center">
                      <div className="animate-pulse flex space-x-4">
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                      </div>
                      <span className="ml-3 text-gray-600">AI is formulating a response...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : currentEvaluation && (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Evaluation Results</h3>
                
                {/* Display the response that was evaluated */}
                <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-700">
                    {currentEvaluation.player === 'human' ? 'Your' : 'AI'} Response to "{currentEvaluation.topic}":
                  </p>
                  <p className="mt-1 text-lg">{currentEvaluation.response}</p>
                </div>
                
                <div className="whitespace-pre-wrap">{currentEvaluation.evaluation}</div>
                
                {/* Score breakdown for regular rounds */}
                {(currentRound !== maxRounds || !circleEnabled) && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-800 text-sm">Score Breakdown:</h4>
                    <div className="mt-1 text-sm">
                      <ul className="list-disc pl-5">
                        <li>Semantic Distance: {currentEvaluation.scores.semanticDistance}/10</li>
                        <li>Similarity: {currentEvaluation.scores.relevanceQuality}/10</li>
                        <li className="font-medium mt-1">Total Score: {currentEvaluation.scores.total}/20</li>
                      </ul>
                    </div>
                  </div>
                )}
                
                {/* Final round score breakdown for circle mode */}
                {currentRound === maxRounds && circleEnabled && currentEvaluation.finalEvaluation && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-800">Connection to Original Topic</h4>
                    <p>{currentEvaluation.finalEvaluation}</p>
                    
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <h5 className="font-medium text-blue-800 text-sm">Final Round Scoring:</h5>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                        <div>
                          <p><strong>Current Topic Connection:</strong></p>
                          <ul className="list-disc pl-5">
                            <li>Semantic Distance: {currentEvaluation.scores.currentConnection?.semanticDistance || 0}/10</li>
                            <li>Similarity: {currentEvaluation.scores.currentConnection?.similarity || 0}/10</li>
                            <li>Subtotal: {currentEvaluation.scores.currentConnection?.subtotal || 0}/20</li>
                          </ul>
                        </div>
                        <div>
                          <p><strong>Original Topic Connection:</strong></p>
                          <ul className="list-disc pl-5">
                            <li>Semantic Distance: {currentEvaluation.scores.originalConnection?.semanticDistance || 0}/10</li>
                            <li>Similarity: {currentEvaluation.scores.originalConnection?.similarity || 0}/10</li>
                            <li>Subtotal: {currentEvaluation.scores.originalConnection?.subtotal || 0}/20</li>
                          </ul>
                        </div>
                      </div>
                      <p className="mt-2 font-medium">Final Score: {currentEvaluation.scores.total}/20 <span className="text-xs text-gray-500">(average of both subtotals)</span></p>
                    </div>
                  </div>
                )}
                
                {gameCompleted ? (
                  <div className="mt-4">
                    <h3 className="text-xl font-bold">Game Completed!</h3>
                    <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
                      <p className="font-medium">Final Scores:</p>
                      <p>Your Score: {totalScores.human}</p>
                      <p>AI Score: {totalScores.ai}</p>
                      <p className="mt-2 font-medium">
                        {totalScores.human > totalScores.ai 
                          ? "Congratulations! You won!" 
                          : totalScores.human < totalScores.ai 
                            ? "The AI won this time." 
                            : "It's a tie!"}
                      </p>
                    </div>
                    <div className="mt-4 flex gap-3 justify-center">
                      <button
                        onClick={handleRestart}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      >
                        Start New Game
                      </button>
                      <button
                        onClick={handleReturnToSettings}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                      >
                        Choose Game Settings
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleNextTurn}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Next Round
                  </button>
                )}
              </div>
            )}
            
            {gameHistory.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Game History</h2>
                <div className="overflow-auto max-h-60">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-2 px-4 text-left">Round</th>
                        <th className="py-2 px-4 text-left">Topic</th>
                        <th className="py-2 px-4 text-left">Player</th>
                        <th className="py-2 px-4 text-left">Response</th>
                        <th className="py-2 px-4 text-left">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameHistory
                        .slice()
                        .reverse()
                        .map((round, index) => {
                          // Calculate the actual round number for display
                          const actualRoundNumber = gameHistory.length - index;
                          
                          return (
                            <tr key={index} className="border-t">
                              <td className="py-2 px-4">{actualRoundNumber}</td>
                              <td className="py-2 px-4">{round.topic}</td>
                              <td className="py-2 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${round.player === 'human' ? 'bg-blue-100' : 'bg-red-100'}`}>
                                  {round.player === 'human' ? 'You' : 'AI'}
                                </span>
                              </td>
                              <td className="py-2 px-4">{round.response}</td>
                              <td className="py-2 px-4">{round.scores.total}/20</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          {/* Concept graph visualization - right side */}
          <div className="w-full lg:w-[450px] sticky top-6 self-start">
            <SimpleConceptGraph 
              key={graphKey}
              gameHistory={gameHistory}
              originalTopic={originalTopic}
              currentTopic={topic}
              width={450}
              height={500}
            />
          </div>
        </div>
      )}
    </div>
  );
} 