import * as FileSystem from 'expo-file-system';
import { Alert, Platform, Linking, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import Constants from 'expo-constants';

const LAST_CHECK_KEY = '@app_last_update_check';

/** Получить код версии из разных источников */
function getVersionCode(): number {
  // 1. Из Constants (Expo managed)
  const expoCfg = Constants.expoConfig as any;
  if (expoCfg?.android?.versionCode) return parseInt(String(expoCfg.android.versionCode), 10);
  if (expoCfg?.version) return parseInt(String(expoCfg.version), 10) || 1;

  // 2. Из нативного манифеста
  try {
    const nativeVersion = Constants.nativeAppVersion;
    if (nativeVersion) return parseInt(nativeVersion.replace(/\./g, ''), 10) || 1;
  } catch {}

  // 3. Из платформенных констант
  if (Platform.OS === 'android') {
    try {
      const buildVersion = (Constants as any).nativeBuildVersion;
      if (buildVersion) return parseInt(buildVersion, 10) || 1;
    } catch {}
  }

  return 1;
}

function getVersionName(): string {
  try {
    const expoCfg = Constants.expoConfig as any;
    if (expoCfg?.version) return expoCfg.version;
  } catch {}
  try {
    return Constants.nativeAppVersion || '1.0.0';
  } catch {}
  return '1.0.0';
}

/**
 * Проверяет наличие обновления на сервере.
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
    const versionCode = getVersionCode();
    const version = getVersionName();

    console.log('[Update] Checking: platform=android, version_code=' + versionCode + ', version=' + version);

    const res = await api.get('/app-versions/check/', {
      params: { platform: 'android', version_code: versionCode, version },
    });

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
  } catch (e: any) {
    console.log('[Update] Check failed:', e?.message || e);
    return null;
  }
}

/**
 * Скачивает APK и запускает установку.
 * Использует Linking.openURL для открытия файла — самый надёжный способ на Android.
 */
export async function downloadAndInstall(downloadUrl: string): Promise<boolean> {
  try {
    const fileUri = FileSystem.cacheDirectory + 'update.apk';

    Alert.alert(
      'Загрузка обновления',
      'Начинается загрузка обновления. Это может занять несколько минут...',
      [{ text: 'OK' }],
    );

    console.log('[Update] Downloading from:', downloadUrl);
    const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri);
    console.log('[Update] Download result:', downloadRes.status, downloadRes.uri);

    if (downloadRes.status !== 200) {
      Alert.alert('Ошибка загрузки', `Код ответа: ${downloadRes.status}`);
      return false;
    }

    // На Android — открываем APK через системный инсталлятор
    if (Platform.OS === 'android') {
      try {
        // Способ 1: IntentLauncher с content URI
        const IntentLauncher = require('expo-intent-launcher');
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: downloadRes.uri,
          flags: 1,
          type: 'application/vnd.android.package-archive',
        });
        return true;
      } catch (err1: any) {
        console.log('[Update] IntentLauncher failed:', err1?.message);
        // Способ 2: Linking (работает если FileProvider настроен)
        try {
          await Linking.openURL(downloadRes.uri);
          return true;
        } catch (err2: any) {
          console.log('[Update] Linking failed:', err2?.message);
          // Способ 3: просто открываем файл (пользователь сам нажмёт установить)
          try {
            const IntentLauncher = require('expo-intent-launcher');
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: downloadRes.uri,
              flags: 1,
              type: 'application/vnd.android.package-archive',
            });
            return true;
          } catch {
            Alert.alert(
              'Файл загружен',
              'APK сохранён в кеше приложения. Найдите его в файловом менеджере и установите вручную.\n\nПуть: ' + downloadRes.uri,
            );
            return false;
          }
        }
      }
    } else {
      await Linking.openURL(downloadRes.uri);
      return true;
    }
  } catch (e: any) {
    console.log('[Update] Install error:', e?.message, e?.stack);
    Alert.alert('Ошибка обновления', e?.message || 'Не удалось установить. Попробуйте ещё раз.');
    return false;
  }
}

/**
 * Автоматическая проверка при старте.
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
    return;
  }

  onResult(update);
}
