import dynamic from 'next/dynamic';

// Use dynamic import with SSR disabled to avoid hydration issues with client-side state
const GameInterface = dynamic(() => import('./components/GameInterface'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 py-12">
      <GameInterface />
    </div>
  );
}
