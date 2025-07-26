interface SessionData {
  nickname: string;
  timestamp: number;
}

const SESSION_KEY = 'live-coding-session';
const SESSION_DURATION = 60 * 60 * 1000; // 1 час в миллисекундах

export const saveSession = (nickname: string): void => {
  const sessionData: SessionData = {
    nickname,
    timestamp: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

export const getSession = (): string | null => {
  try {
    const sessionJson = localStorage.getItem(SESSION_KEY);
    if (!sessionJson) return null;

    const sessionData: SessionData = JSON.parse(sessionJson);
    const now = Date.now();
    
    // Проверяем, не истекла ли сессия
    if (now - sessionData.timestamp > SESSION_DURATION) {
      clearSession();
      return null;
    }

    return sessionData.nickname;
  } catch (error) {
    console.error('Error reading session:', error);
    clearSession();
    return null;
  }
};

export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

export const updateSessionTimestamp = (): void => {
  const sessionJson = localStorage.getItem(SESSION_KEY);
  if (sessionJson) {
    try {
      const sessionData: SessionData = JSON.parse(sessionJson);
      sessionData.timestamp = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error updating session timestamp:', error);
    }
  }
};