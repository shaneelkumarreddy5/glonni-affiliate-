'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2 } from 'lucide-react';

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return <div className="pdp-gallery-missing"><ImageIcon/><b>Product image unavailable</b><span>The image will appear after verified media is added.</span></div>;

  const selectPrevious = () => setSelected((current) => (current - 1 + images.length) % images.length);
  const selectNext = () => setSelected((current) => (current + 1) % images.length);

  return <div className="pdp-gallery" aria-label="Product images">
    <div className="pdp-thumbs" role="group" aria-label="Choose product image">
      {images.map((url, index) => <button type="button" className={index === selected ? 'active' : ''} onClick={() => setSelected(index)} aria-label={`View image ${index + 1} of ${images.length}`} aria-pressed={index === selected} key={url}><img src={url} alt=""/></button>)}
    </div>
    <div className="pdp-main-image">
      <img src={images[selected]} alt={`${title}, image ${selected + 1}`}/>
      {images.length > 1 && <>
        <button type="button" className="pdp-gallery-arrow previous" onClick={selectPrevious} aria-label="Show previous product image"><ChevronLeft/></button>
        <button type="button" className="pdp-gallery-arrow next" onClick={selectNext} aria-label="Show next product image"><ChevronRight/></button>
      </>}
      <span className="pdp-image-count"><Maximize2/>Image {selected + 1} of {images.length}</span>
    </div>
  </div>;
}
