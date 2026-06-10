import React from 'react';
import { AW_REFERENCE_TOKENS } from '../lib/design-tokens';
import {
  PortfolioExposureAxisId,
  PortfolioIntelligenceMap,
  PortfolioIntelligencePosition,
} from '../types/portfolio-intelligence';

interface PortfolioIntelligenceCanvasSceneProps {
  intelligenceMap: PortfolioIntelligenceMap;
  compact?: boolean;
}

type ScenePoint = { x: number; y: number };

const AXIS_ANGLES: Record<PortfolioExposureAxisId, number> = {
  growth: -88,
  defense: -2,
  liquidity: 92,
  hedge: 182,
};

const AXIS_ORBIT: Record<PortfolioExposureAxisId, number> = {
  growth: 0.94,
  defense: 0.86,
  liquidity: 0.74,
  hedge: 0.82,
};

const SCENE_COLORS = AW_REFERENCE_TOKENS.color;

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized;
  const numeric = Number.parseInt(value, 16);
  if (Number.isNaN(numeric)) return hexToRgb(SCENE_COLORS.line);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function alpha(hex: string, opacity: number) {
  const rgb = hexToRgb(hex);
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${opacity})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function orbitPoint(center: ScenePoint, radiusX: number, radiusY: number, axis: PortfolioExposureAxisId, value: number) {
  const angle = toRadians(AXIS_ANGLES[axis]);
  const orbit = AXIS_ORBIT[axis] * (0.36 + clamp(value, 0, 100) / 155);
  return {
    x: center.x + Math.cos(angle) * radiusX * orbit,
    y: center.y + Math.sin(angle) * radiusY * orbit,
  };
}

function deterministicNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  start: ScenePoint,
  end: ScenePoint,
  color: string,
  width: number,
  opacity = 0.84,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = alpha(color, 0.22);
  ctx.shadowBlur = 8;
  ctx.lineWidth = width + 3;
  ctx.strokeStyle = alpha(color, 0.045);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.shadowBlur = 5;
  ctx.lineWidth = width;
  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  gradient.addColorStop(0, alpha(color, 0.045));
  gradient.addColorStop(0.5, alpha(color, opacity * 0.58));
  gradient.addColorStop(1, alpha(color, 0.66));
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, compact: boolean) {
  const origin = { x: width * 0.51, y: height * (compact ? 0.78 : 0.76) };
  const stepX = width * (compact ? 0.038 : 0.034);
  const stepY = height * (compact ? 0.018 : 0.017);
  const depth = compact ? 7 : 10;

  const project = (u: number, v: number): ScenePoint => ({
    x: origin.x + (u - v) * stepX,
    y: origin.y + (u + v) * stepY,
  });

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1;
  for (let i = -depth; i <= depth; i += 1) {
    const fade = 1 - Math.abs(i) / (depth + 1);
    ctx.strokeStyle = alpha(SCENE_COLORS.line, 0.028 + fade * 0.060);
    ctx.beginPath();
    const a = project(i, -depth);
    const b = project(i, depth);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = project(-depth, i);
    const d = project(depth, i);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  for (let i = 0; i < 36; i += 1) {
    const u = -depth + deterministicNoise(i + 3) * depth * 2;
    const v = -depth + deterministicNoise(i + 9) * depth * 2;
    const dot = project(u, v);
    const radius = 0.8 + deterministicNoise(i + 31) * 1.9;
    ctx.fillStyle = alpha(SCENE_COLORS.line, 0.07 + deterministicNoise(i + 44) * 0.18);
    ctx.shadowColor = alpha(SCENE_COLORS.line, 0.16);
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRadialField(
  ctx: CanvasRenderingContext2D,
  center: ScenePoint,
  radiusX: number,
  radiusY: number,
  map: PortfolioIntelligenceMap,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  map.axes.forEach((axis, index) => {
    const start = toRadians(AXIS_ANGLES[axis.id] - 36);
    const end = toRadians(AXIS_ANGLES[axis.id] + 36);
    const currentRadius = 0.44 + clamp(axis.value, 0, 100) / 170;
    const projectedRadius = 0.44 + clamp(axis.projectedValue, 0, 100) / 170;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radiusX * currentRadius, start, end);
    ctx.closePath();
    ctx.fillStyle = alpha(axis.color, 0.040);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = alpha(axis.color, 0.22);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radiusX * projectedRadius, start, end);
    ctx.lineWidth = 2;
    ctx.setLineDash([4 + index, 7]);
    ctx.strokeStyle = alpha(axis.color, 0.34);
    ctx.shadowColor = alpha(axis.color, 0.18);
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  });

  for (let i = 1; i <= 7; i += 1) {
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusX * (i / 7), radiusY * (i / 7), 0, 0, Math.PI * 2);
    ctx.lineWidth = i === 7 ? 1.2 : 0.8;
    ctx.strokeStyle = `rgb(238 243 234 / ${i === 7 ? 0.12 : 0.055})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPositionColumn(
  ctx: CanvasRenderingContext2D,
  position: PortfolioIntelligencePosition,
  index: number,
  center: ScenePoint,
  radiusX: number,
  radiusY: number,
  color: string,
  height: number,
) {
  const base = orbitPoint(center, radiusX, radiusY, position.axis, position.weight + 24);
  const jitterX = (deterministicNoise(index + 71) - 0.5) * radiusX * 0.24;
  const jitterY = (deterministicNoise(index + 99) - 0.5) * radiusY * 0.38;
  const start = { x: base.x + jitterX, y: base.y + jitterY };
  const end = { x: start.x, y: start.y - height };
  const lineWidth = clamp(1.4 + position.weight / 9, 2, 7);

  drawGlowLine(ctx, start, end, color, lineWidth, 0.88);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = alpha(color, 0.24);
  ctx.shadowBlur = 8;
  const topGradient = ctx.createRadialGradient(end.x - 1, end.y - 1, 0, end.x, end.y, 7 + lineWidth);
  topGradient.addColorStop(0, 'rgb(238 243 234 / 0.82)');
  topGradient.addColorStop(0.25, alpha(color, 0.64));
  topGradient.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = topGradient;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 5 + lineWidth * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMissingNodes(
  ctx: CanvasRenderingContext2D,
  center: ScenePoint,
  radiusX: number,
  radiusY: number,
  map: PortfolioIntelligenceMap,
) {
  if (map.missingPieces.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  map.missingPieces.slice(0, 5).forEach((piece, index) => {
    const color = map.axes.find((axis) => axis.id === piece.axis)?.color || SCENE_COLORS.amber;
    const point = orbitPoint(center, radiusX, radiusY, piece.axis, piece.targetValue + 22 + index * 4);
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = alpha(color, piece.severity === 'high' ? 0.38 : 0.26);
    ctx.shadowColor = alpha(color, 0.16);
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(point.x, point.y, piece.severity === 'high' ? 12 : 9, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawCore(ctx: CanvasRenderingContext2D, center: ScenePoint, radius: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const shadow = ctx.createRadialGradient(center.x, center.y + radius * 0.32, 0, center.x, center.y + radius * 0.32, radius * 1.9);
  shadow.addColorStop(0, 'rgb(0 0 0 / 0.78)');
  shadow.addColorStop(1, 'rgb(0 0 0 / 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + radius * 0.9, radius * 1.26, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  const sphere = ctx.createRadialGradient(
    center.x - radius * 0.26,
    center.y - radius * 0.34,
    radius * 0.06,
    center.x,
    center.y,
    radius,
  );
  sphere.addColorStop(0, 'rgb(238 243 234 / 0.66)');
  sphere.addColorStop(0.24, alpha(SCENE_COLORS.line, 0.30));
  sphere.addColorStop(0.58, 'rgb(18 20 19 / 0.92)');
  sphere.addColorStop(1, 'rgb(0 0 0 / 0.96)');
  ctx.fillStyle = sphere;
  ctx.shadowColor = alpha(SCENE_COLORS.line, 0.16);
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgb(238 243 234 / 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  map: PortfolioIntelligenceMap,
  compact: boolean,
  time: number,
) {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createRadialGradient(width * 0.48, height * 0.42, 0, width * 0.5, height * 0.55, width * 0.72);
  background.addColorStop(0, alpha(SCENE_COLORS.line, 0.045));
  background.addColorStop(0.32, 'rgb(18 20 19 / 0.22)');
  background.addColorStop(1, 'rgb(0 0 0 / 0)');
  ctx.fillStyle = SCENE_COLORS.card;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.52, width * 0.2, width * 0.5, height * 0.52, width * 0.78);
  vignette.addColorStop(0, 'rgb(0 0 0 / 0)');
  vignette.addColorStop(1, 'rgb(0 0 0 / 0.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const pulse = 1 + Math.sin(time / 1250) * 0.035;
  const center = { x: width * 0.5, y: height * (compact ? 0.59 : 0.58) };
  const radiusX = width * (compact ? 0.37 : 0.35) * pulse;
  const radiusY = height * (compact ? 0.22 : 0.23) * pulse;

  drawGrid(ctx, width, height, compact);
  drawRadialField(ctx, center, radiusX, radiusY, map);

  const topPositions = map.positions.slice(0, compact ? 8 : 14);
  if (topPositions.length > 0) {
    topPositions.forEach((position, index) => {
      const color = map.axes.find((axis) => axis.id === position.axis)?.color || SCENE_COLORS.line;
      const heightScale = compact ? 0.86 : 1;
      const columnHeight = (18 + clamp(position.weight, 0, 42) * 2.2 + deterministicNoise(index + 5) * 14) * heightScale;
      drawPositionColumn(ctx, position, index, center, radiusX, radiusY, color, columnHeight);
    });
  } else {
    map.axes.forEach((axis, index) => {
      const base = orbitPoint(center, radiusX, radiusY, axis.id, 38);
      const end = { x: base.x, y: base.y - (22 + index * 7) };
      drawGlowLine(ctx, base, end, axis.color, 2, 0.42);
    });
  }

  drawMissingNodes(ctx, center, radiusX, radiusY, map);
  drawCore(ctx, center, compact ? 20 : 26);
}

export function PortfolioIntelligenceCanvasScene({
  intelligenceMap,
  compact = false,
}: PortfolioIntelligenceCanvasSceneProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return undefined;

    let width = 0;
    let height = 0;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(nextWidth * dpr);
      canvas.height = Math.round(nextHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const render = (time: number) => {
      if (disposed) return;
      if (width > 0 && height > 0) {
        drawScene(context, width, height, intelligenceMap, compact, time);
      }
      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      observer?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [compact, intelligenceMap]);

  return (
    <canvas
      ref={canvasRef}
      className="aw-pim-canvas"
      data-arbitra-portfolio-intelligence-canvas="true"
      aria-hidden="true"
    />
  );
}
