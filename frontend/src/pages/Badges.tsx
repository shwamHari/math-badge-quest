import { useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext';

interface BadgeInfo {
  operation: string;
  tokenId: number;
}

export default function Badges() {
  const { address, client, connectWallet } = useWallet();
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapping for operation names
  const operationNames: { [key: string]: string } = {
    add: 'Addition',
    sub: 'Subtraction',
    mul: 'Multiplication',
    div: 'Division',
  };

  useEffect(() => {
    const fetchBadges = async () => {
      if (!address || !client) return;
      setLoading(true);
      setError(null);
      try {
        const operations = ["ADD", "SUB", "MUL", "DIV"];
        let allBadges: BadgeInfo[] = [];
        for (const op of operations) {
          const contractAddress = import.meta.env[`VITE_CONTRACT_ADDRESS_${op}`] as string;
          const codeHash = import.meta.env.VITE_CODE_HASH as string;
          const queryMsg = { get_user_badges: { user: address } };
          const response = await client.query.compute.queryContract({
            contract_address: contractAddress,
            code_hash: codeHash,
            query: queryMsg,
          });
          const badges = response.badges || [];
          const operation = op.toLowerCase();
          allBadges = allBadges.concat(badges.map((tokenId: number) => ({ operation, tokenId })));
        }
        setBadges(allBadges);
      } catch (err) {
        console.error('Failed to fetch badges:', err);
        setError('Failed to load badges. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchBadges();
  }, [address, client]);

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
        <h1 className="text-3xl font-bold mb-4">My Badges</h1>
        <p className="text-lg mb-4">Please connect your wallet to view your badges.</p>
        <button
          onClick={connectWallet}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-4">My Badges</h1>
      {loading && <p>Loading badges...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && badges.length === 0 && (
        <p>No badges earned yet. Start solving quests to earn some!</p>
      )}
      {!loading && !error && badges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl w-full">
          {badges.map((badge, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-4 text-center"
            >
              <h3 className="text-xl font-semibold">{operationNames[badge.operation]} Badge</h3>
              <p className="text-gray-600">Earned for mastering {operationNames[badge.operation].toLowerCase()}!</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}