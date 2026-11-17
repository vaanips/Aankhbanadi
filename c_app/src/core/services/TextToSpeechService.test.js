import { normalizeSpeechText } from './TextToSpeechService';

describe('normalizeSpeechText', () => {
  it('spells UDID one letter at a time for speech', () => {
    expect(normalizeSpeechText('UDID scan: udid')).toBe(
      'U. D. I. D. scan: U. D. I. D.',
    );
  });
});
