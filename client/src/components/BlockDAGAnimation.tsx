import React, { useMemo } from 'react';


export const BlockDAGWatermark: React.FC = () => {
  const { nodes, edges } = useMemo(() => {
    const nodes: { id: number; x: number; y: number }[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];


    const rows = 10;
    const cols = 18;


    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const bx = (j / (cols - 1)) * 100;
        const by = (i / (rows - 1)) * 100;
        const dx = bx + (Math.sin(i + j) * 3);
        const dy = by + (Math.cos(i * j) * 3);
        nodes.push({ id: i * cols + j, x: dx, y: dy });
      }
    }


    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const u = nodes[i * cols + j];
        const targetOffsets = [-2, -1, 0, 1, 2];
        targetOffsets.forEach(offset => {
          const targetRow = i + offset;
          if (targetRow >= 0 && targetRow < rows && Math.random() > 0.45) {
            const v = nodes[targetRow * cols + j + 1];
            edges.push({ x1: u.x, y1: u.y, x2: v.x, y2: v.y });
          }
        });
      }
    }
    return { nodes, edges };
  }, []);


  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden">
      <svg 
        className="absolute inset-0 w-full h-full text-emerald-500/20 pointer-events-none" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="0.12">
          {edges.map((e, idx) => (
            <line key={`e-${idx}`} x1={`${e.x1}%`} y1={`${e.y1}%`} x2={`${e.x2}%`} y2={`${e.y2}%`} />
          ))}
        </g>
        <g fill="currentColor">
          {nodes.map(n => (
            <circle key={`n-${n.id}`} cx={`${n.x}%`} cy={`${n.y}%`} r="0.4" className="text-emerald-400" />
          ))}
        </g>
      </svg>


      {/* Simulated Live BlockDAG DAG Visual Element */}
      <div className="relative z-10 bg-zinc-900/90 border border-emerald-500/30 p-6 rounded-2xl backdrop-blur-md shadow-2xl max-w-sm w-full mx-auto text-center">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-plex text-xs text-emerald-400 font-semibold uppercase tracking-wider">BlockDAG Live Visual</span>
          </div>
          <span className="font-plex text-[10px] text-zinc-500">GHOSTDAG Consensus</span>
        </div>


        <div className="grid grid-cols-4 gap-2 my-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((block) => (
            <div key={block} className="bg-emerald-950/60 border border-emerald-500/40 p-2 rounded-lg flex flex-col items-center justify-center gap-1 animate-pulse" style={{ animationDelay: `${block * 200}ms` }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="font-plex text-[9px] text-emerald-300">#B-{10420 + block}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 font-medium">Parallel block processing in real-time</p>
      </div>
    </div>
  );
};