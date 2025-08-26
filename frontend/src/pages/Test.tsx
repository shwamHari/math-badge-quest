import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

// Define the expected QueryAnswer type based on contract schema
interface QueryAnswer {
  operation?: string;
  a?: number;
  b?: number;
  badges?: number[];
  sub_questions?: { operation: string; a: number; b: number }[];
  progress?: boolean[];
}

export default function Test() {
  const { operation } = useParams<{ operation: string }>();
  const { address, client } = useWallet();
  const [quest, setQuest] = useState<{ id: number; problem: string; operation: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<React.ReactNode | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const totalQuestions = 5;

  // Map URL operation to contract operation
  const opMap: { [key: string]: string } = {
    '+': '+',
    '-': '−',
    '*': '×',
    'div': '÷',
  };

  // Decode URL parameter and map to operation
  const rawOp = operation ? decodeURIComponent(operation) : undefined;
  const op = rawOp && opMap[rawOp] ? opMap[rawOp] : undefined;

  const opToEnv: { [key: string]: string } = {
    '+': 'ADD',
    '−': 'SUB',
    '×': 'MUL',
    '÷': 'DIV',
  };

  // Validate op and get contract address
  const envKey = op && opToEnv[op] ? `VITE_CONTRACT_ADDRESS_${opToEnv[op]}` : null;
  const contractAddress = envKey ? import.meta.env[envKey] as string : undefined;
  const codeHash = import.meta.env.VITE_CODE_HASH as string;

  // Initialize progress and completion status
  useEffect(() => {
    const initializeProgress = async () => {
      if (!client || !address || !contractAddress || !codeHash) {
        setError('Wallet not connected or contract configuration missing.');
        return;
      }
      setLoading(true);
      try {
        // Query user progress
        const progressQuery = { get_user_progress: { user: address, quest_id: 1 } };
        const progressResponse = await client.query.compute.queryContract({
          contract_address: contractAddress,
          code_hash: codeHash,
          query: progressQuery,
        }) as QueryAnswer;

        // Check if quest is completed
        const completionQuery = { get_user_badges: { user: address } };
        const completionResponse = await client.query.compute.queryContract({
          contract_address: contractAddress,
          code_hash: codeHash,
          query: completionQuery,
        }) as QueryAnswer;
        const completed = completionResponse.badges?.some(id => id === 1) || false;
        setIsCompleted(completed);

        if (completed) {
          setSuccess(
            <>
              You have already completed this quest.{' '}
              <Link to="/badges" className="text-blue-600 underline">View your badge</Link>.
            </>
          );
          setQuest(null);
          setLoading(false);
          return;
        }

        // Set currentIndex based on progress
        const progress = progressResponse.progress || [false, false, false, false, false];
        const nextIndex = progress.findIndex(answered => !answered);
        const newIndex = nextIndex === -1 ? 0 : nextIndex; // Reset to 0 if all answered (but not completed)
        setCurrentIndex(newIndex);
      } catch (err: any) {
        setError(`Failed to initialize quest: ${err.message}. Please try again.`);
      } finally {
        setLoading(false);
      }
    };
    initializeProgress();
  }, [client, address, op, contractAddress, codeHash]);

  // Fetch the current sub-question
  useEffect(() => {
    if (isCompleted || !client || !address || !contractAddress || !codeHash) {
      return;
    }
    const fetchQuest = async () => {
      setLoading(true);
      try {
        const queryMsg = { get_quest: { id: 1, sub_question_index: currentIndex } };
        const response = await client.query.compute.queryContract({
          contract_address: contractAddress,
          code_hash: codeHash,
          query: queryMsg,
        }) as QueryAnswer;
        if (!response.operation || response.a === undefined || response.b === undefined) {
          throw new Error('Invalid quest response');
        }
        setQuest({
          id: 1,
          problem: `${response.a} ${op} ${response.b}`,
          operation: op!,
        });
        setError(null);
      } catch (err: any) {
        setError(`Failed to load question ${currentIndex + 1}: ${err.message}. Please try again.`);
      } finally {
        setLoading(false);
      }
    };
    fetchQuest();
  }, [client, address, op, contractAddress, codeHash, currentIndex, isCompleted]);

  const handleSubmit = async () => {
    if (!client || !address || !quest || !contractAddress || !codeHash) {
      setError('Wallet not connected or quest not loaded.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const solution = parseInt(answer.trim(), 10);
      if (isNaN(solution)) {
        throw new Error('Answer must be a number');
      }
      const msg = {
        submit_solution: {
          quest_id: 1,
          sub_question_index: currentIndex,
          solution,
        },
      };
      const tx = await client.tx.compute.executeContract(
        {
          sender: address,
          contract_address: contractAddress,
          code_hash: codeHash,
          msg,
          sent_funds: [],
        },
        { gasLimit: 200_000 }
      );
      if (tx.code !== 0) {
        // Check for incorrect solution error
        if (tx.rawLog.includes('Incorrect solution')) {
          throw new Error('Incorrect solution');
        }
        throw new Error(`Transaction failed: ${tx.rawLog}`);
      }
      if (currentIndex < totalQuestions - 1) {
        setSuccess(`Correct! Moving to question ${currentIndex + 2} of ${totalQuestions}.`);
        setCurrentIndex(currentIndex + 1);
        setAnswer('');
      } else {
        setSuccess(
          <>
            Congratulations! You've completed all {totalQuestions} questions.{' '}
            <Link to="/badges" className="text-blue-600 underline">View your new badge</Link>.
          </>
        );
        setCurrentIndex(0);
        setAnswer('');
        setIsCompleted(true);
      }
    } catch (err: any) {
      // Simplify incorrect solution error
      if (err.message.includes('Incorrect solution')) {
        setError('Incorrect solution, try again');
      } else {
        setError(`Failed to submit answer: ${err.message}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
        <h1 className="text-3xl font-bold mb-4">Math Quest: {op || 'Unknown'}</h1>
        <p>Please connect your wallet to start the quest.</p>
      </div>
    );
  }

  if (!op || !opToEnv[op]) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
        <h1 className="text-3xl font-bold mb-4">Invalid Quest</h1>
        <p>Invalid operation. Please select a valid quest (+, -, *, /).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-4">Math Quest: {op}</h1>
      { !isCompleted && <p className="text-lg mb-4">Question {currentIndex + 1} of {totalQuestions}</p>}
      {loading && <p>Loading question...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">{success}</p>}
      {quest && !isCompleted && (
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <h2 className="text-2xl font-semibold mb-4">Problem</h2>
          <p className="text-lg mb-4">{quest.problem}</p>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter your answer"
            className="w-full p-2 border rounded mb-4"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !answer}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
}