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
  static createGame(gameId: string, mode: 'pvp' | 'ai', roomCode?: string): GameState {
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
      updatedAt: Date.now()
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
  static makeMove(gameState: GameState, position: Position, player: Player): GameState {
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
      timestamp: Date.now()
    };

    // 檢查是否獲勝
    const winner = this.checkWinner(newBoard, position, player);
    const isDraw = !winner && this.isBoardFull(newBoard);

    // 更新遊戲狀態
    const newGameState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: winner || isDraw ? gameState.currentPlayer : this.getOpponent(player),
      status: winner || isDraw ? 'finished' : 'playing',
      moves: [...gameState.moves, move],
      winner: winner || (isDraw ? 'draw' : null),
      updatedAt: Date.now()
    };

    return newGameState;
  }

  /**
   * 檢查是否獲勝
   */
  static checkWinner(board: Player[][], lastMove: Position, player: Player): Player | null {
    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 對角線 \
      [1, -1]   // 對角線 /
    ];

    for (const direction of directions) {
      const dx = direction[0];
      const dy = direction[1];
      let count = 1; // 包含當前落子

      // 向正方向檢查
      let row = lastMove.row + dx;
      let col = lastMove.col + dy;
      while (
        row >= 0 && row < this.BOARD_SIZE &&
        col >= 0 && col < this.BOARD_SIZE &&
        board[row]?.[col] === player
      ) {
        count++;
        row += dx;
        col += dy;
      }

      // 向反方向檢查
      row = lastMove.row - dx;
      col = lastMove.col - dy;
      while (
        row >= 0 && row < this.BOARD_SIZE &&
        col >= 0 && col < this.BOARD_SIZE &&
        board[row]?.[col] === player
      ) {
        count++;
        row -= dx;
        col -= dy;
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
            nr >= 0 && nr < this.BOARD_SIZE &&
            nc >= 0 && nc < this.BOARD_SIZE &&
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
  static evaluatePosition(board: Player[][], position: Position, player: Player): number {
    let score = 0;
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    for (const [dx, dy] of directions) {
      // 檢查該方向的連子情況
      const line = this.getLine(board, position, dx, dy, player);
      score += this.evaluateLine(line);
    }

    return score;
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
      if (row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE) {
        const cell = board[row]?.[col];
        line += cell === player ? 'O' : cell === this.getOpponent(player) ? 'X' : '.';
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
      if (row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE) {
        const cell = board[row]?.[col];
        line += cell === player ? 'O' : cell === this.getOpponent(player) ? 'X' : '.';
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
    let score = 0;

    // 五連
    if (line.includes('OOOOO')) score += 100000;
    
    // 活四
    if (line.includes('.OOOO.')) score += 10000;
    
    // 沖四
    if (line.includes('XOOOO.') || line.includes('.OOOOX')) score += 1000;
    
    // 活三
    if (line.includes('.OOO.')) score += 1000;
    
    // 眠三
    if (line.includes('.OOO.') || line.includes('XOO.O.') || line.includes('.O.OOX')) score += 100;
    
    // 活二
    if (line.includes('.OO.')) score += 100;
    
    // 眠二
    if (line.includes('.OO.') || line.includes('XO.O.') || line.includes('.O.OX')) score += 10;

    return score;
  }
}
