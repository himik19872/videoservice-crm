import * as FileSystem from 'expo-file-system';
import { Alert, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getBaseUrl } from './api';
import Constants from 'expo-constants';

const LAST_CHECK_KEY = '@app_last_update_check';

/**
 * Проверяет наличие обновления на сервере.
 * Вызывать при старте приложения и при ручной проверке.
 */
export async function checkForUpdates(): Promise<{
  hasUpdate: boolean;
  isRequired: boolean;
  latestVersion?: string;
  changelog?: string;
  downloadUrl?: string;
  fileSize?: number;
  fileHash?: string;
} | null> {
  try {
    const versionCode = Constants.expoConfig?.android?.versionCode || Constants.expoConfig?.version || '1';
    const version = Constants.expoConfig?.version || '1.0.0';

    const res = await api.get('/app-versions/check/', {
      params: {
        platform: 'android',
        version_code: versionCode,
        version,
      },
    });

    // Сохраняем время последней проверки
    await AsyncStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());

    return {
      hasUpdate: res.data.has_update || false,
      isRequired: res.data.is_required || false,
      latestVersion: res.data.latest_version,
      changelog: res.data.changelog,
      downloadUrl: res.data.download_url,
      fileSize: res.data.file_size,
      fileHash: res.data.file_hash,
    };
  } catch (e) {
    console.log('Update check failed:', e);
    return null;
  }
}

/**
 * Скачивает APK и открывает его для установки.
 */
export async function downloadAndInstall(downloadUrl: string): Promise<boolean> {
  try {
    const baseUrl = await getBaseUrl();
    // downloadUrl уже содержит полный путь, но если это относительный — дополняем
    const fullUrl = downloadUrl.startsWith('http')
      ? downloadUrl
      : `${baseUrl.replace('/api', '')}${downloadUrl}`;

    const fileUri = FileSystem.documentDirectory + 'update.apk';

    // Показываем уведомление о начале загрузки
    Alert.alert(
      'Загрузка обновления',
      'Идёт загрузка новой версии приложения... Пожалуйста, подождите.',
      [{ text: 'OK' }],
    );

    const downloadRes = await FileSystem.downloadAsync(fullUrl, fileUri);

    if (downloadRes.status !== 200) {
      Alert.alert('Ошибка', 'Не удалось загрузить обновление');
      return false;
    }

    // На Android открываем APK через Intent
    if (Platform.OS === 'android') {
      try {
        const IntentLauncher = require('expo-intent-launcher');
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: downloadRes.uri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
      } catch {
        // Fallback: открываем через Linking
        await Linking.openURL(downloadRes.uri);
      }
    } else {
      // iOS: открываем URL
      await Linking.openURL(downloadRes.uri);
    }

    return true;
  } catch (e: any) {
    console.error('Download/install error:', e);
    Alert.alert('Ошибка обновления', e?.message || 'Не удалось установить обновление');
    return false;
  }
}

/**
 * Автоматическая проверка при старте.
 * Если обновление обязательно — блокирует работу до установки.
 * Если необязательно — предлагает обновиться.
 */
export async function autoCheckUpdates(onResult: (update: {
  hasUpdate: boolean;
  isRequired: boolean;
  latestVersion?: string;
  changelog?: string;
  downloadUrl?: string;
}) => void) {
  const update = await checkForUpdates();

  if (!update || !update.hasUpdate) {
    return; // Нет обновлений
  }

  // Вызываем колбэк — App.tsx сам решит что показать
  onResult(update);
}
