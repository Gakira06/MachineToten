import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Preferir vídeos exclusivos do screensaver definidos em data/screensaver.json
import screensaverList from '../data/screensaver.json';
import menu from '../data/menu.json';

// Carrega a lista de vídeos do screensaver (strings)
const getScreensaverVideos = (): string[] => {
  if (Array.isArray(screensaverList)) {
    return screensaverList.filter(Boolean);
  }
  return [];
};

// Fallback: se não houver screensaver.json válido, usa os vídeos do menu
const getProductVideos = (): string[] => {
  if (!Array.isArray(menu)) return [];
  return menu.map((item) => (item as any).videoUrl).filter(Boolean);
};

const videos = (() => {
  const s = getScreensaverVideos();
  return s.length > 0 ? s : getProductVideos();
})();

export default function ScreensaverPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    // Troca de vídeo a cada 5 segundos
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % videos.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    // Qualquer clique na tela leva para login
    const handleClick = () => {
      navigate('/login');
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [navigate]);

  if (videos.length === 0) {
    return <div className="flex items-center justify-center h-screen text-2xl">Nenhum vídeo encontrado para o screensaver.</div>;
  }

  return (
    <div className="fixed inset-0 bg-white">
      <video
        src={videos[current]}
        autoPlay
        loop
        muted
        className="w-full h-full"
        style={{ objectFit: 'cover', background: 'white' }}
      />
    </div>
  );
}
