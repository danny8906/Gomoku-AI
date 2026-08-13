export interface Translations {
  // Navigation
  home: string;
  aiGame: string;
  pvpGame: string;
  gameRecords: string;
  admin: string;
  
  // Game UI
  gameTitle: string;
  newGame: string;
  joinRoom: string;
  createRoom: string;
  roomCode: string;
  enterRoomCode: string;
  player1: string;
  player2: string;
  currentPlayer: string;
  gameStatus: string;
  moveHistory: string;
  aiStatus: string;
  aiCurrentStatus: string;
  aiThinkingTime: string;
  waiting: string;
  thinking: string;
  completed: string;
  
  // Game Status
  gameWaiting: string;
  gameInProgress: string;
  gameFinished: string;
  playerWon: string;
  aiWon: string;
  draw: string;
  yourTurn: string;
  aiTurn: string;
  
  // AI Difficulty
  easy: string;
  medium: string;
  hard: string;
  
  // Buttons
  start: string;
  restart: string;
  copyUrl: string;
  copied: string;
  copyFailed: string;
  roomUrl: string;
  copyRoomUrl: string;
  
  // Messages
  gameCreated: string;
  roomJoined: string;
  invalidRoomCode: string;
  roomNotFound: string;
  roomFull: string;
  gameEnded: string;
  aiThinking: string;
  aiMoveCompleted: string;
  
  // Admin
  adminPanel: string;
  systemStats: string;
  activeRooms: string;
  totalGames: string;
  aiTraining: string;
  startTraining: string;
  trainingStats: string;
  
  // AI Training
  trainingStarted: string;
  trainingCompleted: string;
  trainingFailed: string;
  gamesGenerated: string;
  averageScore: string;
  trainingProgress: string;
  
  // Error Messages
  errorOccurred: string;
  networkError: string;
  invalidMove: string;
  gameNotFound: string;
  permissionDenied: string;
  
  // Time Units
  seconds: string;
  milliseconds: string;
  
  // Toast Messages
  success: string;
  error: string;
  warning: string;
  info: string;
}

