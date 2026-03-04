"use client";

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  exposure: string;
  fill: string;
}

export default function TreemapContent(props: TreemapContentProps) {
  const { x, y, width, height, name, exposure, fill } = props;
  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={fill} stroke="#1f2937" strokeWidth={2} rx={4}
        style={{ opacity: 0.85 }}
      />
      {width > 60 && height > 40 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6}
            textAnchor="middle" fill="#fff" fontSize={width > 100 ? 13 : 10} fontWeight="bold">
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10}
            textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={width > 100 ? 11 : 9}>
            {exposure}
          </text>
        </>
      )}
    </g>
  );
}
