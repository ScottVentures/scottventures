import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGuard from './AuthGuard';
import Hub from './pages/Hub';
import ComingSoon from './pages/ComingSoon';
import Compress from './pages/tools/Compress';
import Resize from './pages/tools/Resize';
import Crop from './pages/tools/Crop';
import Rotate from './pages/tools/Rotate';
import ToJpg from './pages/tools/ToJpg';
import FromJpg from './pages/tools/FromJpg';
import Watermark from './pages/tools/Watermark';
import Meme from './pages/tools/Meme';

export default function App() {
  return (
    <AuthGuard>
      <Layout>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/compress" element={<Compress />} />
          <Route path="/resize" element={<Resize />} />
          <Route path="/crop" element={<Crop />} />
          <Route path="/rotate" element={<Rotate />} />
          <Route path="/to-jpg" element={<ToJpg />} />
          <Route path="/from-jpg" element={<FromJpg />} />
          <Route path="/watermark" element={<Watermark />} />
          <Route path="/meme" element={<Meme />} />
          <Route path="/soon/:id" element={<ComingSoon />} />
          <Route path="*" element={<Hub />} />
        </Routes>
      </Layout>
    </AuthGuard>
  );
}
