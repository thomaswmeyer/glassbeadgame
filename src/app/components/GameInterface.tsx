"use client";

import { useState, KeyboardEvent, useEffect } from 'react';
import axios from 'axios';

interface Score {
  semanticDistance: number;
  relevanceQuality: number;
  total: number;
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

  const MAX_ROUNDS = 10;
  const FINAL_ROUND = MAX_ROUNDS;

  const generateFirstTopic = async () => {
    setIsGeneratingTopic(true);
    setShowingResults(false);
    setCurrentEvaluation(null);
    setShowDefinition(false);
    setGameCompleted(false);
    try {
      const result = await axios.post('/api/generate-topic');
      const newTopic = result.data.topic;
      setTopic(newTopic);
      setOriginalTopic(newTopic); // Store the original topic
      setGameStarted(true);
      setResponse('');
      setEvaluation('');
      setScores(null);
      setCurrentPlayer('human');
      setCurrentRound(1);
      setGameHistory([]);
      setTotalScores({ human: 0, ai: 0 });
    } catch (error) {
      console.error('Error generating topic:', error);
      alert('Failed to generate topic. Please try again.');
    } finally {
      setIsGeneratingTopic(false);
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && response.trim()) {
      e.preventDefault();
      evaluateResponse();
    }
  };

