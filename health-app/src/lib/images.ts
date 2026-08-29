import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

export type PickSource = 'kamera' | 'galleri';

/** Åbner kamera eller galleri og returnerer alle valgte billeders URI. */
export async function pickImages(
  source: PickSource,
  allowMultiple = false,
): Promise<string[]> {
  if (source === 'kamera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    return res.canceled ? [] : res.assets.map((a) => a.uri);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsMultipleSelection: allowMultiple,
    selectionLimit: allowMultiple ? 8 : 1,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/**
 * Skalerer billedet ned og pakker det som JPEG i base64. Store telefonbilleder
 * er 4-8 MB; 1024 px er rigeligt til at genkende et måltid, og det holder både
 * svartid og pris nede.
 */
export async function prepareForApi(
  uri: string,
  maxWidth = 1024,
  compress = 0.7,
): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('Billedet kunne ikke læses.');
  return result.base64;
}

/**
 * Flytter et billede fra kameraets midlertidige mappe til appens egen, så det
 * stadig findes næste gang appen åbnes. Billedet forlader aldrig telefonen
 * ud over selve API-kaldet.
 */
export async function persistImage(uri: string, folder: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, folder);
  if (!dir.exists) dir.create({ intermediates: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const dest = new File(dir, name);
  const src = new File(uri);
  await src.copy(dest);
  return dest.uri;
}

export async function removeImage(uri: string | null): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Et manglende billede er ikke værd at fejle på.
  }
}
