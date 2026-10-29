import { useEffect } from 'react';
/** Compatibility for bookmarks to the retired linked-particle exhibit. */
export default function SpacePage() {
  useEffect(()=>{window.location.replace('/art?exhibit=nebula');},[]);
  return <p><a href="/art?exhibit=nebula">星雲の作品を開く →</a></p>;
}
