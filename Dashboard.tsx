import { useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../state/useAuth';
import { showToast } from '../utils/toast';

type User = {
  id: number;
  full_name: string;
  email: string;
};

type Department = {
  id: number;
  name: string;
};

type Attachment = {
  id: number;
  file_url: string;
  file_name: string;
  file_type: string;
  created_at: string;
};

type ShoutOut = {
  id: number;
  content: string;
  created_at: string;
  created_by: User;
  recipients: User[];
  department_id?: number;
  reactions: { id: number; type: string; user: User }[];
  comments: { id: number; content: string; created_at: string; user: User; parent_id?: number | null }[];
  attachments?: Attachment[];
};

const REACTION_TYPES = [
  { type: 'like', icon: '👍' },
  { type: 'clap', icon: '👏' },
  { type: 'star', icon: '⭐' },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  // Format: "Jan 15, 2024 at 3:45 PM"
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function Feed() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recipients, setRecipients] = useState<number[]>([]);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [shoutouts, setShoutouts] = useState<ShoutOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentValues, setCommentValues] = useState<Record<number, string>>({});
  const [commenting, setCommenting] = useState<Record<number, boolean>>({});
  const [filterMine, setFilterMine] = useState(false);
  const [filterMyCreated, setFilterMyCreated] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<number | ''>('');
  const [filterSender, setFilterSender] = useState<number | ''>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [myShoutouts, setMyShoutouts] = useState<ShoutOut[]>([]);
  const [loadingMyShoutouts, setLoadingMyShoutouts] = useState(false);
  const [mentionOpen, setMentionOpen] = useState<Record<number, boolean>>({});
  const [mentionQuery, setMentionQuery] = useState<Record<number, string>>({});
  const [mentionIndex, setMentionIndex] = useState<Record<number, number>>({});
  const [replyOpenFor, setReplyOpenFor] = useState<Record<number, boolean>>({});
  const [replyValues, setReplyValues] = useState<Record<number, string>>({});
  const [replyPosting, setReplyPosting] = useState<Record<number, boolean>>({});
  const [replyMentionOpen, setReplyMentionOpen] = useState<Record<number, boolean>>({});
  const [replyMentionQuery, setReplyMentionQuery] = useState<Record<number, string>>({});
  const [replyMentionIndex, setReplyMentionIndex] = useState<Record<number, number>>({});
  const [emojiOpenFor, setEmojiOpenFor] = useState<Record<number, boolean>>({});
  const [actionMenuOpen, setActionMenuOpen] = useState<Record<number, boolean>>({});
  const [commentsExpanded, setCommentsExpanded] = useState<Record<number, boolean>>({});
  const [deletingShoutouts, setDeletingShoutouts] = useState<Record<number, boolean>>({});
  const [deletingComments, setDeletingComments] = useState<Record<number, boolean>>({});
  const [reportingShoutouts, setReportingShoutouts] = useState<Record<number, boolean>>({});
  const [reportedShoutouts, setReportedShoutouts] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'shoutout' | 'comment'; id: number } | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [reportModal, setReportModal] = useState<{ shoutoutId: number; reason: string } | null>(null);
  const [reportModalSubmitting, setReportModalSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<number, boolean>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [contentTouched, setContentTouched] = useState(false);

  useEffect(() => {
    api.get('/users/lookup').then(r => setUsers(r.data)).catch(() => { });
    // Load all departments so users can filter by any department
    api.get('/departments/public').then(r => setDepartments(r.data)).catch(() => { });
  }, []);

  const loadFeed = useCallback(() => {
    setLoading(true);
    let url = '/shoutouts?';
    if (filterMine && user) url += `recipient=${user.id}&`;
    if (filterDepartment) url += `department=${filterDepartment}&`;
    if (filterSender) url += `sender=${filterSender}&`;
    if (filterStartDate) url += `start_date=${filterStartDate}T00:00:00&`;
    api.get(url).then(r => setShoutouts(r.data)).finally(() => setLoading(false));
  }, [filterMine, filterDepartment, filterSender, filterStartDate, user?.id]);

  const loadMyShoutouts = useCallback(() => {
    if (!user) return;
    setLoadingMyShoutouts(true);
    api.get(`/shoutouts?sender=${user.id}`)
      .then(r => setMyShoutouts(r.data))
      .finally(() => setLoadingMyShoutouts(false));
  }, [user?.id]);

  useEffect(() => {
    if (filterMyCreated) {
      loadMyShoutouts();
    }
  }, [filterMyCreated, loadMyShoutouts]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setContentTouched(true);
    if (!content.trim()) {
      showToast('Please enter shout-out content', 'error');
      return;
    }
    if (recipients.length === 0) {
      showToast('Please select at least one recipient', 'error');
      return;
    }
    setPosting(true);
    try {
      const response = await api.post('/shoutouts', { content, recipient_ids: recipients });
      const shoutoutId = response.data.id;

      // Upload images if any
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post(`/shoutouts/${shoutoutId}/upload-image`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (imgError: any) {
            const errorMsg = imgError?.response?.data?.detail || 'Failed to upload image';
            showToast(errorMsg, 'error');
          }
        }
      }

      setContent('');
      setRecipients([]);
      setImageFiles([]);
      showToast('Shout-out posted successfully!', 'success');
      loadFeed();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to post shout-out';
      showToast(errorMsg, 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (shoutoutId: number, type: string) => {
    try {
      await api.post(`/shoutouts/${shoutoutId}/react`, { type });
      loadFeed();
    } catch (e: any) {
      loadFeed();
    }
  };

  const handleDeleteShoutout = async (shoutoutId: number) => {
    setDeletingShoutouts(prev => ({ ...prev, [shoutoutId]: true }));
    try {
      await api.delete(`/shoutouts/${shoutoutId}`);
      showToast('Shout-out deleted successfully', 'success');
      loadFeed();
      loadMyShoutouts();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to delete shout-out';
      showToast(errorMsg, 'error');
    } finally {
      setDeletingShoutouts(prev => ({ ...prev, [shoutoutId]: false }));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    setDeletingComments(prev => ({ ...prev, [commentId]: true }));
    try {
      await api.delete(`/shoutouts/comments/${commentId}`);
      showToast('Comment deleted successfully', 'success');
      loadFeed();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to delete comment';
      showToast(errorMsg, 'error');
    } finally {
      setDeletingComments(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleReportShoutout = async (shoutoutId: number, reason?: string) => {
    const payload = (reason?.trim() || undefined);
    setReportingShoutouts(prev => ({ ...prev, [shoutoutId]: true }));
    try {
      await api.post(`/shoutouts/${shoutoutId}/report`, { reason: payload });
      setReportedShoutouts(prev => ({ ...prev, [shoutoutId]: true }));
      setFeedback({ type: 'success', message: 'Thank you. Your report has been submitted.' });
    } catch (error: any) {
      if (error?.response?.status === 400) {
        const detail = error.response?.data?.detail || 'You have already reported this shout-out.';
        setReportedShoutouts(prev => ({ ...prev, [shoutoutId]: true }));
        setFeedback({ type: 'error', message: detail });
      } else {
        const errorMsg = error?.response?.data?.detail || 'Failed to report the shout-out. Please try again.';
        setFeedback({ type: 'error', message: errorMsg });
        showToast(errorMsg, 'error');
      }
    } finally {
      setReportingShoutouts(prev => ({ ...prev, [shoutoutId]: false }));
    }
  };

  const handleComment = async (shoutoutId: number) => {
    const commentText = commentValues[shoutoutId] || '';
    if (!commentText.trim()) return;
    setCommenting({ ...commenting, [shoutoutId]: true });
    try {
      await api.post(`/shoutouts/${shoutoutId}/comment`, { content: commentText });
      setCommentValues({ ...commentValues, [shoutoutId]: '' });
      setMentionOpen({ ...mentionOpen, [shoutoutId]: false });
      setMentionQuery({ ...mentionQuery, [shoutoutId]: '' });
      setMentionIndex({ ...mentionIndex, [shoutoutId]: 0 });
      setCommentsExpanded({ ...commentsExpanded, [shoutoutId]: true });
      showToast('Comment posted successfully', 'success');
      loadFeed();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to post comment';
      showToast(errorMsg, 'error');
    } finally {
      setCommenting({ ...commenting, [shoutoutId]: false });
    }
  };

  const confirmDeletion = async () => {
    if (!confirmModal) return;
    setConfirmingAction(true);
    try {
      if (confirmModal.type === 'shoutout') {
        await handleDeleteShoutout(confirmModal.id);
      } else {
        await handleDeleteComment(confirmModal.id);
      }
      setConfirmModal(null);
    } finally {
      setConfirmingAction(false);
    }
  };

  const submitReportModal = async () => {
    if (!reportModal) return;
    setReportModalSubmitting(true);
    try {
      await handleReportShoutout(reportModal.shoutoutId, reportModal.reason);
      setReportModal(null);
    } finally {
      setReportModalSubmitting(false);
    }
  };

  const getMentionCandidates = useCallback((q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(u =>
      u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)
    );
  }, [users]);

  function detectMention(text: string): { active: boolean; query: string; start: number; end: number } {
    // Find the last '@' word fragment
    const caretEnd = text.length;
    // Match last occurrence of @word (allow spaces in names while typing by taking till end or punctuation)
    const match = /(^|\s)@([^@\n]*)$/.exec(text);
    if (!match) return { active: false, query: '', start: -1, end: -1 };
    const query = match[2];
    const start = caretEnd - query.length - 1; // position of '@'
    return { active: true, query, start, end: caretEnd };
  }

  function insertMention(shoutoutId: number, fullName: string) {
    const value = commentValues[shoutoutId] || '';
    const det = detectMention(value);
    if (!det.active || det.start < 0) return;
    const before = value.slice(0, det.start);
    const after = value.slice(det.end);
    const newVal = `${before}@${fullName} ${after}`;
    setCommentValues({ ...commentValues, [shoutoutId]: newVal });
    setMentionOpen({ ...mentionOpen, [shoutoutId]: false });
    setMentionQuery({ ...mentionQuery, [shoutoutId]: '' });
    setMentionIndex({ ...mentionIndex, [shoutoutId]: 0 });
  }

  function insertReplyMention(commentId: number, fullName: string) {
    const value = replyValues[commentId] || '';
    const det = detectMention(value);
    if (!det.active || det.start < 0) return;
    const before = value.slice(0, det.start);
    const after = value.slice(det.end);
    const newVal = `${before}@${fullName} ${after}`;
    setReplyValues({ ...replyValues, [commentId]: newVal });
    setReplyMentionOpen({ ...replyMentionOpen, [commentId]: false });
    setReplyMentionQuery({ ...replyMentionQuery, [commentId]: '' });
    setReplyMentionIndex({ ...replyMentionIndex, [commentId]: 0 });
  }

  function addEmojiToReply(commentId: number, emoji: string) {
    const current = replyValues[commentId] || '';
    const next = current ? `${current}${emoji}` : emoji;
    setReplyValues({ ...replyValues, [commentId]: next });
  }

  const buildCommentTree = useCallback((list: ShoutOut['comments']) => {
    const byParent: Record<string, ShoutOut['comments']> = {} as any;
    const roots: ShoutOut['comments'] = [] as any;
    list.forEach(c => {
      const pid = c.parent_id ?? null;
      const key = String(pid);
      (byParent[key] ||= [] as any).push(c);
    });
    function attach(node: any): any {
      const children = byParent[String(node.id)] || [];
      return { ...node, children: children.map(attach) };
    }
    (byParent['null'] || []).forEach((root: any) => roots.push(attach(root)));
    return roots;
  }, []);

  const renderWithMentions = useCallback((text: string) => {
    if (!text) return null;
    const allNames = users.map(u => u.full_name).filter(Boolean);
    if (allNames.length === 0) return <span>{text}</span>;
    const escapedNames = allNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const mentionRegex = new RegExp(`@(${escapedNames.join('|')})(?=[\\s,.;:!?)}]|$)`, 'g');
    const nodes: JSX.Element[] = [];
    let lastIndex = 0;

    text.replace(mentionRegex, (match, _name, offset: number) => {
      if (lastIndex < offset) {
        nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, offset)}</span>);
      }
      nodes.push(
        <span key={`mention-${offset}`} className="text-blue-600 font-semibold">
          {match}
        </span>
      );
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    if (nodes.length === 0) {
      return <span>{text}</span>;
    }

    return nodes;
  }, [users]);

  const reportReasonInvalid = !!reportModal && reportModal.reason.trim().length < 5;

  return (
    <div className="py-4 sm:py-6 lg:py-8">
      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: Shout-Out Form */}
        <div className="lg:w-1/3 lg:flex-none">
          <div className="sticky top-8">
            <form
              className="card p-6 flex flex-col gap-5"
              onSubmit={handlePost}
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                    👋
                  </div>
                  <h2 className="font-bold text-xl text-slate-800">Send a Shout-Out!</h2>
                </div>

                <div className="relative">
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={4}
                    className={`input w-full resize-none p-4 text-base min-h-[120px] ${contentTouched && !content.trim() ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''
                      }`}
                    placeholder="Who did something awesome today?"
                  />
                  {contentTouched && !content.trim() && (
                    <p className="absolute -bottom-5 left-0 text-xs text-red-500 font-medium">Shout-out content is required</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="label">Add images</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-center w-full h-24 px-4 transition bg-white border-2 border-slate-200 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-400 hover:bg-blue-50 focus:outline-none">
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <span className="font-medium text-slate-500 text-sm">
                        Drop files or click to upload
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles = files.filter(file => {
                          if (!file.type.startsWith('image/')) {
                            showToast(`${file.name} is not an image file`, 'error');
                            return false;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            showToast(`${file.name} exceeds 10MB limit`, 'error');
                            return false;
                          }
                          return true;
                        });
                        setImageFiles(prev => [...prev, ...validFiles].slice(0, 5));
                      }}
                      className="hidden"
                      disabled={posting}
                    />
                  </label>

                  {imageFiles.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {imageFiles.map((file, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600 transition-colors"
                            disabled={posting}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400">Max 5 images, 10MB each.</p>
                </div>
              </div>

              <div>
                <label className="label">Tag teammates</label>
                <div className="relative">
                  <select
                    multiple
                    className={`input w-full min-h-[100px] p-2 ${recipients.length === 0 ? 'border-slate-200' : 'border-blue-300 ring-1 ring-blue-100'
                      }`}
                    value={recipients.map(String)}
                    onChange={e =>
                      setRecipients(Array.from(e.target.selectedOptions).map(opt => Number(opt.value)))
                    }
                    disabled={posting}
                  >
                    {users.filter(u => u.id !== user?.id).map(u => (
                      <option key={u.id} value={u.id} className="py-1 px-2 rounded hover:bg-blue-50 cursor-pointer">
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
                {recipients.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    Select at least one person to shout-out
                  </p>
                )}
              </div>

              <button
                disabled={posting || !content.trim() || recipients.length === 0}
                className="btn-primary w-full py-3 text-base font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2"
              >
                {posting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Posting...
                  </span>
                ) : 'Send Shout-Out 🚀'}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Shout-Out Feed */}
        <div className="lg:flex-1 flex flex-col gap-6">
          {/* My Shoutouts Section */}
          {filterMyCreated && (
            <div className="card p-6 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📝</span> My Shoutouts
                </h2>
                <button
                  type="button"
                  onClick={() => setFilterMyCreated(false)}
                  className="text-sm text-slate-500 hover:text-slate-800 font-medium px-3 py-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  Hide
                </button>
              </div>
              {loadingMyShoutouts ? (
                <div className="text-center py-12 text-slate-400">Loading your shoutouts...</div>
              ) : myShoutouts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  You haven't created any shoutouts yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {myShoutouts.map(so => (
                    <div key={so.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {so.created_by.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{so.created_by.full_name}</span>
                            <span className="text-xs text-slate-500 font-medium" title={new Date(so.created_at).toISOString()}>
                              {formatDateTime(so.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-700 mb-4 leading-relaxed">{so.content}</div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 border-t border-slate-100 pt-3">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">To:</span>
                          <span className="font-medium text-slate-700">{so.recipients.map(r => r.full_name).join(', ')}</span>
                        </span>
                        <span className="ml-auto flex gap-3">
                          <span>👍 {so.reactions.filter(r => r.type === 'like').length}</span>
                          <span>💬 {so.comments.length}</span>
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ type: 'shoutout', id: so.id })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMyCreated(false);
                            setTimeout(() => {
                              document.getElementById(`shoutout-${so.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          View in feed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-6">
            {/* Feed Header & Filters */}
            <div className="card p-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h2 className="font-bold text-2xl text-slate-800 flex items-center gap-2">
                  <span className="text-3xl">💬</span> Shout-Out Feed
                </h2>
                <div className="flex gap-3 items-center bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <label className={`cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterMyCreated ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <input
                      type="checkbox"
                      checked={filterMyCreated}
                      onChange={e => {
                        setFilterMyCreated(e.target.checked);
                        if (e.target.checked) setFilterMine(false);
                      }}
                      className="hidden"
                    />
                    My Shoutouts
                  </label>
                  <label className={`cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filterMine ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <input
                      type="checkbox"
                      checked={filterMine}
                      onChange={e => {
                        setFilterMine(e.target.checked);
                        if (e.target.checked) setFilterMyCreated(false);
                      }}
                      className="hidden"
                    />
                    Mentions Only
                  </label>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label text-xs uppercase tracking-wide text-slate-500 mb-1.5">Department</label>
                  <select
                    value={filterDepartment}
                    onChange={e => setFilterDepartment(e.target.value ? Number(e.target.value) : '')}
                    className="input py-2 text-sm"
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs uppercase tracking-wide text-slate-500 mb-1.5">Sender</label>
                  <select
                    value={filterSender}
                    onChange={e => setFilterSender(e.target.value ? Number(e.target.value) : '')}
                    className="input py-2 text-sm"
                  >
                    <option value="">All Senders</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs uppercase tracking-wide text-slate-500 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="input py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {feedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 shadow-sm ${feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-600'
                  }`}
              >
                <span className="text-lg">{feedback.type === 'success' ? '✅' : '⚠️'}</span>
                {feedback.message}
              </div>
            )}

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                <p className="mt-2 text-slate-400 font-medium">Loading feed...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {shoutouts.length === 0 && (
                  <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-slate-500 font-medium">No shout-outs found.</p>
                    <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or be the first to post!</p>
                  </div>
                )}
                {shoutouts.map(so => (
                  <div
                    key={so.id}
                    id={`shoutout-${so.id}`}
                    className="card p-6 transition-all hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-3">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                              {so.created_by.full_name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 block">{so.created_by.full_name}</span>
                              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                {formatDateTime(so.created_at)}
                              </span>
                            </div>
                          </div>

                          {user && so.recipients.some(r => r.id === user.id) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold shadow-sm border border-amber-200">
                              🔔 You were tagged
                            </span>
                          )}
                        </div>

                        {so.recipients.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                            {so.recipients.map(r => (
                              <span
                                key={r.id}
                                className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200"
                              >
                                @{r.full_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-end">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActionMenuOpen(prev => ({ ...prev, [so.id]: !prev[so.id] }))
                            }
                            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {actionMenuOpen[so.id] && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                              <div className="py-1">
                                {(user?.is_admin || so.created_by.id === user?.id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuOpen(prev => ({ ...prev, [so.id]: false }));
                                      setConfirmModal({ type: 'shoutout', id: so.id });
                                    }}
                                    disabled={!!deletingShoutouts[so.id]}
                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                  >
                                    <span>🗑️</span> {deletingShoutouts[so.id] ? 'Deleting...' : 'Delete Shout-out'}
                                  </button>
                                )}
                                {user && user.id !== so.created_by.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuOpen(prev => ({ ...prev, [so.id]: false }));
                                      setReportModal({ shoutoutId: so.id, reason: '' });
                                    }}
                                    disabled={!!reportingShoutouts[so.id] || reportedShoutouts[so.id]}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <span>🚩</span>
                                    {reportingShoutouts[so.id]
                                      ? 'Reporting...'
                                      : reportedShoutouts[so.id]
                                        ? 'Reported'
                                        : 'Report Content'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMenuOpen(prev => ({ ...prev, [so.id]: false }))
                                  }
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pl-[52px]">
                      <div className="text-slate-800 text-lg leading-relaxed whitespace-pre-wrap">{so.content}</div>

                      {so.attachments && so.attachments.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {so.attachments.map(att => (
                            <div key={att.id} className="relative group">
                              {att.file_type && att.file_type.startsWith('image/') ? (
                                <a
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block overflow-hidden rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                                >
                                  <img
                                    src={att.file_url}
                                    alt={att.file_name || 'Image attachment'}
                                    className="max-w-xs max-h-64 object-cover hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </a>
                              ) : (
                                <a
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                                >
                                  <span className="text-xl">📎</span>
                                  <span className="text-sm font-medium text-slate-700">{att.file_name || 'Attachment'}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex gap-2">
                          {REACTION_TYPES.map(({ type, icon }) => {
                            const reactors = so.reactions
                              .filter(r => r.type === type)
                              .map(r => r.user.full_name);
                            const count = reactors.length;
                            const reacted = !!so.reactions.find(r => r.type === type && r.user.id === user?.id);
                            return (
                              <div key={type} className="relative group">
                                <button
                                  type="button"
                                  onClick={() => handleReact(so.id, type)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all transform active:scale-95 ${reacted
                                    ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                                    }`}
                                >
                                  <span className="text-lg leading-none">{icon}</span>
                                  {count > 0 && <span>{count}</span>}
                                </button>
                                {count > 0 && (
                                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-30 p-2">
                                    <div className="font-semibold mb-1 border-b border-slate-700 pb-1">
                                      {count} {count === 1 ? 'reaction' : 'reactions'}
                                    </div>
                                    <ul className="max-h-32 overflow-y-auto custom-scrollbar">
                                      {reactors.map(name => (
                                        <li key={name} className="py-0.5">{name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCommentsExpanded({ ...commentsExpanded, [so.id]: !commentsExpanded[so.id] })}
                          className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                        >
                          <span>💬</span>
                          {so.comments.length > 0 ? `${so.comments.length} Comments` : 'Comment'}
                        </button>
                      </div>

                      {commentsExpanded[so.id] && (
                        <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex flex-col gap-4">
                            {buildCommentTree(so.comments).map((c: any) => (
                              <div key={c.id} className="group">
                                <div className="flex gap-3">
                                  <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                                    {c.user.full_name.charAt(0)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm border border-slate-200 inline-block max-w-full">
                                      <div className="flex items-baseline justify-between gap-4 mb-1">
                                        <span className="font-bold text-sm text-slate-800">{c.user.full_name}</span>
                                        <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
                                      </div>
                                      <div className="text-sm text-slate-700 whitespace-pre-wrap">{renderWithMentions(c.content)}</div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1 ml-2 text-xs font-medium text-slate-500">
                                      <button
                                        type="button"
                                        onClick={() => setReplyOpenFor({ ...replyOpenFor, [c.id]: !replyOpenFor[c.id] })}
                                        className="hover:text-blue-600 transition-colors"
                                      >
                                        Reply
                                      </button>
                                      {(user?.is_admin || c.user.id === user?.id) && (
                                        <button
                                          type="button"
                                          onClick={() => setConfirmModal({ type: 'comment', id: c.id })}
                                          className="hover:text-red-600 transition-colors disabled:opacity-50"
                                          disabled={!!deletingComments[c.id]}
                                        >
                                          {deletingComments[c.id] ? 'Deleting...' : 'Delete'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {replyOpenFor[c.id] && (
                                  <div className="ml-11 mt-3">
                                    <form
                                      onSubmit={e => {
                                        e.preventDefault();
                                        const val = replyValues[c.id] || '';
                                        if (!val.trim()) return;
                                        setReplyPosting({ ...replyPosting, [c.id]: true });
                                        api.post(`/shoutouts/${so.id}/comment`, { content: val, parent_id: c.id })
                                          .then(() => {
                                            setReplyValues({ ...replyValues, [c.id]: '' });
                                            setReplyOpenFor({ ...replyOpenFor, [c.id]: false });
                                            setReplyMentionOpen({ ...replyMentionOpen, [c.id]: false });
                                            setReplyMentionQuery({ ...replyMentionQuery, [c.id]: '' });
                                            setReplyMentionIndex({ ...replyMentionIndex, [c.id]: 0 });
                                            setEmojiOpenFor({ ...emojiOpenFor, [c.id]: false });
                                            loadFeed();
                                          })
                                          .finally(() => setReplyPosting({ ...replyPosting, [c.id]: false }));
                                      }}
                                      className="flex gap-2 items-start"
                                    >
                                      <div className="relative flex-1">
                                        <input
                                          type="text"
                                          className="input py-2 text-sm"
                                          placeholder={`Reply to ${c.user.full_name}...`}
                                          value={replyValues[c.id] || ''}
                                          onChange={e => {
                                            const val = e.target.value;
                                            setReplyValues({ ...replyValues, [c.id]: val });
                                            const det = detectMention(val);
                                            if (det.active) {
                                              setReplyMentionOpen({ ...replyMentionOpen, [c.id]: true });
                                              setReplyMentionQuery({ ...replyMentionQuery, [c.id]: det.query });
                                            } else {
                                              setReplyMentionOpen({ ...replyMentionOpen, [c.id]: false });
                                              setReplyMentionQuery({ ...replyMentionQuery, [c.id]: '' });
                                            }
                                          }}
                                          onKeyDown={e => {
                                            if (!replyMentionOpen[c.id]) return;
                                            const list = getMentionCandidates(replyMentionQuery[c.id] || '');
                                            const current = replyMentionIndex[c.id] || 0;
                                            if (e.key === 'ArrowDown') {
                                              e.preventDefault();
                                              const next = (current + 1) % Math.max(list.length, 1);
                                              setReplyMentionIndex({ ...replyMentionIndex, [c.id]: next });
                                            } else if (e.key === 'ArrowUp') {
                                              e.preventDefault();
                                              const next = (current - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1);
                                              setReplyMentionIndex({ ...replyMentionIndex, [c.id]: next });
                                            } else if (e.key === 'Enter') {
                                              if (list.length > 0) {
                                                e.preventDefault();
                                                insertReplyMention(c.id, list[current]?.full_name || list[0].full_name);
                                              }
                                            } else if (e.key === 'Escape') {
                                              setReplyMentionOpen({ ...replyMentionOpen, [c.id]: false });
                                            }
                                          }}
                                        />
                                        {replyMentionOpen[c.id] && (
                                          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-auto">
                                            {(() => {
                                              const list = getMentionCandidates(replyMentionQuery[c.id] || '');
                                              if (list.length === 0) return <div className="px-3 py-2 text-sm text-slate-400">No matches</div>;
                                              const idx = replyMentionIndex[c.id] ?? 0;
                                              return list.map((u, i) => (
                                                <button
                                                  key={u.id}
                                                  type="button"
                                                  onMouseDown={e => { e.preventDefault(); insertReplyMention(c.id, u.full_name); }}
                                                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 ${i === idx ? 'bg-blue-50' : ''}`}
                                                >
                                                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{u.full_name.charAt(0)}</span>
                                                  <span className="font-medium text-slate-700">{u.full_name}</span>
                                                </button>
                                              ));
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() => setEmojiOpenFor({ ...emojiOpenFor, [c.id]: !emojiOpenFor[c.id] })}
                                          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-lg leading-none"
                                        >
                                          😊
                                        </button>
                                        {emojiOpenFor[c.id] && (
                                          <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 grid grid-cols-6 gap-2 z-20">
                                            {['😀', '😃', '😄', '😁', '😂', '🥹', '😊', '😍', '🤩', '😘', '😎', '👍', '👏', '🙌', '🙏', '💯', '🔥', '🌟', '🎉', '🥳', '💪', '🤝', '🫶', '💖'].map(em => (
                                              <button
                                                key={em}
                                                type="button"
                                                className="text-xl hover:scale-125 transition-transform"
                                                onMouseDown={e => { e.preventDefault(); addEmojiToReply(c.id, em); }}
                                              >
                                                {em}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        type="submit"
                                        disabled={!replyValues[c.id]?.trim() || replyPosting[c.id]}
                                        className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
                                      >
                                        {replyPosting[c.id] ? '...' : 'Reply'}
                                      </button>
                                    </form>
                                  </div>
                                )}

                                {c.children && c.children.length > 0 && (
                                  <div className="ml-11 mt-3 flex flex-col gap-3 border-l-2 border-slate-100 pl-4">
                                    {c.children.map((rc: any) => (
                                      <div key={rc.id} className="flex gap-3">
                                        <div className="h-6 w-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] flex-shrink-0">
                                          {rc.user.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                          <div className="bg-slate-100 rounded-2xl rounded-tl-none px-3 py-2 inline-block max-w-full">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                              <span className="font-bold text-xs text-slate-800">{rc.user.full_name}</span>
                                              <span className="text-[10px] text-slate-400">{formatDateTime(rc.created_at)}</span>
                                            </div>
                                            <div className="text-sm text-slate-700">{renderWithMentions(rc.content)}</div>
                                          </div>

                                          <div className="flex items-center gap-3 mt-1 ml-2 text-xs font-medium text-slate-500">
                                            <button
                                              type="button"
                                              onClick={() => setReplyOpenFor({ ...replyOpenFor, [rc.id]: !replyOpenFor[rc.id] })}
                                              className="hover:text-blue-600 transition-colors"
                                            >
                                              Reply
                                            </button>
                                            {(user?.is_admin || rc.user.id === user?.id) && (
                                              <button
                                                type="button"
                                                onClick={() => setConfirmModal({ type: 'comment', id: rc.id })}
                                                className="hover:text-red-600 transition-colors disabled:opacity-50"
                                                disabled={!!deletingComments[rc.id]}
                                              >
                                                {deletingComments[rc.id] ? 'Deleting...' : 'Delete'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-200">
                            <form
                              onSubmit={e => {
                                e.preventDefault();
                                handleComment(so.id);
                              }}
                              className="flex gap-3 items-start"
                            >
                              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-1">
                                {user?.full_name.charAt(0)}
                              </div>
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  className="input py-2.5 pl-4 pr-10 rounded-full bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-100 shadow-sm"
                                  placeholder="Write a comment..."
                                  value={commentValues[so.id] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setCommentValues({ ...commentValues, [so.id]: val });
                                    const det = detectMention(val);
                                    if (det.active) {
                                      setMentionOpen({ ...mentionOpen, [so.id]: true });
                                      setMentionQuery({ ...mentionQuery, [so.id]: det.query });
                                    } else {
                                      setMentionOpen({ ...mentionOpen, [so.id]: false });
                                      setMentionQuery({ ...mentionQuery, [so.id]: '' });
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (!mentionOpen[so.id]) return;
                                    const list = getMentionCandidates(mentionQuery[so.id] || '');
                                    const current = mentionIndex[so.id] || 0;
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      const next = (current + 1) % Math.max(list.length, 1);
                                      setMentionIndex({ ...mentionIndex, [so.id]: next });
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      const next = (current - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1);
                                      setMentionIndex({ ...mentionIndex, [so.id]: next });
                                    } else if (e.key === 'Enter') {
                                      if (list.length > 0) {
                                        e.preventDefault();
                                        insertMention(so.id, list[current]?.full_name || list[0].full_name);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setMentionOpen({ ...mentionOpen, [so.id]: false });
                                    }
                                  }}
                                />
                                <button
                                  type="submit"
                                  disabled={!commentValues[so.id]?.trim() || commenting[so.id]}
                                  className="absolute right-2 top-1.5 p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                  <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                  </svg>
                                </button>
                                {mentionOpen[so.id] && (
                                  <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-auto z-20">
                                    {(() => {
                                      const list = getMentionCandidates(mentionQuery[so.id] || '');
                                      if (list.length === 0) return <div className="px-3 py-2 text-sm text-slate-400">No matches</div>;
                                      const idx = mentionIndex[so.id] ?? 0;
                                      return list.map((u, i) => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onMouseDown={e => { e.preventDefault(); insertMention(so.id, u.full_name); }}
                                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 ${i === idx ? 'bg-blue-50' : ''}`}
                                        >
                                          <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{u.full_name.charAt(0)}</span>
                                          <span className="font-medium text-slate-700">{u.full_name}</span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ActionModal
        open={!!confirmModal}
        title="Confirm deletion"
        description={
          confirmModal?.type === 'shoutout'
            ? 'This shout-out and all of its comments and reactions will be permanently removed.'
            : 'This comment (and any replies) will be permanently removed.'
        }
        confirmText="Delete"
        variant="danger"
        loading={confirmingAction}
        onConfirm={confirmDeletion}
        onCancel={() => {
          if (!confirmingAction) setConfirmModal(null);
        }}
      />

      <ActionModal
        open={!!reportModal}
        title="Report shout-out"
        description="Share a brief reason so admins can review this content."
        confirmText="Submit report"
        loading={reportModalSubmitting}
        confirmDisabled={reportReasonInvalid}
        onConfirm={submitReportModal}
        onCancel={() => {
          if (!reportModalSubmitting) setReportModal(null);
        }}
      >
        <textarea
          className={`w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${reportReasonInvalid ? 'border-red-500 focus:ring-red-400' : 'border-gray-300'
            }`}
          rows={4}
          placeholder="Describe what feels inappropriate..."
          value={reportModal?.reason || ''}
          onChange={e => setReportModal(prev => (prev ? { ...prev, reason: e.target.value } : prev))}
          maxLength={500}
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={reportReasonInvalid ? 'text-red-500' : 'text-gray-500'}>
            Minimum 5 characters to submit.
          </span>
          <span className="text-gray-400">{(reportModal?.reason.length ?? 0)}/500</span>
        </div>
      </ActionModal>
    </div>
  );
}

type ActionModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

function ActionModal({
  open,
  title,
  description,
  confirmText,
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ActionModalProps) {
  if (!open) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transform transition-all scale-100">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (!loading) onCancel();
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmClasses}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Working...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
