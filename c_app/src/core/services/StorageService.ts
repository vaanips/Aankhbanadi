import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const log = createLogger('StorageService');

export const StorageService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      log.error(`get failed for ${key}`, error);
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      log.error(`set failed for ${key}`, error);
      throw error;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      log.error(`remove failed for ${key}`, error);
      throw error;
    }
  },

  async getManyParsed(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      pairs.forEach(([key, value]) => {
        if (value !== null) {
          try {
            result[key] = JSON.parse(value) as unknown;
          } catch {
            result[key] = value;
          }
        }
      });
    } catch (error) {
      log.error('multiGet failed', error);
    }
    return result;
  },
};