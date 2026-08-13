/**
 * OmniAI 五子棋遊戲核心邏輯
 */

import { Player, Position, GameState, Move } from '../types';

export class GameLogic {
  static readonly BOARD_SIZE = 15;
  static readonly WIN_LENGTH = 5;

  /**
   * 創建新遊戲
   */
  static createGame(
    gameId: string,
    mode: 'pvp' | 'ai',
    roomCode?: string
  ): GameState {
    const board: Player[][] = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(null));

    return {
      id: gameId,
      board,
      currentPlayer: 'black', // 黑棋先手
      status: 'waiting',
      mode,
      moves: [],
      winner: null,
      roomCode,
      players: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 檢查位置是否有效
   */
  static isValidPosition(position: Position): boolean {
    return (
      position.row >= 0 &&
      position.row < this.BOARD_SIZE &&
      position.col >= 0 &&
      position.col < this.BOARD_SIZE
    );
  }

  /**
   * 檢查位置是否為空
   */
  static isEmptyPosition(board: Player[][], position: Position): boolean {
    return board[position.row]?.[position.col] === null;
  }

  /**
   * 執行落子
   */
  static makeMove(
    gameState: GameState,
    position: Position,
    player: Player
  ): GameState {
    if (!this.isValidPosition(position)) {
      throw new Error('無效的位置');
    }

    if (!this.isEmptyPosition(gameState.board, position)) {
      throw new Error('該位置已有棋子');
    }

    if (gameState.currentPlayer !== player) {
      throw new Error('不是該玩家的回合');
    }

    if (gameState.status !== 'playing') {
      throw new Error('遊戲尚未開始或已結束');
    }

    // 複製棋盤狀態
    const newBoard = gameState.board.map(row => [...row]);
    const targetRow = newBoard[position.row];
    if (targetRow) {
      targetRow[position.col] = player;
    }

    // 創建新的移動記錄
    const move: Move = {
      player,
      position,
      timestamp: Date.now(),
    };

    // 檢查是否獲勝
    const winner = this.checkWinner(newBoard, position, player);
    const isBoardFull = this.isBoardFull(newBoard);
    const shouldDraw = this.shouldDeclareDraw([...gameState.moves, move]);
    const isDraw = !winner && (isBoardFull || shouldDraw);

    // 更新遊戲狀態
    const newGameState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer:
        winner || isDraw ? gameState.currentPlayer : this.getOpponent(player),
      status: winner || isDraw ? 'finished' : 'playing',
      moves: [...gameState.moves, move],
      winner: winner || (isDraw ? 'draw' : null),
      updatedAt: Date.now(),
    };

    return newGameState;
  }

  /**
   * 檢查是否獲勝
   */
  static checkWinner(
    board: Player[][],
    lastMove: Position,
    player: Player
  ): Player | null {
    const directions = [
      [0, 1], // 水平
      [1, 0], // 垂直
      [1, 1], // 對角線 \
      [1, -1], // 對角線 /
    ];

    for (const direction of directions) {
      const dx = direction[0];
      const dy = direction[1];
      let count = 1; // 包含當前落子

      // 向正方向檢查
      let row = lastMove.row + (dx || 0);
      let col = lastMove.col + (dy || 0);
      while (
        row >= 0 &&
        row < this.BOARD_SIZE &&
        col >= 0 &&
        col < this.BOARD_SIZE &&
        board[row]?.[col] === player
      ) {
        count++;
        row += (dx || 0);
        col += (dy || 0);
      }

      // 向反方向檢查
      row = lastMove.row - (dx || 0);
      col = lastMove.col - (dy || 0);
      while (
        row >= 0 &&
        row < this.BOARD_SIZE &&
        col >= 0 &&
        col < this.BOARD_SIZE &&
        board[row]?.[col] === player
      ) {
        count++;
        row -= (dx || 0);
        col -= (dy || 0);
      }

      if (count >= this.WIN_LENGTH) {
        return player;
      }
    }

    return null;
  }

