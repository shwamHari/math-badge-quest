import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

function Navbar() {
  const { address, connectWallet, disconnectWallet } = useWallet();

  const handleConnect = async () => {
    console.log('Attempting to connect wallet...');
    await connectWallet();
  };

  return (
    <nav className="bg-blue-900 text-white p-4 shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Math Badge Quest</Link>
        <div className="space-x-4 flex items-center">
          <Link to="/" className="hover:text-gray-300">Home</Link>
          <Link to="/badges" className="hover:text-gray-300">My Badges</Link>
          {address ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm">{address.slice(0, 6)}...{address.slice(-4)}</span>
              <button
                onClick={disconnectWallet}
                className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;