'use client';

import { useState } from 'react';
import { ImageIcon, Maximize2 } from 'lucide-react';

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return <div className="pdp-gallery-missing"><ImageIcon/><b>Product image unavailable</b><span>The image will appear after verified media is added.</span></div>;
  return <div className="pdp-gallery">
    <div className="pdp-thumbs">{images.map((url, index) => <button type="button" className={index === selected ? 'active' : ''} onClick={() => setSelected(index)} aria-label={`View image ${index + 1} of ${images.length}`} key={url}><img src={url} alt=""/></button>)}</div>
    <div className="pdp-main-image"><img src={images[selected]} alt={`${title}, image ${selected + 1}`}/><span><Maximize2/>Image {selected + 1} of {images.length}</span></div>
  </div>;
}