export const translations: Record<string, Translations> = {
  'zh-TW': {
    // Navigation
    home: '首頁',
    aiGame: 'AI對戰',
    pvpGame: '雙人對戰',
    gameRecords: '遊戲紀錄',
    admin: '管理後台',
    
    // Game UI
    gameTitle: '五子棋',
    newGame: '新遊戲',
    joinRoom: '加入房間',
    createRoom: '創建房間',
    roomCode: '房間代碼',
    enterRoomCode: '輸入房間代碼',
    player1: '玩家1',
    player2: '玩家2',
    currentPlayer: '當前玩家',
    gameStatus: '遊戲狀態',
    moveHistory: '走法紀錄',
    aiStatus: '🤖 AI 狀態',
    aiCurrentStatus: '狀態：',
    aiThinkingTime: '上一步用時：',
    waiting: '等待中',
    thinking: '思考中',
    completed: '已完成',
    
    // Game Status
    gameWaiting: '等待開始',
    gameInProgress: '進行中',
    gameFinished: '已結束',
    playerWon: '玩家獲勝',
    aiWon: 'AI獲勝',
    draw: '平局',
    yourTurn: '輪到您',
    aiTurn: 'AI思考中',
    
    // AI Difficulty
    easy: '簡單',
    medium: '中等',
    hard: '困難',
    
    // Buttons
    start: '開始',
    restart: '重新開始',
    copyUrl: '複製網址',
    copied: '已複製',
    copyFailed: '複製失敗，請手動複製網址',
    roomUrl: '房間網址：',
    copyRoomUrl: '複製網址',
    
    // Messages
    gameCreated: '遊戲已創建',
    roomJoined: '成功加入房間',
    invalidRoomCode: '無效的房間代碼',
    roomNotFound: '房間不存在',
    roomFull: '房間已滿',
    gameEnded: '遊戲已結束',
    aiThinking: 'AI正在思考...',
    aiMoveCompleted: 'AI已完成落子',
    
    // Admin
    adminPanel: '管理面板',
    systemStats: '系統統計',
    activeRooms: '活躍房間',
    totalGames: '總遊戲數',
    aiTraining: 'AI訓練',
    startTraining: '開始訓練',
    trainingStats: '訓練統計',
    
    // AI Training
    trainingStarted: 'AI訓練已開始',
    trainingCompleted: 'AI訓練已完成',
    trainingFailed: 'AI訓練失敗',
    gamesGenerated: '生成遊戲數',
    averageScore: '平均分數',
    trainingProgress: '訓練進度',
    
    // Error Messages
    errorOccurred: '發生錯誤',
    networkError: '網絡錯誤',
    invalidMove: '無效的落子',
    gameNotFound: '找不到遊戲',
    permissionDenied: '權限不足',
    
    // Time Units
    seconds: '秒',
    milliseconds: '毫秒',
    
    // Toast Messages
    success: '成功',
    error: '錯誤',
    warning: '警告',
    info: '提示'
  },
  'en': {
    // Navigation
    home: 'Home',
    aiGame: 'AI Game',
    pvpGame: 'PvP Game',
    gameRecords: 'Game Records',
    admin: 'Admin',
    
    // Game UI
    gameTitle: 'Gomoku',
    newGame: 'New Game',
    joinRoom: 'Join Room',
    createRoom: 'Create Room',
    roomCode: 'Room Code',
    enterRoomCode: 'Enter Room Code',
    player1: 'Player 1',
    player2: 'Player 2',
    currentPlayer: 'Current Player',
    gameStatus: 'Game Status',
    moveHistory: 'Move History',
    aiStatus: '🤖 AI Status',
    aiCurrentStatus: 'Status:',
    aiThinkingTime: 'Last Move Time:',
    waiting: 'Waiting',
    thinking: 'Thinking',
    completed: 'Completed',
    
    // Game Status
    gameWaiting: 'Waiting to Start',
    gameInProgress: 'In Progress',
    gameFinished: 'Finished',
    playerWon: 'Player Won',
    aiWon: 'AI Won',
    draw: 'Draw',
    yourTurn: 'Your Turn',
    aiTurn: 'AI Thinking',
    
    // AI Difficulty
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    
    // Buttons
    start: 'Start',
    restart: 'Restart',
    copyUrl: 'Copy URL',
    copied: 'Copied',
    copyFailed: 'Copy failed, please copy manually',
    roomUrl: 'Room URL:',
    copyRoomUrl: 'Copy URL',
    
    // Messages
    gameCreated: 'Game Created',
    roomJoined: 'Successfully joined room',
    invalidRoomCode: 'Invalid room code',
    roomNotFound: 'Room not found',
    roomFull: 'Room is full',
    gameEnded: 'Game ended',
    aiThinking: 'AI is thinking...',
    aiMoveCompleted: 'AI move completed',
    
    // Admin
    adminPanel: 'Admin Panel',
    systemStats: 'System Stats',
    activeRooms: 'Active Rooms',
    totalGames: 'Total Games',
    aiTraining: 'AI Training',
    startTraining: 'Start Training',
    trainingStats: 'Training Stats',
    
    // AI Training
    trainingStarted: 'AI training started',
    trainingCompleted: 'AI training completed',
    trainingFailed: 'AI training failed',
    gamesGenerated: 'Games Generated',
    averageScore: 'Average Score',
    trainingProgress: 'Training Progress',
    
    // Error Messages
    errorOccurred: 'Error occurred',
    networkError: 'Network error',
    invalidMove: 'Invalid move',
    gameNotFound: 'Game not found',
    permissionDenied: 'Permission denied',
    
    // Time Units
    seconds: 's',
    milliseconds: 'ms',
    
    // Toast Messages
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  }
};

export function detectLanguage(request: Request): string {
  const acceptLanguage = request.headers.get('Accept-Language');
  
  if (!acceptLanguage) {
    return 'zh-TW'; // Default to Traditional Chinese
  }
  
  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, qValue] = lang.trim().split(';q=');
      const quality = qValue ? parseFloat(qValue) : 1.0;
      return { locale: (locale ?? '').toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality);
  
  // Check for supported languages
  for (const { locale } of languages) {
    if (locale.startsWith('zh-tw') || locale.startsWith('zh-hant')) {
      return 'zh-TW';
    }
    if (locale.startsWith('en')) {
      return 'en';
    }
    if (locale.startsWith('zh')) {
      return 'zh-TW'; // Default Chinese to Traditional
    }
  }
  
  return 'en'; // Default to English if no match
}

export function getTranslations(language: string): Translations {
  return translations[language] ?? (translations['en'] as Translations);
}

export function t(key: keyof Translations, language: string = 'zh-TW'): string {
  const translation = getTranslations(language);
  return translation[key] || key;
}
