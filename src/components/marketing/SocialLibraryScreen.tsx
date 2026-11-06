'use client';

/**
 * Content Library — media assets grid.
 * Source: publishing overview.html #page-library section.
 */
import { useState } from 'react';
import { PageHeader } from './MarketingPrimitives';
import styles from './MarketingPrimitives.module.css';

interface SocialLibraryScreenProps {
  onToast: (msg: string) => void;
}

const LIBRARY_ASSETS = [
  { name: 'holiday-tee-hero.jpg', type: 'Image', size: '248 KB', uploaded: 'Oct 28' },
  { name: 'mug-collection-carousel-1.jpg', type: 'Image', size: '312 KB', uploaded: 'Oct 25' },
  { name: 'brand-video-15s.mp4', type: 'Video', size: '4.2 MB', uploaded: 'Oct 20' },
  { name: 'crewneck-lifestyle.jpg', type: 'Image', size: '186 KB', uploaded: 'Oct 18' },
  { name: 'black-friday-teaser.mp4', type: 'Video', size: '8.1 MB', uploaded: 'Oct 15' },
  { name: 'retarget-dynamic-template.png', type: 'Image', size: '94 KB', uploaded: 'Oct 12' },
  { name: 'customer-spotlight-1.jpg', type: 'Image', size: '268 KB', uploaded: 'Oct 10' },
  { name: 'behind-the-scenes-bts.mp4', type: 'Video', size: '12.4 MB', uploaded: 'Oct 8' },
];

export default function SocialLibraryScreen({ onToast }: SocialLibraryScreenProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');

  const filtered = LIBRARY_ASSETS.filter((a) => {
    const searchMatch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    const typeMatch = typeFilter === 'All types' || a.type === (typeFilter === 'Images' ? 'Image' : 'Video');
    return searchMatch && typeMatch;
  });

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Content library"
        subtitle="Keep your approved images, videos, and reusable content organized."
        actions={
          <button type="button" className={styles.btnPrimary} onClick={() => onToast('File picker would open.')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
            Upload media
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-dad9dd overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-dad9dd">
          <div>
            <h2 className="text-base font-semibold">All assets</h2>
            <p className="text-xs text-5a6355">{filtered.length} files</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="h-7 px-2 border border-dad9dd rounded text-sm bg-faf9fc"
              type="text"
              placeholder="Search assets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="h-7 px-2 border border-dad9dd rounded text-sm bg-faf9fc"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>All types</option>
              <option>Images</option>
              <option>Videos</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-5a6355">
            No assets found. Upload images or videos to start your library.
          </div>
        ) : (
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((asset, i) => (
              <div
                key={i}
                className="border border-dad9dd rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onToast(`Previewing: ${asset.name}`)}
              >
                <div className="aspect-square bg-f4f3f7 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5a6355" style={{ fontSize: 36, opacity: 0.4 }}>
                    {asset.type === 'Image' ? 'image' : 'movie'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{asset.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-5a6355">{asset.size}</span>
                    <span className="text-xs text-5a6355">{asset.uploaded}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
