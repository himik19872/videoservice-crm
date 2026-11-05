import * as FileSystem from 'expo-file-system/legacy';
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

    console.log('[Update] Downloading from:', downloadUrl);
    const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri);
    console.log('[Update] Download result:', downloadRes.status, downloadRes.uri);

    if (downloadRes.status !== 200) {
      Alert.alert('Ошибка загрузки', `Не удалось скачать файл (код ${downloadRes.status}). Попробуйте позже.`);
      return false;
    }

    // На Android — открываем APK через системный инсталлятор
    if (Platform.OS === 'android') {
      let contentUri = downloadRes.uri;
      try {
        // content:// нужен, иначе Android 7+ блокирует file:// (FileUriExposed)
        contentUri = await FileSystem.getContentUriAsync(downloadRes.uri);
      } catch (e: any) {
        console.log('[Update] getContentUri failed:', e?.message);
      }
      const data = contentUri;
      const IntentLauncher = require('expo-intent-launcher');
      // Способ 1: INSTALL_PACKAGE
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data,
          flags: 1,
          type: 'application/vnd.android.package-archive',
        });
        return true;
      } catch (err1: any) {
        console.log('[Update] INSTALL_PACKAGE failed:', err1?.message);
      }
      // Способ 2: VIEW с MIME-типом APK
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data,
          flags: 1,
          type: 'application/vnd.android.package-archive',
        });
        return true;
      } catch (err2: any) {
        console.log('[Update] VIEW failed:', err2?.message);
      }
      // Способ 3: отдать пользователю ссылку на скачивание в браузере
      try {
        await Linking.openURL(downloadUrl);
        Alert.alert(
          'Установка вручную',
          'Открыли ссылку в браузере. Скачайте APK и установите его — приложение обновится с сохранением данных.',
        );
        return false;
      } catch {
        Alert.alert(
          'Не удалось запустить установку',
          'Разрешите приложению «Установка неизвестных приложений» в настройках Android и повторите.',
        );
        return false;
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
