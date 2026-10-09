import { useParams } from 'react-router-dom';
import ToolShell from '../components/ToolShell';
import { toolById } from '../lib/tools';

export default function ComingSoon() {
  const { id } = useParams();
  const tool = toolById(id);

  if (!tool) {
    return (
      <ToolShell title="Tool not found">
        <p>That tool doesn't exist yet.</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell title={tool.name} description={tool.blurb}>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ color: 'var(--text-soft)', marginBottom: 8 }}>
          {tool.name} is on the way — we're building it out next.
        </p>
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>
          In the meantime, Compress, Resize, Crop, Rotate, the JPG converters,
          Watermark and the Meme generator are ready to use today.
        </p>
      </div>
    </ToolShell>
  );
}