  /**
   * 檢查棋盤是否已滿
   */
  static isBoardFull(board: Player[][]): boolean {
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 檢查是否應該判定為平局（基於移動次數）
   */
  static shouldDeclareDraw(moves: Move[]): boolean {
    // 15x15 棋盤共 225 格，低於這個數字會在仍可分勝負時提前判和
    return moves.length >= this.BOARD_SIZE * this.BOARD_SIZE;
  }

  /**
   * 獲取對手
   */
  static getOpponent(player: Player): Player {
    return player === 'black' ? 'white' : 'black';
  }

  /**
   * 獲取所有可能的落子位置
   */
  static getAvailableMoves(board: Player[][]): Position[] {
    const moves: Position[] = [];
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null) {
          moves.push({ row, col });
        }
      }
    }
    return moves;
  }

  /**
   * 將棋盤狀態轉換為字符串（用於 AI 分析）
   */
  static boardToString(board: Player[][]): string {
    return board
      .map(row =>
        row
          .map(cell => {
            if (cell === 'black') return 'B';
            if (cell === 'white') return 'W';
            return '.';
          })
          .join('')
      )
      .join('\n');
  }

  /**
   * 獲取棋盤周圍有棋子的空位（用於 AI 優化）
   */
  static getRelevantMoves(board: Player[][], radius: number = 2): Position[] {
    const moves: Position[] = [];
    const hasNeighbor = (row: number, col: number): boolean => {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (
            nr >= 0 &&
            nr < this.BOARD_SIZE &&
            nc >= 0 &&
            nc < this.BOARD_SIZE &&
            board[nr]?.[nc] !== null
          ) {
            return true;
          }
        }
      }
      return false;
    };

    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null && hasNeighbor(row, col)) {
          moves.push({ row, col });
        }
      }
    }

    // 如果沒有相鄰的位置，返回中心位置
    if (moves.length === 0) {
      const center = Math.floor(this.BOARD_SIZE / 2);
      if (board[center]?.[center] === null) {
        moves.push({ row: center, col: center });
      }
    }

    return moves;
  }

  /**
   * 評估位置的重要性（用於 AI 決策）
   */
  static evaluatePosition(
    board: Player[][],
    position: Position,
    player: Player
  ): number {
    let score = 0;
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    for (const [dx, dy] of directions) {
      // 檢查該方向的連子情況
      const line = this.getLine(board, position, dx || 0, dy || 0, player);
      score += this.evaluateLine(line);
    }

    return score;
  }

  /**
   * 評估在某點落子的整體價值
   *
   * 這是引擎唯一的著手評估依據：正式對局與自我訓練都必須走這裡，
   * 否則訓練出來的棋譜對應的是另一套策略，學到的東西用不上。
   */
  static evaluateMove(
    board: Player[][],
    position: Position,
    player: Player
  ): number {
    let score = 0;

    // 基本位置評估
    score += this.evaluatePosition(board, position, player);

    // 防守評估 - 檢查是否需要阻止對手獲勝
    const opponent = this.getOpponent(player);
    score += this.evaluatePosition(board, position, opponent) * 1.1;

    const testBoard = board.map(row => [...row]);
    const targetRow = testBoard[position.row];

    if (targetRow) {
      // 能直接獲勝
      targetRow[position.col] = player;
      if (this.checkWinner(testBoard, position, player)) {
        score += 100000;
      }

      // 能阻止對手獲勝
      targetRow[position.col] = opponent;
      if (this.checkWinner(testBoard, position, opponent)) {
        score += 50000;
      }
    }

    return score;
  }

  /**
   * 以 evaluateMove 挑出最佳著手
   *
   * noise 為 0 時完全確定；自我對戰需要棋局多樣性才有學習價值，
   * 可給予少量擾動在同一套策略附近探索。
   */
  static selectBestMove(
    board: Player[][],
    player: Player,
    noise: number = 0
  ): Position | null {
    const candidates = this.getRelevantMoves(board);

    let best: Position | null = null;
    let bestScore = -Infinity;

    for (const position of candidates) {
      const score =
        this.evaluateMove(board, position, player) +
        (noise > 0 ? Math.random() * noise : 0);

      if (score > bestScore) {
        bestScore = score;
        best = position;
      }
    }

    return best;
  }

  /**
   * 獲取指定方向的連線
   */
  private static getLine(
    board: Player[][],
    position: Position,
    dx: number,
    dy: number,
    player: Player
  ): string {
    let line = '';

    // 向負方向延伸
    for (let i = -4; i < 0; i++) {
      const row = position.row + i * dx;
      const col = position.col + i * dy;
      if (
        row >= 0 &&
        row < this.BOARD_SIZE &&
        col >= 0 &&
        col < this.BOARD_SIZE
      ) {
        const cell = board[row]?.[col];
        line +=
          cell === player ? 'O' : cell === this.getOpponent(player) ? 'X' : '.';
      } else {
        line += 'X'; // 邊界視為對手棋子
      }
    }

    // 當前位置
    line += 'O';

    // 向正方向延伸
    for (let i = 1; i <= 4; i++) {
      const row = position.row + i * dx;
      const col = position.col + i * dy;
      if (
        row >= 0 &&
        row < this.BOARD_SIZE &&
        col >= 0 &&
        col < this.BOARD_SIZE
      ) {
        const cell = board[row]?.[col];
        line +=
          cell === player ? 'O' : cell === this.getOpponent(player) ? 'X' : '.';
      } else {
        line += 'X'; // 邊界視為對手棋子
      }
    }

    return line;
  }

  /**
   * 評估連線的分數
   */
  private static evaluateLine(line: string): number {
    // 由強到弱依序判定，命中最高的一項就結束。
    // 原本每一項各自 if 相加，且眠三/眠二又重複比對活三/活二的樣式，
    // 造成「活三」同時被算成活三加眠三，棋型之間的分數差距失真。
    if (line.includes('OOOOO')) return 100000;

    // 活四
    if (line.includes('.OOOO.')) return 10000;

    // 沖四
    if (line.includes('XOOOO.') || line.includes('.OOOOX')) return 1000;

    // 活三
    if (line.includes('.OOO.')) return 1000;

    // 眠三
    if (line.includes('XOOO.') || line.includes('.OOOX') ||
        line.includes('OO.O') || line.includes('O.OO')) {
      return 100;
    }

    // 活二
    if (line.includes('.OO.')) return 100;

    // 眠二
    if (line.includes('XOO.') || line.includes('.OOX') || line.includes('O.O')) {
      return 10;
    }

    return 0;
  }
}
