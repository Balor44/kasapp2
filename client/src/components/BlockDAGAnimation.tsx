import React, { useMemo } from 'react';


export const BlockDAGWatermark: React.FC = () => {
  // Generate static nodes and edges once to prevent flashing
  const { nodes, edges } = useMemo(() => {
    const nodes: { id: number; x: number; y: number }[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];


    // Grid config for coverage
    const rows = 12;
    const cols = 20;


    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        // Core grid coordinates
        const bx = (j / (cols - 1)) * 100;
        const by = (i / (rows - 1)) * 100;
        // Apply significant randomized displacement to mimic a true DAG structure
        const dx = bx + (Math.random() * 8 - 4);
        const dy = by + (Math.random() * 8 - 4);
        nodes.push({ id: i * cols + j, x: dx, y: dy });
      }
    }


    // Connect nodes to neighboring columns to form a DAG lattice
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const u = nodes[i * cols + j];
        // Connect u to nodes in the next column, mimicking DAG block flow
        const targetOffsets = [-2, -1, 0, 1, 2];
        targetOffsets.forEach(offset => {
          const targetRow = i + offset;
          if (targetRow >= 0 && targetRow < rows && Math.random() > 0.4) {
            const v = nodes[targetRow * cols + j + 1];
            edges.push({ x1: u.x, y1: u.y, x2: v.x, y2: v.y });
          }
        });
      }
    }
    return { nodes, edges };
  }, []);


  return (
    <svg 
      className="absolute inset-0 w-full h-full text-zinc-800/15" // Base feint color
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Lattice */}
      <g stroke="currentColor" strokeWidth="0.06">
        {edges.map((e, idx) => (
          <line key={`e-${idx}`} x1={`${e.x1}%`} y1={`${e.y1}%`} x2={`${e.x2}%`} y2={`${e.y2}%`} />
        ))}
      </g>
      <g fill="currentColor">
        {nodes.map(n => (
          <circle key={`n-${n.id}`} cx={`${n.x}%`} cy={`${n.y}%`} r="0.2" />
        ))}
      </g>


      {/* Pulsing Active Node Highlight */}
      <circle className="text-emerald-500/50 animate-pulse" cx="85%" cy="30%" r="1.5">
        <animate attributeName="r" values="1;2;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <line className="text-emerald-500/30" x1="85%" y1="30%" x2="72%" y2="55%" strokeWidth="0.1" />
    </svg>
  );
};