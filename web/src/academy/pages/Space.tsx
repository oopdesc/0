import { useEffect } from 'react';
/** Compatibility for bookmarks to the retired linked-particle exhibit. */
export default function SpacePage() {
  useEffect(()=>{window.location.replace('/?view=nebula');},[]);
  return <p><a href="/?view=nebula">星雲の作品を開く →</a></p>;
}
