import React, { useEffect, useRef } from 'react';


export const BlockDAGWatermark: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;


    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);


    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };


    window.addEventListener('resize', handleResize);


    const nodeCount = Math.floor(width / 30);
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0.2 + Math.random() * 0.4,
      vy: (Math.random() - 0.5) * 0.2,
      radius: 2 + Math.random() * 2,
      pulse: Math.random() * Math.PI * 2,
    }));


    const render = () => {
      ctx.clearRect(0, 0, width, height);


      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.02;


        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;
      });


      // Draw light green DAG edges
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);


          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.18;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }


      // Draw DAG nodes
      nodes.forEach((node) => {
        const glow = Math.sin(node.pulse) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(16, 185, 129, ${0.25 + glow * 0.45})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });


      animationFrameId = requestAnimationFrame(render);
    };


    render();


    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);


  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none" />;
};