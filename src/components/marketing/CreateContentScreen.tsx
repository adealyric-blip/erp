'use client';

/**
 * Create Content — 4-step composer wizard.
 * Source: upload/marketing_extracted/Marketing/create content html.html.
 *
 * Steps: Content → Channels → Schedule → Review.
 * Each step has form fields. Final step publishes the post.
 */
import { useState } from 'react';
import { PageHeader, Modal } from './MarketingPrimitives';
import styles from './MarketingPrimitives.module.css';

interface CreateContentScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const CHANNELS = [
  { id: 'ig', name: 'Instagram', handle: '@unsaidmemories', logo: 'IG', color: '#a45a87' },
  { id: 'fb', name: 'Facebook', handle: 'Unsaid Memories', logo: 'FB', color: '#4b77b8' },
  { id: 'tt', name: 'TikTok', handle: '@unsaid', logo: 'TT', color: '#27353a' },
  { id: 'li', name: 'LinkedIn', handle: 'Unsaid Co.', logo: 'LI', color: '#4a7b9b' },
  { id: 'yt', name: 'YouTube', handle: 'Unsaid Channel', logo: 'YT', color: '#c45c5b' },
  { id: 'pin', name: 'Pinterest', handle: 'Unsaid Pins', logo: 'PIN', color: '#bd5558' },
];

