import React, { useEffect, useRef } from 'react';


interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulse: number;
  connections: number[];
}


export const BlockDAGWatermark: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;


    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);


    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };


    window.addEventListener('resize', handleResize);


    // Initialize DAG Nodes moving left-to-right (BlockDAG flow)
    const nodeCount = Math.floor(width / 25);
    const nodes: Node[] = [];


    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.2 + Math.random() * 0.5, // Constant forward flow
        vy: (Math.random() - 0.5) * 0.2,
        radius: 2 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2,
        connections: [],
      });
    }


    const render = () => {
      ctx.clearRect(0, 0, width, height);


      // Update positions
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.03;


        // Wrap around seamlessly
        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;
      });


      // Draw DAG Edges (Connect nodes within distance threshold to emulate GHOSTDAG)
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);


          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.35;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`; // Emerald DAG lines
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }


      // Draw DAG Block Nodes
      nodes.forEach((node) => {
        const glow = Math.sin(node.pulse) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(52, 211, 153, ${0.4 + glow * 0.6})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();


        // Node Glow Effect
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8 * glow;
      });


      animationFrameId = requestAnimationFrame(render);
    };


    render();


    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);


  return (
    <div className="relative w-full h-[380px] rounded-2xl overflow-hidden bg-zinc-950/90 border border-emerald-500/20 shadow-2xl flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div className="relative z-10 pointer-events-none text-center px-4">
        <div className="inline-flex items-center gap-2 bg-zinc-900/90 border border-emerald-500/30 px-4 py-1.5 rounded-full backdrop-blur-md mb-2 shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-plex text-xs text-emerald-400 font-medium tracking-wide">Live BlockDAG Consensus Flow</span>
        </div>
      </div>
    </div>
  );
};