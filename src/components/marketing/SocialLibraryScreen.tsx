'use client';

/**
 * Content Library — media assets grid.
 * Minimalist rebuild: real upload (file input → adds assets), search,
 * type filter, asset click → preview modal with Use/Delete actions.
 */
import { useRef, useState } from 'react';
import styles from './SocialLibrary.module.css';

interface SocialLibraryScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

interface Asset {
  id: string;
  name: string;
  type: 'Image' | 'Video';
  size: string;
  uploaded: string;
  url?: string;
}

const INITIAL_ASSETS: Asset[] = [
  { id: 'a1', name: 'holiday-tee-hero.jpg', type: 'Image', size: '248 KB', uploaded: 'Oct 28' },
  { id: 'a2', name: 'mug-collection-carousel-1.jpg', type: 'Image', size: '312 KB', uploaded: 'Oct 25' },
  { id: 'a3', name: 'brand-video-15s.mp4', type: 'Video', size: '4.2 MB', uploaded: 'Oct 20' },
  { id: 'a4', name: 'crewneck-lifestyle.jpg', type: 'Image', size: '186 KB', uploaded: 'Oct 18' },
  { id: 'a5', name: 'black-friday-teaser.mp4', type: 'Video', size: '8.1 MB', uploaded: 'Oct 15' },
  { id: 'a6', name: 'retarget-dynamic-template.png', type: 'Image', size: '94 KB', uploaded: 'Oct 12' },
  { id: 'a7', name: 'customer-spotlight-1.jpg', type: 'Image', size: '268 KB', uploaded: 'Oct 10' },
  { id: 'a8', name: 'behind-the-scenes-bts.mp4', type: 'Video', size: '12.4 MB', uploaded: 'Oct 8' },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SocialLibraryScreen({ onToast, onNavigate }: SocialLibraryScreenProps) {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter((a) => {
    const s = search.trim().toLowerCase();
    const searchMatch = !s || a.name.toLowerCase().includes(s);
    const typeMatch = typeFilter === 'All types' || (typeFilter === 'Images' ? a.type === 'Image' : a.type === 'Video');
    return searchMatch && typeMatch;
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: Asset[] = Array.from(files).map((f) => ({
      id: `a${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      type: f.type.startsWith('video/') ? 'Video' : 'Image',
      size: formatBytes(f.size),
      uploaded: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      url: URL.createObjectURL(f),
    }));
    setAssets((prev) => [...added, ...prev]);
    onToast(`Uploaded ${added.length} asset${added.length === 1 ? '' : 's'}.`);
  };

  const handleDelete = (asset: Asset) => {
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    setPreviewAsset(null);
    if (asset.url) URL.revokeObjectURL(asset.url);
    onToast(`Deleted "${asset.name}".`);
  };

  const imageCount = assets.filter((a) => a.type === 'Image').length;
  const videoCount = assets.filter((a) => a.type === 'Video').length;

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Content library</h1>
          <p className={styles.toolbarSub}>{assets.length} assets · {imageCount} images · {videoCount} videos</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => fileRef.current?.click()}>
            <span className="material-symbols-outlined">upload</span> Upload media
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.gridHead}>
          <h2 className={styles.gridTitle}>All assets</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, maxWidth: 420, marginLeft: 'auto' }}>
            <input className={styles.search} type="text" placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option>All types</option>
              <option>Images</option>
              <option>Videos</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className="material-symbols-outlined">perm_media</span>
            <h3>No assets found</h3>
            <p>Adjust your filters or upload new media.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((asset) => (
              <div key={asset.id} className={styles.asset} onClick={() => setPreviewAsset(asset)}>
                <div className={styles.thumb} style={asset.url ? { backgroundImage: `url(${asset.url})` } : undefined}>
                  {!asset.url && <span className="material-symbols-outlined">{asset.type === 'Image' ? 'image' : 'movie'}</span>}
                  <span className={`${styles.thumbBadge} ${asset.type === 'Video' ? styles.thumbBadgeVideo : ''}`}>{asset.type}</span>
                </div>
                <div className={styles.assetMeta}>
                  <span className={styles.assetName}>{asset.name}</span>
                  <div className={styles.assetInfo}>
                    <span>{asset.size}</span>
                    <span>{asset.uploaded}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewAsset && (
        <div className={styles.modalScrim} onClick={() => setPreviewAsset(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>{previewAsset.name}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setPreviewAsset(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.previewThumb} style={previewAsset.url ? { backgroundImage: `url(${previewAsset.url})` } : undefined}>
                {!previewAsset.url && <span className="material-symbols-outlined">{previewAsset.type === 'Image' ? 'image' : 'movie'}</span>}
              </div>
              <div>
                <div className={styles.field}><span className={styles.fieldLabel}>Type</span><span className={styles.fieldValue}><span className={`${styles.pill} ${styles.pillGray}`}>{previewAsset.type}</span></span></div>
                <div className={styles.field}><span className={styles.fieldLabel}>File size</span><span className={styles.fieldValue}>{previewAsset.size}</span></div>
                <div className={styles.field}><span className={styles.fieldLabel}>Uploaded</span><span className={styles.fieldValue}>{previewAsset.uploaded}</span></div>
                <div className={styles.field}><span className={styles.fieldLabel}>Asset ID</span><span className={styles.fieldValue}>{previewAsset.id}</span></div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(previewAsset)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPreviewAsset(null); onNavigate?.('marketing', 'mkt-create-content'); }}><span className="material-symbols-outlined">add_photo_alternate</span> Use in post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
