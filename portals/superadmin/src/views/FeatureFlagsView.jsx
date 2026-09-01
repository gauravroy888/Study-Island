import React from 'react';
import { FlagCard } from '../components/SharedComponents.jsx';

export function FeatureFlagsView({ flags, setFlags }) {
      const toggle = (key) => setFlags(prev => ({ ...prev, [key]: !prev[key] }));
      return (
        <div className="grid grid-cols-2 gap-4">
          <FlagCard title="WebGL Physics Engine v2" desc="Enables GPU-accelerated raymarching for 3D optics labs." active={flags.webglPhysicsV2} onToggle={() => toggle('webglPhysicsV2')} />
          <FlagCard title="AI Science Tutor Chatbot" desc="Injects instant AI diagnostic assistance into student labs." active={flags.aiTutorChatbot} onToggle={() => toggle('aiTutorChatbot')} />
          <FlagCard title="R2 Dynamic Asset Streaming" desc="Streams GLB models directly from Cloudflare R2 edge." active={flags.r2StreamingOptimized} onToggle={() => toggle('r2StreamingOptimized')} />
          <FlagCard title="Maintenance Mode Splash" desc="Blocks non-SuperAdmin access with maintenance message." active={flags.maintenanceSplash} onToggle={() => toggle('maintenanceSplash')} danger />
        </div>
      );
    }