export default function CreateContentScreen({ onToast, onNavigate }: CreateContentScreenProps) {
  const [step, setStep] = useState(1);
  const [postTitle, setPostTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [scheduleMode, setScheduleMode] = useState<'schedule' | 'now'>('schedule');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [approval, setApproval] = useState('none');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachType, setAttachType] = useState<'product' | 'collection' | 'design'>('product');
  const [attachedItem, setAttachedItem] = useState<string | null>(null);

  const steps = ['Content', 'Channels', 'Schedule', 'Review'];
  const canProceed = step === 1 ? postTitle.trim().length > 0 : step === 2 ? selectedChannels.size > 0 : true;

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePublish = () => {
    const channelNames = CHANNELS.filter((c) => selectedChannels.has(c.id)).map((c) => c.name).join(', ');
    onToast(`Post "${postTitle}" published to ${channelNames}.`);
    onNavigate?.('marketing', 'mkt-publishing-overview');
  };

  const handleSaveDraft = () => {
    onToast(`Draft "${postTitle || 'Untitled'}" saved.`);
    onNavigate?.('marketing', 'mkt-publishing-overview');
  };

  const handleAttach = (type: 'product' | 'collection' | 'design') => {
    setAttachType(type);
    setAttachModalOpen(true);
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing', 'Create']}
        title="Create content"
        subtitle="Build one post, tailor it to each channel, and choose when it goes live."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={handleSaveDraft}>Save draft</button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (step < 4) setStep(step + 1);
                else handlePublish();
              }}
              disabled={!canProceed}
            >
              {step < 4 ? 'Continue' : 'Publish'}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {step < 4 ? 'arrow_forward' : 'send'}
              </span>
            </button>
          </>
        }
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${isActive ? 'text-0a6400 font-semibold' : isDone ? 'text-0a6400' : 'text-8a938c'}`}>
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${
                    isActive || isDone
                      ? 'bg-0a6400 border-0a6400 text-white'
                      : 'bg-white border-dad9dd text-8a938c'
                  }`}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span className="text-xs">{label}</span>
              </div>
              {i < steps.length - 1 && <div className="h-px bg-dad9dd w-12" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <div className="xl:col-span-2 bg-white rounded-xl border border-dad9dd p-5">
          {/* Step 1: Content */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Build your post</h2>
                <p className="text-xs text-5a6355">Start with a message and add the media you want to share.</p>
              </div>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Internal post name</label>
                <input className={styles.editorInput} type="text" placeholder="e.g. October product spotlight" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
              </div>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Caption / post copy</label>
                <textarea className={styles.editorTextarea} placeholder="What would you like to share? Write your caption here..." value={caption} onChange={(e) => setCaption(e.target.value)} />
                <span className="text-[10px] text-5a6355 mt-1">{caption.length} characters · Platform limits may vary</span>
              </div>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Media attachments</label>
                <div
                  className="border-2 border-dashed border-becab6 bg-f4f3f7 rounded-xl p-6 text-center cursor-pointer hover:border-0a6400"
                  onClick={() => onToast('File picker would open.')}
                >
                  <span className="material-symbols-outlined text-0a6400" style={{ fontSize: 28 }}>cloud_upload</span>
                  <p className="text-sm font-semibold mt-2">Drop files here or browse</p>
                  <p className="text-xs text-5a6355">Images and video · Multiple files supported</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>Destination link (optional)</label>
                  <input className={styles.editorInput} type="text" placeholder="https://example.com" value={link} onChange={(e) => setLink(e.target.value)} />
                </div>
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>Hashtags</label>
                  <input className={styles.editorInput} type="text" placeholder="#brand #updates" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                </div>
              </div>
              <div className="border border-dad9dd rounded-lg p-3 bg-f4f3f7">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-sm font-semibold">Attach to product / design</span>
                    <p className="text-xs text-5a6355">Pick a product or open Design Studio to create one.</p>
                  </div>
                  {attachedItem && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-f4fbfa border border-d9eae8 text-0a6400 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                      {attachedItem}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className={styles.btnOutline} onClick={() => handleAttach('product')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>checkroom</span> Product
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => handleAttach('collection')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>collections_bookmark</span> Collection
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => handleAttach('design')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>palette</span> Design Studio
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Channels */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Choose your channels</h2>
                <p className="text-xs text-5a6355">Select the connected accounts where this post should publish.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CHANNELS.map((ch) => {
                  const selected = selectedChannels.has(ch.id);
                  return (
                    <div
                      key={ch.id}
                      className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                        selected ? 'border-0a6400 bg-f4fbfa' : 'border-dad9dd bg-white hover:border-becab6'
                      }`}
                      onClick={() => toggleChannel(ch.id)}
                    >
                      <input type="checkbox" checked={selected} onChange={() => toggleChannel(ch.id)} className="accent-0a6400" />
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: ch.color + '22', color: ch.color }}>
                        {ch.logo}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{ch.name}</p>
                        <p className="text-xs text-5a6355">{ch.handle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 bg-f4f3f7 rounded-lg text-[10px] text-5a6355 flex items-center gap-2">
                <span className="material-symbols-outlined text-0a6400" style={{ fontSize: 14 }}>info</span>
                Each selected channel becomes its own publish job. You can tailor the content for each provider before publishing.
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Choose when to publish</h2>
                <p className="text-xs text-5a6355">Publish now or set a date and time for each selected channel.</p>
              </div>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Publishing method</label>
                <div className="flex bg-f4f3f7 border border-dad9dd rounded-md p-0.5 gap-0.5 w-fit">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-semibold rounded ${scheduleMode === 'schedule' ? 'bg-0a6400 text-white' : 'text-5a6355'}`}
                    onClick={() => setScheduleMode('schedule')}
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-semibold rounded ${scheduleMode === 'now' ? 'bg-0a6400 text-white' : 'text-5a6355'}`}
                    onClick={() => setScheduleMode('now')}
                  >
                    Publish now
                  </button>
                </div>
              </div>
              {scheduleMode === 'schedule' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Date</label>
                    <input className={styles.editorInput} type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  </div>
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Time</label>
                    <input className={styles.editorInput} type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                </div>
              )}
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Time zone</label>
                <select className={styles.editorSelect} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="America/Chicago">Central Time (US &amp; Canada)</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Approval workflow</label>
                <select className={styles.editorSelect} value={approval} onChange={(e) => setApproval(e.target.value)}>
                  <option value="none">No approval required</option>
                  <option value="approval">Submit for approval before publishing</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Review and confirm</h2>
                <p className="text-xs text-5a6355">Check your content, destinations, and publishing details.</p>
              </div>
              <div className="bg-f4f3f7 border border-dad9dd rounded-lg p-4 text-sm leading-relaxed">
                <div className="mb-2"><strong>Post name:</strong> {postTitle || '(untitled)'}</div>
                <div className="mb-2"><strong>Caption:</strong> {caption || '(empty)'}</div>
                {link && <div className="mb-2"><strong>Link:</strong> {link}</div>}
                {hashtags && <div className="mb-2"><strong>Hashtags:</strong> {hashtags}</div>}
                {attachedItem && <div className="mb-2"><strong>Attached:</strong> {attachedItem}</div>}
                <div className="mb-2"><strong>Channels:</strong> {CHANNELS.filter((c) => selectedChannels.has(c.id)).map((c) => c.name).join(', ') || '(none selected)'}</div>
                <div className="mb-2"><strong>Schedule:</strong> {scheduleMode === 'now' ? 'Publish immediately' : `${scheduleDate || 'TBD'} at ${scheduleTime} ${timezone}`}</div>
                <div><strong>Approval:</strong> {approval === 'none' ? 'No approval required' : 'Submit for approval'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="bg-f4f3f7 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Preview</h3>
          <div className="bg-white border border-dad9dd rounded-xl overflow-hidden max-w-[370px] mx-auto">
            <div className="flex items-center gap-2 p-3">
              <div className="w-7 h-7 rounded-full bg-e6efed flex items-center justify-center text-0a6400 font-bold text-[10px]">U</div>
              <div>
                <p className="text-sm font-semibold">Unsaid</p>
                <p className="text-xs text-5a6355">@unsaidmemories</p>
              </div>
            </div>
            <div className="h-48 bg-gradient-to-br from-e9f1ef to-dce8e6 flex items-center justify-center">
              <span className="material-symbols-outlined text-5a6355" style={{ fontSize: 42, opacity: 0.4 }}>image</span>
            </div>
            <div className="p-3 text-xs leading-relaxed min-h-[65px] whitespace-pre-wrap">
              {caption || 'Your caption will appear here...'}
            </div>
            <div className="border-t border-f0f2f3 p-3 text-xs text-8a959b flex gap-4">
              <span>♡ Like</span>
              <span>💬 Comment</span>
              <span>↗ Share</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t border-dad9dd pt-4 mt-4">
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => {
            if (step > 1) setStep(step - 1);
            else onNavigate?.('marketing', 'mkt-publishing-overview');
          }}
          disabled={step === 1}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Back
        </button>
        <span className="text-xs text-5a6355">Step {step} of 4</span>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => {
            if (step < 4) setStep(step + 1);
            else handlePublish();
          }}
          disabled={!canProceed}
        >
          {step < 4 ? 'Continue' : 'Publish'}
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {step < 4 ? 'arrow_forward' : 'send'}
          </span>
        </button>
      </div>

      {/* Attach modal */}
      <Modal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        title={attachType === 'product' ? 'Attach a Product' : attachType === 'collection' ? 'Attach a Collection' : 'Open Design Studio'}
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setAttachModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                setAttachModalOpen(false);
                if (attachType === 'design') {
                  onNavigate?.('design', 'new-design');
                } else {
                  const label = attachType === 'product' ? 'Heavyweight Tee' : 'Holiday Collection';
                  setAttachedItem(label);
                  onToast(`${attachType === 'product' ? 'Product' : 'Collection'} attached: ${label}`);
                }
              }}
            >
              {attachType === 'design' ? 'Open Studio' : 'Attach'}
            </button>
          </>
        }
      >
        {attachType !== 'design' && (
          <div className={styles.editorField}>
            <label className={styles.editorLabel}>
              {attachType === 'product' ? 'Search products by name or SKU' : 'Search collections by name'}
            </label>
            <input className={styles.editorInput} type="text" placeholder={attachType === 'product' ? 'e.g. Heavyweight Tee' : 'e.g. Holiday Collection'} />
          </div>
        )}
        {attachType === 'design' && (
          <p className="text-sm text-5a6355">Opening Design Studio will save this post as a draft and navigate to the canvas. You can return to publishing after creating your design.</p>
        )}
      </Modal>
    </div>
  );
}
