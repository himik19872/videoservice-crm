/**
 * Глобальная ссылка на навигацию — позволяет переходить на экраны
 * из обработчиков уведомлений (вне компонентов-экранов).
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

/** Открыть чат с сотрудником (или общий чат при recipientId = 0). */
export function navigateToChat(params: { recipientId: number; recipientName?: string; role?: string }) {
  const go = () => {
    try {
      (navigationRef as any).navigate('Messages', params);
    } catch (e) {
      // навигация ещё не готова
    }
  };
  if (navigationRef.isReady()) {
    go();
  } else {
    // ждём готовности навигации (холодный старт по уведомлению)
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (navigationRef.isReady()) {
        clearInterval(timer);
        go();
      } else if (tries > 20) {
        clearInterval(timer);
      }
    }, 300);
  }
}
