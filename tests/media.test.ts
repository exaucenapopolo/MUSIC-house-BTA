import { describe, expect, it } from 'vitest';
import { getYouTubeEmbedUrl } from '../src/ServiceCatalog';

describe('présentation vidéo des prestations', () => {
  it('intègre les liens youtube.com/watch dans un lecteur embarqué', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=abcdefghijk'))
      .toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&modestbranding=1');
  });

  it('accepte les liens courts youtu.be', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/abcdefghijk'))
      .toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&modestbranding=1');
  });

  it('accepte les liens YouTube Shorts', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/shorts/abcdefghijk'))
      .toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&modestbranding=1');
  });

  it('refuse les liens qui ne sont pas des vidéos YouTube reconnues', () => {
    expect(getYouTubeEmbedUrl('https://example.com/watch?v=abcdefghijk')).toBe('');
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=invalid')).toBe('');
  });
});
