import {
  objectValue,
  stringValue,
  arrayValue,
} from '../../../src/shared/validation/jsonValues';
import type { CacheValidation } from './cachePolicy';

export class CacheHardwareEvidence {
  private readonly players = new Set<string>();
  private platform = false;
  private decoder = false;
  private failed = false;
  private readonly properties: {
    playerId: string;
    name: string;
    value: string;
  }[] = [];
  observe(method: string, value: unknown): void {
    if (method === 'Media.playerErrorsRaised') this.failed = true;
    if (method !== 'Media.playerPropertiesChanged') return;
    try {
      const v = objectValue(value);
      const playerId = stringValue(v.playerId);
      const properties = arrayValue(v.properties, 0, 128).map((property) => {
        const p = objectValue(property);
        return { name: stringValue(p.name), value: stringValue(p.value) };
      });
      this.players.add(playerId);
      for (const property of properties) {
        if (
          ['kIsPlatformVideoDecoder', 'kVideoDecoderName'].includes(
            property.name,
          )
        ) {
          if (this.properties.length >= 512)
            throw Error('CACHE_HARDWARE_EVIDENCE_LIMIT');
          this.properties.push({ playerId, ...property });
        }
        if (property.name === 'kIsPlatformVideoDecoder') {
          if (property.value === 'true') this.platform = true;
          else this.failed = true;
        }
        if (property.name === 'kVideoDecoderName') {
          if (property.value === 'VideoToolboxVideoDecoder')
            this.decoder = true;
          else this.failed = true;
        }
      }
    } catch {
      this.failed = true;
    }
  }

  snapshot(): { playerId: string; name: string; value: string }[] {
    return this.properties.map((property) => ({ ...property }));
  }

  finish(runtime: string): Omit<CacheValidation['hardware'], 'coverage'> {
    if (
      this.players.size !== 1 ||
      !this.platform ||
      !this.decoder ||
      this.failed
    )
      throw Error('CACHE_HARDWARE_UNCONFIRMED');
    return { runtime, platformDecoder: true, softwareFallback: false };
  }
}
