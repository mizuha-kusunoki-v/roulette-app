import { useEffect, useRef } from "react";

interface Props {
  participants: string[];     // 円に表示する名前（固定）
  winnerIndex: number;        // 当選者 index（0始まり）
  onFinish: () => void;       // 全演出完了時に1回だけ呼ばれる
}

/**
 * CanvasRoulette
 * - マウントされた瞬間に自動で開始
 * - 回転 → 減速 → 停止 → フラッシュ → 5秒待機 → onFinish
 * - React state に一切依存しない
 */
export const CanvasRoulette = ({
  participants,
  winnerIndex,
  onFinish,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ===== 内部状態（すべて useRef）=====
  const rotationRef = useRef(0);
  const phaseRef = useRef<
    "spin" | "slow" | "stopped" | "flash" | "done"
  >("spin");
  const phaseStartRef = useRef(0);
  const targetRotationRef = useRef(0);

  const size = 420;
  const radius = size / 2;
  const textRadius = radius * 0.78;

  // ===== 初期化（マウント時に1回だけ）=====
  useEffect(() => {
    const count = participants.length;
    const anglePer = (2 * Math.PI) / count;

    const winnerAngle =
      winnerIndex * anglePer + anglePer / 2;

    // 12時方向に当選者中央を合わせる
    targetRotationRef.current =
      -Math.PI / 2 - winnerAngle + Math.PI * 2 * 5;

    phaseRef.current = "spin";
    phaseStartRef.current = performance.now();
  }, []);

  useEffect(() => {
    console.log("[Canvas init]", {
    participants,
    winnerIndex,
  });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const getColor = (i: number, count: number) =>
      `hsl(${(i * 360) / count}, 70%, 55%)`;

    const draw = (flash: boolean) => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(rotationRef.current);

      const count = participants.length;
      const anglePer = (2 * Math.PI) / count;

      participants.forEach((name, i) => {
        const start = i * anglePer;
        const end = start + anglePer;
        const isWinner = i === winnerIndex;

        // 扇形
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 4, start, end);
        ctx.closePath();

        ctx.fillStyle =
          isWinner && flash
            ? "#ffd54f"
            : getColor(i, count);

        ctx.fill();

        // 当選枠の枠線
        if (isWinner) {
          ctx.strokeStyle = "#ffeb3b";
          ctx.lineWidth = flash ? 6 : 3;
          ctx.stroke();
        }

        // 文字
        ctx.save();
        ctx.rotate(start + anglePer / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(name, textRadius, 6);
        ctx.restore();
      });

      ctx.restore();

      // ポインタ（固定）
      ctx.fillStyle = "#e53935";
      ctx.beginPath();
      ctx.moveTo(radius - 10, 4);
      ctx.lineTo(radius + 10, 4);
      ctx.lineTo(radius, 24);
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      const now = performance.now();

      switch (phaseRef.current) {
        case "spin": {
          // 等速回転（2秒）
          rotationRef.current += 0.08;
          draw(false);

          if (now - phaseStartRef.current > 2000) {
            phaseRef.current = "slow";
          }
          break;
        }

        case "slow": {
          // 減速して当選位置へ
          const diff =
            targetRotationRef.current -
            rotationRef.current;
          console.log("[Canvas slow]", {
            diff,
            rotation: rotationRef.current,
            target: targetRotationRef.current,
            winnerIndex,
        });

          rotationRef.current += diff * 0.08;
          draw(false);

          if (Math.abs(diff) < 0.001) {
            rotationRef.current =
              targetRotationRef.current;
            phaseRef.current = "stopped";
            phaseStartRef.current = now;
          }
          break;
        }

        case "stopped": {
          // 完全停止の余韻（0.3秒）
          draw(false);

          if (now - phaseStartRef.current > 300) {
            phaseRef.current = "flash";
            phaseStartRef.current = now;
          }
          break;
        }

        case "flash": {
          // 当選フラッシュ（5秒）
          const elapsed = now - phaseStartRef.current;
          const flash = Math.floor(elapsed / 300) % 2 === 0;

          draw(flash);

          if (elapsed > 5000) {
            phaseRef.current = "done";
            onFinish(); // ✅ ここで1回だけ通知
            return;
          }
          break;
        }

        case "done":
          return;
      }

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(rafId);
  }, [participants, winnerIndex, onFinish]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", margin: "0 auto" }}
    />
  );
};