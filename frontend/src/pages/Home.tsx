import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <header className="bg-blue-800 text-white rounded-lg shadow-lg p-6 max-w-2xl w-full text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Math Badge Quest</h1>
        <p className="text-lg leading-relaxed">
          Welcome to Math Badge Quest, a decentralised app on Secret Network! Test your math skills by solving problems in addition, subtraction, multiplication, or division. Each successful quest earns you a unique NFT badge, stored securely on the blockchain.
        </p>
      </header>
      <section className="max-w-2xl w-full">
        <h2 className="text-4xl font-semibold mb-4 text-center">Earn Badges</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          {[
            { op: 'ADDITION +', path: '+' },
            { op: 'SUBTRACTION −', path: '-' },
            { op: 'MULTIPLICATION ×', path: '*' },
            { op: 'DIVISION ÷', path: 'div' },
          ].map(({ op, path }) => (
            <Link
              key={op}
              to={`/test/${path}`}
              className="bg-blue-600 text-white rounded-lg p-4 text-center font-bold hover:bg-blue-700 transition text-2xl"
            >
              {op}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}