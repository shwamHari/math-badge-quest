import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Badges from './pages/Badges';
import Test from './pages/Test';

export default function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/test/:operation" element={<Test />} />
      </Routes>
    </div>
  );
}