  const evaluateResponse = async () => {
    if (!topic || !response) return;
    
    setIsEvaluating(true);
    
    try {
      let evaluationEndpoint = '/api/evaluate-response';
      let requestBody: any = { topic, response };
      
      // For the final round (round 10), use the special evaluation endpoint
      if (currentRound === 10) {
        evaluationEndpoint = '/api/evaluate-final-response';
        requestBody = { 
          currentTopic: topic, 
          originalTopic: originalTopic, 
          response 
        };
      }
      
      const res = await fetch(evaluationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error('Failed to evaluate response');
      }

      const data = await res.json();
      
      // Handle final round evaluation differently
      if (currentRound === 10) {
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
      
      setResponse('');
      
    } catch (error) {
      console.error('Error evaluating response:', error);
      alert('Failed to evaluate response. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const evaluateAiResponse = async (aiResponse: string) => {
    if (!topic) return;
    
    setIsEvaluating(true);
    
    try {
      let evaluationEndpoint = '/api/evaluate-response';
      let requestBody: any = { topic, response: aiResponse };
      
      // For the final round (round 10), use the special evaluation endpoint
      if (currentRound === 10) {
        evaluationEndpoint = '/api/evaluate-final-response';
        requestBody = { 
          currentTopic: topic, 
          originalTopic: originalTopic, 
          response: aiResponse 
        };
      }
      
      const res = await fetch(evaluationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error('Failed to evaluate AI response');
      }

      const data = await res.json();
      
      // Handle final round evaluation differently
      if (currentRound === 10) {
        setCurrentEvaluation({
          topic,
          response: aiResponse,
          player: currentPlayer,
          evaluation: data.evaluation,
          finalEvaluation: data.finalEvaluation,
          scores: data.scores,
        });
        setGameCompleted(true);
      } else {
        setCurrentEvaluation({
          topic,
          response: aiResponse,
          player: currentPlayer,
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
      
    } catch (error) {
      console.error('Error evaluating AI response:', error);
      alert('Failed to evaluate AI response. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
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
    
    // Switch players
    const nextPlayer = currentPlayer === 'human' ? 'ai' : 'human';
    console.log('Switching player to:', nextPlayer);
    setCurrentPlayer(nextPlayer);
  };

  // AI's turn to respond
  useEffect(() => {
    const aiTakeTurn = async () => {
      if (gameStarted && currentPlayer === 'ai' && !showingResults) {
        console.log('=== AI TURN STARTED ===');
        console.log('Current round:', currentRound);
        console.log('Current topic:', topic);
        console.log('Original topic:', originalTopic);
        console.log('Game history length:', gameHistory.length);
        console.log('Full game history:', JSON.stringify(gameHistory, null, 2));
        
        setIsAiThinking(true);
        try {
          // For the final round, we need to inform the AI that it needs to connect back to the original topic
          const endpoint = currentRound === FINAL_ROUND ? '/api/ai-final-response' : '/api/ai-response';
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
            gameHistoryLength: formattedHistory.length
          });
          
          // Create a simplified payload for debugging
          const debugPayload = {
            topic,
            originalTopic,
            gameHistoryCount: formattedHistory.length
          };
          console.log('Request payload (simplified):', JSON.stringify(debugPayload));
          
          // Get AI response to the current topic
          console.log('Making axios request...');
          const result = await axios.post(endpoint, {
            topic,
            originalTopic: originalTopic,
            gameHistory: formattedHistory
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
  }, [currentPlayer, gameStarted, showingResults, currentRound, topic, originalTopic, gameHistory]);

  const handleRestart = () => {
    setGameHistory([]);
    setCurrentRound(1);
    setTotalScores({ human: 0, ai: 0 });
    setShowDefinition(false);
    setGameCompleted(false);
    generateFirstTopic();
  };

  const getPlayerTurn = () => {
    return currentRound % 2 === 1 ? 'human' : 'ai';
  };

  const getRemainingRounds = () => {
    return MAX_ROUNDS - currentRound + 1;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">The Glass Bead Game</h1>
      
      {!gameStarted ? (
        <div className="text-center">
          <p className="mb-6 text-lg">
            Welcome to the Glass Bead Game! In this game, you'll compete against an AI opponent
            in a 10-round journey of connected concepts.
          </p>
          <div className="mb-6 text-left max-w-md mx-auto">
            <h3 className="font-bold mb-2">Rules:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>The game starts with a randomly generated topic.</li>
              <li>You and the AI will take turns responding to the current topic with a brief answer.</li>
              <li>Each response becomes the topic for the next round.</li>
              <li>The game lasts for 10 rounds (5 turns each).</li>
              <li>In the final round, the response must connect back to the original starting topic.</li>
              <li>Responses are evaluated based on:
                <ul className="list-disc pl-5 mt-1">
                  <li><strong>Semantic Distance (1-10):</strong> How far your response moves from the current topic while maintaining a meaningful connection.</li>
                  <li><strong>Relevance and Quality (1-10):</strong> How insightful your brief response is in relation to the topic.</li>
                </ul>
              </li>
              <li>The final round is scored based on both the connection to the previous topic and the connection back to the original topic.</li>
              <li>The player with the highest total score at the end wins!</li>
            </ol>
          </div>
          <button
            onClick={generateFirstTopic}
            disabled={isGeneratingTopic}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold mr-2">Topic:</h2>
              {currentRound === 1 && (
                <span className="text-xs bg-yellow-100 px-2 py-1 rounded-full">Starting Topic</span>
              )}
              {currentRound === FINAL_ROUND && (
                <span className="text-xs bg-red-100 px-2 py-1 rounded-full">Final Round - Connect back to "{originalTopic}"</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Round {currentRound}/{MAX_ROUNDS}</span>
              <div className="flex gap-2">
                <span className="text-sm font-medium bg-blue-100 px-3 py-1 rounded-full">You: {totalScores.human}</span>
                <span className="text-sm font-medium bg-red-100 px-3 py-1 rounded-full">AI: {totalScores.ai}</span>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg mb-2">
            <div className="flex items-center justify-between">
              <p className="text-xl font-medium">{topic}</p>
              <button 
                onClick={fetchTopicDefinition}
                disabled={isLoadingDefinition}
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

          {currentRound === FINAL_ROUND && (
            <div className="p-3 bg-yellow-50 rounded-lg mb-4 text-sm">
              <p className="font-medium mb-1">Final Round Instructions:</p>
              <p>This is the final round! Your response should connect both to the current topic "{topic}" AND back to the original topic "{originalTopic}".</p>
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
                    placeholder={currentRound === FINAL_ROUND 
                      ? `Type a response that connects to both "${topic}" and "${originalTopic}"...` 
                      : "Type a brief response and press Enter..."}
                    disabled={isEvaluating}
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 mt-1">Keep your response concise for best results.</p>
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
              <div className="whitespace-pre-wrap">{currentEvaluation.evaluation}</div>
              
              {currentRound === FINAL_ROUND && currentEvaluation.finalEvaluation && (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-800">Connection to Original Topic</h4>
                  <p>{currentEvaluation.finalEvaluation}</p>
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
                  <button
                    onClick={handleRestart}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Start New Game
                  </button>
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
                    {gameHistory.map((round, index) => (
                      <tr key={index} className="border-t">
                        <td className="py-2 px-4">{index + 1}</td>
                        <td className="py-2 px-4">{round.topic}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${round.player === 'human' ? 'bg-blue-100' : 'bg-red-100'}`}>
                            {round.player === 'human' ? 'You' : 'AI'}
                          </span>
                        </td>
                        <td className="py-2 px-4">{round.response}</td>
                        <td className="py-2 px-4">{round.scores.total}/20</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 