import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGuard from './AuthGuard';
import Hub from './pages/Hub';
import ComingSoon from './pages/ComingSoon';
import Merge from './pages/tools/Merge';
import Split from './pages/tools/Split';
import Organize from './pages/tools/Organize';
import Rotate from './pages/tools/Rotate';
import Compress from './pages/tools/Compress';
import Crop from './pages/tools/Crop';
import PageNumbers from './pages/tools/PageNumbers';
import Watermark from './pages/tools/Watermark';
import JpgToPdf from './pages/tools/JpgToPdf';
import PdfToJpg from './pages/tools/PdfToJpg';

export default function App() {
  return (
    <AuthGuard>
      <Layout>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/merge" element={<Merge />} />
          <Route path="/split" element={<Split />} />
          <Route path="/organize" element={<Organize />} />
          <Route path="/rotate" element={<Rotate />} />
          <Route path="/compress" element={<Compress />} />
          <Route path="/crop" element={<Crop />} />
          <Route path="/page-numbers" element={<PageNumbers />} />
          <Route path="/watermark" element={<Watermark />} />
          <Route path="/jpg-to-pdf" element={<JpgToPdf />} />
          <Route path="/pdf-to-jpg" element={<PdfToJpg />} />
          <Route path="/soon/:id" element={<ComingSoon />} />
          <Route path="*" element={<Hub />} />
        </Routes>
      </Layout>
    </AuthGuard>
  );
}
