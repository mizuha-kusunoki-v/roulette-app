import { draw } from "../api/client";
import { RouletteResult } from "../types";

interface Props {
  onResult: (r: RouletteResult) => void;
  onUpdated: () => void;
}

export const RouletteController = ({ onResult, onUpdated }: Props) => {
  const exec = async (count: number) => {
    const result = await draw(count);
    onResult(result);
    onUpdated();
  };

  return (
    <div>
      <h2>抽選</h2>
      <button onClick={() => exec(3)}>3人抽選</button>
      <button onClick={() => exec(4)}>4人抽選</button>
    </div>
  );
};