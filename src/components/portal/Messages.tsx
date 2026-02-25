import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'dealer' | 'admin' | 'designer';
  content: string;
  created_at: string;
  read: boolean;
}

interface Conversation {
  id: string;
  subject: string;
  dealer_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'open' | 'closed';
  last_message?: string;
  last_sender_name?: string;
  unread_count?: number;
}

interface Props {
  dealer: any;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
}

export default function Messages({ dealer, onNavigate, isAdmin }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newFirstMessage, setNewFirstMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dealerId = dealer?.parent_dealer_id || dealer?.id;

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (selectedConvo) loadMessages(selectedConvo.id); }, [selectedConvo?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadConversations() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
    setLoading(false);
  }

  async function loadMessages(convoId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
      // Mark unread messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', convoId)
        .neq('sender_id', dealer.id);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConvo.id,
        sender_id: dealer.id,
        sender_name: dealer.company_name || dealer.name || 'Dealer',
        sender_role: isAdmin ? 'admin' : (dealer.parent_dealer_id ? 'designer' : 'dealer'),
        content: newMessage.trim(),
        read: false
      });
      if (error) throw error;
      await supabase.from('conversations').update({
        updated_at: new Date().toISOString(),
        last_message: newMessage.trim().substring(0, 100),
        last_sender_name: dealer.company_name || dealer.name || 'Dealer'
      }).eq('id', selectedConvo.id);
      setNewMessage('');
      loadMessages(selectedConvo.id);
      loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
    }
    setSending(false);
  }

  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newFirstMessage.trim()) return;
    setSending(true);
    try {
      const { data: convo, error: convoErr } = await supabase
        .from('conversations')
        .insert({
          subject: newSubject.trim(),
          dealer_id: dealerId,
          created_by: dealer.id,
          status: 'open',
          last_message: newFirstMessage.trim().substring(0, 100),
          last_sender_name: dealer.company_name || dealer.name || 'Dealer'
        })
        .select()
        .single();
      if (convoErr) throw convoErr;
      await supabase.from('messages').insert({
        conversation_id: convo.id,
        sender_id: dealer.id,
        sender_name: dealer.company_name || dealer.name || 'Dealer',
        sender_role: isAdmin ? 'admin' : 'dealer',
        content: newFirstMessage.trim(),
        read: false
      });
      setNewSubject('');
      setNewFirstMessage('');
      setShowNewConvo(false);
      await loadConversations();
      setSelectedConvo(convo);
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
    setSending(false);
  }

  const filteredConvos = conversations.filter(c => filter === 'all' ? true : c.status === filter);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ── Styles ──
  const copper = '#b87333';
  const dark = '#2d2d2d';
  const sand = '#f5f0eb';
  const ivory = '#faf8f5';

  const containerStyle: React.CSSProperties = {
    display: 'flex', height: 'calc(100vh - 120px)', background: ivory,
    borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e0db'
  };

  const sidebarStyle: React.CSSProperties = {
    width: 340, borderRight: '1px solid #e5e0db', display: 'flex',
    flexDirection: 'column', background: '#fff'
  };

  const chatStyle: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', background: ivory
  };

  const btnPrimary: React.CSSProperties = {
    background: copper, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    fontSize: 14, fontWeight: 600
  };

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', color: dark, border: `1px solid #d5d0cb`,
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', fontSize: 13
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #d5d0cb',
    borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif',
    outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: dark, margin: 0 }}>
            Messages
          </h1>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif' }}>
            Communicate with Pronorm USA / Pinnacle Sales
          </p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowNewConvo(true); setSelectedConvo(null); }}>
          + New Message
        </button>
      </div>

      <div style={containerStyle}>
        {/* Sidebar - Conversation List */}
        <div style={sidebarStyle}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e0db' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'open', 'closed'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  ...btnSecondary, fontSize: 12, padding: '6px 12px',
                  background: filter === f ? copper : 'transparent',
                  color: filter === f ? '#fff' : dark,
                  border: filter === f ? 'none' : '1px solid #d5d0cb'
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
            ) : filteredConvos.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
                No conversations yet
              </div>
            ) : filteredConvos.map(c => (
              <div key={c.id} onClick={() => { setSelectedConvo(c); setShowNewConvo(false); }}
                style={{
                  padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f0ece7',
                  background: selectedConvo?.id === c.id ? sand : 'transparent',
                  borderLeft: selectedConvo?.id === c.id ? `3px solid ${copper}` : '3px solid transparent'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: dark }}>
                    {c.subject}
                  </span>
                  <span style={{ fontSize: 11, color: '#999' }}>{formatDate(c.updated_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#777', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.last_sender_name ? `${c.last_sender_name}: ` : ''}{c.last_message || 'No messages'}
                </div>
                {c.status === 'closed' && (
                  <span style={{ fontSize: 11, color: '#999', background: '#f0ece7', borderRadius: 4, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={chatStyle}>
          {showNewConvo ? (
            <div style={{ padding: 40, maxWidth: 500, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: dark, marginBottom: 20 }}>New Conversation</h2>
              <form onSubmit={handleCreateConversation}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: dark }}>Subject</label>
                  <input style={inputStyle} value={newSubject} onChange={e => setNewSubject(e.target.value)}
                    placeholder="e.g., Question about cabinet specifications" required />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: dark }}>Message</label>
                  <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={newFirstMessage}
                    onChange={e => setNewFirstMessage(e.target.value)} placeholder="Type your message..." required />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" style={btnPrimary} disabled={sending}>{sending ? 'Sending...' : 'Send Message'}</button>
                  <button type="button" style={btnSecondary} onClick={() => setShowNewConvo(false)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : selectedConvo ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e0db', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 600, color: dark }}>{selectedConvo.subject}</h3>
                  <span style={{ fontSize: 12, color: '#999' }}>Started {new Date(selectedConvo.created_at).toLocaleDateString()}</span>
                </div>
                <button style={btnSecondary} onClick={async () => {
                  const newStatus = selectedConvo.status === 'open' ? 'closed' : 'open';
                  await supabase.from('conversations').update({ status: newStatus }).eq('id', selectedConvo.id);
                  setSelectedConvo({ ...selectedConvo, status: newStatus });
                  loadConversations();
                }}>
                  {selectedConvo.status === 'open' ? 'Close Thread' : 'Reopen Thread'}
                </button>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {messages.map(m => {
                  const isOwn = m.sender_id === dealer.id;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                      <div style={{
                        maxWidth: '70%', padding: '12px 16px', borderRadius: 12,
                        background: isOwn ? copper : '#fff',
                        color: isOwn ? '#fff' : dark,
                        border: isOwn ? 'none' : '1px solid #e5e0db',
                        borderBottomRightRadius: isOwn ? 4 : 12,
                        borderBottomLeftRadius: isOwn ? 12 : 4
                      }}>
                        {!isOwn && (
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: copper, fontFamily: 'DM Sans, sans-serif' }}>
                            {m.sender_name}
                          </div>
                        )}
                        <div style={{ fontSize: 14, lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7, textAlign: 'right' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {/* Input */}
              {selectedConvo.status === 'open' && (
                <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', borderTop: '1px solid #e5e0db', background: '#fff', display: 'flex', gap: 12 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..." />
                  <button type="submit" style={btnPrimary} disabled={sending || !newMessage.trim()}>
                    {sending ? '...' : 'Send'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#9993;</div>
                <p style={{ fontSize: 16 }}>Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
                    }
