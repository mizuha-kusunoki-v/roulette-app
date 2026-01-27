ルーレット抽選システム 設計メモ（草案）
1. 概要
本システムは、
配信向けの視覚的なルーレット抽選 UI を提供するための仕組みである。

抽選ロジックは バックエンドで完結
フロントエンドは WebSocket 経由で状態を受信し、
ルーレット演出
抽選結果の表示
を担当する
ルーレットの回転・減速・停止・フラッシュ演出は
CanvasRoulette コンポーネント内で自己完結させている
2. 全体構成
Copy
[ 管理画面 ]
     │  抽選実行（HTTP）
     ▼
[ Backend (FastAPI) ]
     │  状態配信（WebSocket）
     ▼
[ Viewer (React) ]
     ├─ ルーレット表示（Canvas）
     └─ 結果表示（HTML/CSS）
3. フロントエンド構成
3.1 ディレクトリ構成（例）
Copy
src/
├─ viewer/
│  ├─ ViewerPage.tsx        # Viewerのルートコンポーネント
│  ├─ CanvasRoulette.tsx    # ルーレット描画・演出（自己完結）
│  ├─ ResultPanel.tsx       # 抽選結果表示（任意で分離）
│  └─ viewer.css            # Viewer用スタイル
│
├─ types/
│  └─ roulette.ts           # RouletteState 型定義
│
└─ utils/
   └─ （必要に応じて）
3.2 ViewerPage の責務
ViewerPage.tsx は 司令塔であり、以下のみを担当する。

主な責務
WebSocket 接続の管理
サーバーから送られてきた 最新状態の保持
抽選開始の検知（round_id）
何人分ルーレットを回すかの管理
CanvasRoulette の 呼び出し制御
抽選結果・補足情報の表示
管理する状態（例）
ts
Copy
// サーバーから受信した「事実」
const [serverState, setServerState] = useState<RouletteState | null>(null);

// UI制御用
const [uiStatus, setUiStatus] = useState<"idle" | "running" | "done">("idle");
const [spinIndex, setSpinIndex] = useState(0);

// 表示用データ
const [wheelParticipants, setWheelParticipants] = useState<string[]>([]);
const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
※ serverState は UI制御には直接使わない
※ UI の進行は uiStatus / spinIndex のみで管理する

3.3 CanvasRoulette の責務
CanvasRoulette.tsx は 1回分のルーレット演出を完結させる部品。

特徴
React の state は一切使わない
useRef のみで内部状態を管理
マウントされたら即座に演出を開始
演出完了後に onFinish() を 1回だけ呼ぶ
Props
ts
Copy
interface CanvasRouletteProps {
  participants: string[];   // 今回表示する参加者（抽選対象そのもの）
  winnerIndex: number;      // participants配列に対する当選者index
  onFinish: () => void;     // 演出完了時コールバック
}
内部フェーズ（例）
Copy
spin     : 等速回転
slow     : 減速
stopped  : 完全停止（余韻）
flash    : 当選フラッシュ
done     : 完了
※ フェーズ管理は Canvas 内でのみ行う

4. バックエンド構成（概要）
4.1 使用技術
FastAPI
WebSocket（状態配信用）
4.2 WebSocket API
エンドポイント
Copy
GET /ws
挙動
接続時に accept
一定間隔（例: 100ms）で現在の状態を送信
抽選実行後は新しい状態が即時送信される
実装イメージ
python
Copy
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json(state.dict())
            await asyncio.sleep(0.1)
    except Exception:
        pass
4.3 送信される状態（RouletteState）
ts
Copy
interface RouletteState {
  participants: string[];      // 全参加者
  prev_players: string[];      // 前回参加者
  last_players: string[];      // 直近当選者（ID順）
  miss_counts: Record<string, number>; // 未当選回数
  result: {
    teamA: string[];
    teamB: string[];
  } | null;
  round_id: string | null;     // 抽選ID（新規抽選判定用）
  phase?: string;              // Backend側の状態（Viewerでは未使用）
}
5. 抽選と表示の考え方（重要）
5.1 抽選対象と表示対象
原則：

実際に抽選に使った配列 ＝ ルーレットに表示する配列

人数不足時の扱い
通常：
participants - prev_players
人数不足時：
前回参加者を含めた配列を使用
この 最終抽選対象配列を Viewer 側で 1 回だけ確定し、
以後はそれを基準に：

ルーレット表示
winnerIndex 計算
を行う。

5.2 ルーレット回数
3人抽選：3回
4人抽選：4回
ts
Copy
const drawCount =
  result.teamA.length + result.teamB.length;
1回転 = 1人確定、という演出設計。

6. 結果表示仕様
抽選完了後に結果パネルを表示
3人抽選時：
チームAが1人の場合は「私 / 参加者」表記に切り替え
例：

tsx
Copy
teamA.length === 1
  ? `私：${teamA[0]}`
  : `チームA：${teamA.join(" / ")}`
前回参加者、次回確定枠（miss_counts >= N）を併記
7. 補足・設計方針メモ
Viewer は Backend の phase を信用しない
UI の状態は Viewer が決める
時間制御は Canvas に閉じる
WebSocket は「事実の配信」に徹する
表示とロジックの基準配列は必ず一致させる