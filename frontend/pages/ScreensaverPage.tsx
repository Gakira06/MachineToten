import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001';

export default function ScreensaverPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [videos, setVideos] = useState<string[]>([]);
  const intervalRef = useRef<any>(null);

  // Busca os vídeos do screensaver do backend
  useEffect(() => {
    const loadVideos = async () => {
      try {
        // Tenta buscar os vídeos do screensaver
        const screensaverRes = await fetch(`${API_URL}/screensaver`);
        const screensaverData = await screensaverRes.json();
        
        if (Array.isArray(screensaverData) && screensaverData.length > 0) {
          setVideos(screensaverData.filter(Boolean));
          return;
        }

        // Fallback: busca vídeos do menu
        const menuRes = await fetch(`${API_URL}/menu`);
        const menuData = await menuRes.json();
        
        if (Array.isArray(menuData)) {
          const menuVideos = menuData.map((item: any) => item.videoUrl).filter(Boolean);
          setVideos(menuVideos);
        }
      } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
      }
    };

    loadVideos();
  }, []);

  useEffect(() => {
    if (videos.length === 0) return;

    // Troca de vídeo a cada 5 segundos
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % videos.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [videos.length]);

  useEffect(() => {
    // Qualquer clique na tela leva para login
    const handleClick = () => {
      navigate('/login');
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [navigate]);

  if (videos.length === 0) {
    return <div className="flex items-center justify-center h-screen text-2xl">Carregando vídeos...</div>;
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
