'use client';

/**
 * Create Content — 4-step composer wizard.
 * Minimalist rebuild: local CSS module, real media upload (file input → chips),
 * working channel picker, schedule toggle, review summary, live preview.
 */
import { useRef, useState } from 'react';
import styles from './CreateContent.module.css';

interface CreateContentScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const CHANNELS = [
  { id: 'ig', name: 'Instagram', handle: '@unsaidmemories', logo: 'IG', color: '#c13584' },
  { id: 'fb', name: 'Facebook', handle: 'Unsaid Studio', logo: 'FB', color: '#1877f2' },
  { id: 'tt', name: 'TikTok', handle: '@unsaidstudio', logo: 'TT', color: '#010101' },
  { id: 'li', name: 'LinkedIn', handle: 'Unsaid Studio', logo: 'LI', color: '#0a66c2' },
  { id: 'yt', name: 'YouTube', handle: 'Unsaid Channel', logo: 'YT', color: '#ff0000' },
  { id: 'pin', name: 'Pinterest', handle: 'Unsaid Pins', logo: 'PIN', color: '#bd081c' },
];

const STEPS = ['Content', 'Channels', 'Schedule', 'Review'];

export default function CreateContentScreen({ onToast, onNavigate }: CreateContentScreenProps) {
  const [step, setStep] = useState(1);
  const [postTitle, setPostTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [media, setMedia] = useState<{ name: string; url: string }[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [scheduleMode, setScheduleMode] = useState<'schedule' | 'now'>('schedule');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [approval, setApproval] = useState('none');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachType, setAttachType] = useState<'product' | 'collection' | 'design'>('product');
  const [attachedItem, setAttachedItem] = useState<string | null>(null);
  const [attachSearch, setAttachSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const canProceed = step === 1 ? postTitle.trim().length > 0 : step === 2 ? selectedChannels.size > 0 : true;

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setMedia((prev) => [...prev, ...added]);
    onToast(`Added ${added.length} file${added.length === 1 ? '' : 's'}.`);
  };

  const removeMedia = (idx: number) => {
    setMedia((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
  };

  const next = () => {
    if (!canProceed) return;
    if (step < 4) setStep(step + 1);
    else handlePublish();
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
    else onNavigate?.('marketing', 'mkt-publishing-overview');
  };

  const handlePublish = () => {
    const ch = CHANNELS.filter((c) => selectedChannels.has(c.id)).map((c) => c.name).join(', ');
    onToast(`Published "${postTitle}" to ${ch}.`);
    onNavigate?.('marketing', 'mkt-queue');
  };

  const handleSaveDraft = () => {
    onToast(`Draft "${postTitle || 'Untitled'}" saved.`);
    onNavigate?.('marketing', 'mkt-queue');
  };

  const openAttach = (type: 'product' | 'collection' | 'design') => {
    setAttachType(type);
    setAttachSearch('');
    setAttachModalOpen(true);
  };

  const confirmAttach = () => {
    setAttachModalOpen(false);
    if (attachType === 'design') {
      onToast('Saving draft and opening Design Studio…');
      onNavigate?.('design', 'new-design');
      return;
    }
    const label = attachSearch.trim() || (attachType === 'product' ? 'Heavyweight Tee' : 'Holiday Collection');
    setAttachedItem(label);
    onToast(`${attachType === 'product' ? 'Product' : 'Collection'} attached: ${label}`);
  };

  const selectedChannelObjs = CHANNELS.filter((c) => selectedChannels.has(c.id));

  return (
    <div className={styles.screen}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Create content</h1>
          <p className={styles.toolbarSub}>Build one post, tailor it to each channel, and choose when it goes live.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleSaveDraft}>Save draft</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={next} disabled={!canProceed}>
            {step < 4 ? 'Continue' : 'Publish'}
            <span className="material-symbols-outlined">{step < 4 ? 'arrow_forward' : 'send'}</span>
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={label} className={styles.stepItem}>
              <div className={`${styles.stepItem} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}>
                <span className={styles.stepCircle}>{isDone ? '✓' : n}</span>
                <span className={styles.stepLabel}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${step > n ? styles.stepLineDone : ''}`} />}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.editorCard}>
          {step === 1 && (
            <>
              <div className={styles.editorHead}>
                <h2>Build your post</h2>
                <p>Start with a message and add the media you want to share.</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Internal post name</label>
                <input className={styles.input} type="text" placeholder="e.g. October product spotlight" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Caption / post copy</label>
                <textarea className={styles.textarea} placeholder="What would you like to share? Write your caption here…" value={caption} onChange={(e) => setCaption(e.target.value)} />
                <span className={styles.fieldHint}>{caption.length} characters · Platform limits may vary</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Media attachments</label>
                {media.length > 0 && (
                  <div className={styles.mediaList}>
                    {media.map((m, i) => (
                      <span key={i} className={styles.mediaChip}>
                        <span className="material-symbols-outlined">image</span>
                        {m.name.length > 24 ? m.name.slice(0, 22) + '…' : m.name}
                        <button type="button" className={styles.mediaChipRemove} onClick={() => removeMedia(i)} title="Remove"><span className="material-symbols-outlined">close</span></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.dropzone} onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--pri)' }}>cloud_upload</span>
                  <div className={styles.dropzoneTitle}>Drop files here or browse</div>
                  <div className={styles.dropzoneHint}>Images and video · Multiple files supported</div>
                </div>
              </div>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Destination link (optional)</label>
                  <input className={styles.input} type="text" placeholder="https://example.com" value={link} onChange={(e) => setLink(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Hashtags</label>
                  <input className={styles.input} type="text" placeholder="#brand #updates" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                </div>
              </div>
              <div className={styles.attachBox}>
                <div className={styles.attachHead}>
                  <div>
                    <div className={styles.attachTitle}>Attach to product / design</div>
                    <p className={styles.attachHint}>Pick a product or open Design Studio to create one.</p>
                  </div>
                  {attachedItem && (
                    <span className={styles.attachBadge}><span className="material-symbols-outlined">check</span>{attachedItem}</span>
                  )}
                </div>
                <div className={styles.attachBtns}>
                  <button type="button" className={styles.attachBtn} onClick={() => openAttach('product')}><span className="material-symbols-outlined">checkroom</span> Product</button>
                  <button type="button" className={styles.attachBtn} onClick={() => openAttach('collection')}><span className="material-symbols-outlined">collections_bookmark</span> Collection</button>
                  <button type="button" className={styles.attachBtn} onClick={() => openAttach('design')}><span className="material-symbols-outlined">palette</span> Design Studio</button>
                  {attachedItem && (
                    <button type="button" className={styles.attachBtn} onClick={() => setAttachedItem(null)}><span className="material-symbols-outlined">close</span> Remove</button>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.editorHead}>
                <h2>Choose your channels</h2>
                <p>Select the connected accounts where this post should publish.</p>
              </div>
              <div className={styles.channelGrid}>
                {CHANNELS.map((ch) => {
                  const sel = selectedChannels.has(ch.id);
                  return (
                    <div key={ch.id} className={`${styles.channelCard} ${sel ? styles.channelCardActive : ''}`} onClick={() => toggleChannel(ch.id)}>
                      <div className={styles.channelLogo} style={{ background: ch.color }}>{ch.logo}</div>
                      <div className={styles.channelMain}>
                        <div className={styles.channelName}>{ch.name}</div>
                        <div className={styles.channelHandle}>{ch.handle}</div>
                      </div>
                      <span className={styles.channelCheck}>{sel && <span className="material-symbols-outlined">check</span>}</span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.infoRow}>
                <span className="material-symbols-outlined">info</span>
                <span>Each selected channel becomes its own publish job. You can tailor the content for each provider before publishing.</span>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.editorHead}>
                <h2>Choose when to publish</h2>
                <p>Publish now or set a date and time for each selected channel.</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Publishing method</label>
                <div className={styles.toggleGroup}>
                  <button type="button" className={`${styles.toggleOpt} ${scheduleMode === 'schedule' ? styles.toggleOptActive : ''}`} onClick={() => setScheduleMode('schedule')}>Schedule</button>
                  <button type="button" className={`${styles.toggleOpt} ${scheduleMode === 'now' ? styles.toggleOptActive : ''}`} onClick={() => setScheduleMode('now')}>Publish now</button>
                </div>
              </div>
              {scheduleMode === 'schedule' && (
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Date</label>
                    <input className={styles.input} type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Time</label>
                    <input className={styles.input} type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Time zone</label>
                <select className={styles.select} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="America/Chicago">Central Time (US &amp; Canada)</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Approval workflow</label>
                <select className={styles.select} value={approval} onChange={(e) => setApproval(e.target.value)}>
                  <option value="none">No approval required</option>
                  <option value="approval">Submit for approval before publishing</option>
                </select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className={styles.editorHead}>
                <h2>Review and confirm</h2>
                <p>Check your content, destinations, and publishing details.</p>
              </div>
              <div className={styles.reviewCard}>
                <div className={styles.reviewRow}><span className={styles.reviewKey}>Post name</span><span className={styles.reviewVal}>{postTitle || '(untitled)'}</span></div>
                <div className={styles.reviewRow}><span className={styles.reviewKey}>Caption</span><span className={styles.reviewVal}>{caption || '(empty)'}</span></div>
                {link && <div className={styles.reviewRow}><span className={styles.reviewKey}>Link</span><span className={styles.reviewVal}>{link}</span></div>}
                {hashtags && <div className={styles.reviewRow}><span className={styles.reviewKey}>Hashtags</span><span className={styles.reviewVal}>{hashtags}</span></div>}
                {media.length > 0 && <div className={styles.reviewRow}><span className={styles.reviewKey}>Media</span><span className={styles.reviewVal}>{media.length} file{media.length === 1 ? '' : 's'}</span></div>}
                {attachedItem && <div className={styles.reviewRow}><span className={styles.reviewKey}>Attached</span><span className={styles.reviewVal}>{attachedItem}</span></div>}
                <div className={styles.reviewRow}><span className={styles.reviewKey}>Channels</span><span className={styles.reviewVal}>{selectedChannelObjs.map((c) => c.name).join(', ') || '(none)'}</span></div>
                <div className={styles.reviewRow}><span className={styles.reviewKey}>Schedule</span><span className={styles.reviewVal}>{scheduleMode === 'now' ? 'Publish immediately' : `${scheduleDate || 'TBD'} at ${scheduleTime} ${timezone}`}</span></div>
                <div className={styles.reviewRow}><span className={styles.reviewKey}>Approval</span><span className={styles.reviewVal}>{approval === 'none' ? 'No approval required' : 'Submit for approval'}</span></div>
              </div>
            </>
          )}
        </div>

        {/* Preview */}
        <div className={styles.previewCard}>
          <div className={styles.previewHead}>Live preview</div>
          <div className={styles.previewBody}>
            <div className={styles.previewPost}>
              <div className={styles.previewHeader}>
                <div className={styles.previewAvatar}>U</div>
                <div>
                  <div className={styles.previewName}>Unsaid</div>
                  <div className={styles.previewHandle}>{selectedChannelObjs[0]?.handle || '@unsaidmemories'}</div>
                </div>
              </div>
              <div className={`${styles.previewMedia} ${media[0] ? styles.previewMediaHas : ''}`} style={media[0] ? { backgroundImage: `url(${media[0].url})` } : undefined}>
                {!media[0] && <span className="material-symbols-outlined">image</span>}
              </div>
              <div className={styles.previewCaption}>{caption || 'Your caption will appear here…'}</div>
              <div className={styles.previewActions}>
                <span>♡ Like</span>
                <span>💬 Comment</span>
                <span>↗ Share</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={back} disabled={step === 1}>
          <span className="material-symbols-outlined">arrow_back</span> Back
        </button>
        <span className={styles.footerStep}>Step {step} of 4</span>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={next} disabled={!canProceed}>
          {step < 4 ? 'Continue' : 'Publish'}
          <span className="material-symbols-outlined">{step < 4 ? 'arrow_forward' : 'send'}</span>
        </button>
      </div>

      {/* Attach modal */}
      {attachModalOpen && (
        <div className={styles.modalScrim} onClick={() => setAttachModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>{attachType === 'product' ? 'Attach a product' : attachType === 'collection' ? 'Attach a collection' : 'Open Design Studio'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setAttachModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {attachType === 'design' ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--mut)', lineHeight: 1.5 }}>Opening Design Studio will save this post as a draft and navigate to the canvas. You can return to publishing after creating your design.</p>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label}>{attachType === 'product' ? 'Search products by name or SKU' : 'Search collections by name'}</label>
                  <input className={styles.input} type="text" placeholder={attachType === 'product' ? 'e.g. Heavyweight Tee' : 'e.g. Holiday Collection'} value={attachSearch} onChange={(e) => setAttachSearch(e.target.value)} autoFocus />
                </div>
              )}
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setAttachModalOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={confirmAttach}>
                {attachType === 'design' ? 'Open Studio' : 'Attach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
