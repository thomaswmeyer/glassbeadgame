"use client";

import { useState, KeyboardEvent } from 'react';
import axios from 'axios';

interface Score {
  semanticDistance: number;
  relevanceQuality: number;
  total: number;
}

interface GameHistory {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
}

export default function GameInterface() {
  const [topic, setTopic] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [evaluation, setEvaluation] = useState<string>('');
  const [scores, setScores] = useState<Score | null>(null);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [showingResults, setShowingResults] = useState<boolean>(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<{topic: string, response: string, evaluation: string, scores: Score} | null>(null);

  const generateTopic = async () => {
    setIsGeneratingTopic(true);
    setShowingResults(false);
    setCurrentEvaluation(null);
    try {
      const result = await axios.post('/api/generate-topic');
      setTopic(result.data.topic);
      setGameStarted(true);
      setResponse('');
      setEvaluation('');
      setScores(null);
    } catch (error) {
      console.error('Error generating topic:', error);
      alert('Failed to generate topic. Please try again.');
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && response.trim()) {
      e.preventDefault();
      evaluateResponse();
    }
  };

  const evaluateResponse = async () => {
    if (!response.trim()) {
      alert('Please enter a response before submitting.');
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await axios.post('/api/evaluate-response', {
        topic,
        response,
      });
      
      const newScores = result.data.scores;
      const newEvaluation = result.data.evaluation;
      
      setEvaluation(newEvaluation);
      setScores(newScores);
      
      const evaluationResult = {
        topic,
        response,
        evaluation: newEvaluation,
        scores: newScores
      };
      
      // Add to history
      setGameHistory(prev => [...prev, evaluationResult]);
      
      // Set current evaluation for display
      setCurrentEvaluation(evaluationResult);
      
      // Show results instead of immediately generating new topic
      setShowingResults(true);
      
    } catch (error) {
      console.error('Error evaluating response:', error);
      alert('Failed to evaluate response. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextTopic = () => {
    setCurrentRound(prev => prev + 1);
    generateTopic();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">The Glass Bead Game</h1>
      
      {!gameStarted ? (
        <div className="text-center">
          <p className="mb-6 text-lg">
            Welcome to the Glass Bead Game! In this game, an AI will generate a single concept or idea.
            Your task is to respond with a brief, few-word answer that will be evaluated based on:
          </p>
          <ul className="mb-6 text-left max-w-md mx-auto">
            <li className="mb-2"><strong>Semantic Distance (1-10):</strong> How far your response moves from the original topic while maintaining a meaningful connection.</li>
            <li className="mb-2"><strong>Relevance and Quality (1-10):</strong> How insightful and well-articulated your response is in relation to the topic.</li>
          </ul>
          <p className="mb-6 text-sm italic">Press Enter after typing your response to submit it.</p>
          <button
            onClick={generateTopic}
            disabled={isGeneratingTopic}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Topic:</h2>
            <span className="text-sm text-gray-500">Round {currentRound}</span>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg mb-6">
            <p className="text-xl font-medium">{topic}</p>
          </div>

          {!showingResults ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Your Response:</h2>
              <input
                type="text"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-4 border border-gray-300 rounded-lg"
                placeholder="Type a brief response and press Enter..."
                disabled={isEvaluating}
                autoFocus
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={evaluateResponse}
                  disabled={isEvaluating || !response.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
                >
                  {isEvaluating ? 'Evaluating...' : 'Submit'}
                </button>
              </div>
            </div>
          ) : currentEvaluation && (
            <div className="mb-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                <h2 className="text-xl font-semibold mb-4">Evaluation Results:</h2>
                <div className="mb-4">
                  <p className="font-medium">Topic: <span className="font-normal">{currentEvaluation.topic}</span></p>
                  <p className="font-medium">Your Response: <span className="font-normal">{currentEvaluation.response}</span></p>
                </div>
                <div className="mb-4">
                  <p className="whitespace-pre-line">{currentEvaluation.evaluation}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <p className="text-lg font-bold">{currentEvaluation.scores.semanticDistance}</p>
                    <p className="text-sm">Semantic Distance</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <p className="text-lg font-bold">{currentEvaluation.scores.relevanceQuality}</p>
                    <p className="text-sm">Relevance & Quality</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <p className="text-lg font-bold">{currentEvaluation.scores.total}</p>
                    <p className="text-sm">Total Score</p>
                  </div>
                </div>
                <div className="text-center">
                  <button
                    onClick={handleNextTopic}
                    disabled={isGeneratingTopic}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                  >
                    {isGeneratingTopic ? 'Generating...' : 'Next Topic'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {gameHistory.length > 1 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Game History</h2>
              <div className="overflow-auto max-h-60">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-left">Round</th>
                      <th className="py-2 px-4 text-left">Topic</th>
                      <th className="py-2 px-4 text-left">Response</th>
                      <th className="py-2 px-4 text-left">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameHistory.slice(0, -1).map((round, index) => (
                      <tr key={index} className="border-t">
                        <td className="py-2 px-4">{index + 1}</td>
                        <td className="py-2 px-4">{round.topic}</td>
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