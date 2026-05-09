import { useState } from 'react';
import { api } from '../lib/api.js';
import { sortChats } from '../lib/chat.js';

const preferenceConfig = {
  pin: { flag: 'pinned', path: 'pin' },
  star: { flag: 'starred', path: 'star' },
  mute: { flag: 'muted', path: 'mute' },
  archive: { flag: 'archived', path: 'archive' }
};

export function useChatSelection({ chats, setChats }) {
  const [selectedChats, setSelectedChats] = useState(new Set());
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectionError, setSelectionError] = useState('');

  function clearSelection() {
    setSelectedChats(new Set());
  }

  function toggleSelect(chatId) {
    setSelectedChats((current) => {
      const next = new Set(current);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  function requestHideSelectedChats() {
    const ids = [...selectedChats];
    if (!ids.length) return;
    setPendingDelete({ ids, count: ids.length });
  }

  function cancelHideSelectedChats() {
    setPendingDelete(null);
  }

  async function confirmHideSelectedChats() {
    const ids = pendingDelete?.ids || [];
    if (!ids.length) return;
    setPendingDelete(null);

    const previousChats = chats;
    try {
      clearSelection();
      setChats((current) => current.filter((chat) => !ids.includes(chat._id)));
      await Promise.all(ids.map((chatId) => api(`/api/chats/${chatId}/hide`, { method: 'PATCH' })));
    } catch (err) {
      setChats(previousChats);
      setSelectionError(err.message || 'Could not delete selected chats');
    }
  }

  async function setSelectedPreference(kind) {
    const config = preferenceConfig[kind];
    const ids = [...selectedChats];
    if (!config || !ids.length) return;

    const enabled = ids.some((chatId) => !chats.find((chat) => chat._id === chatId)?.[config.flag]);
    setChats((current) => sortChats(current.map((chat) => (ids.includes(chat._id) ? { ...chat, [config.flag]: enabled } : chat))));
    clearSelection();
    await Promise.all(ids.map((chatId) => api(`/api/chats/${chatId}/${config.path}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }).catch(() => null)));
  }

  return {
    selectedChats,
    pendingDelete,
    selectionError,
    clearSelection,
    toggleSelect,
    requestHideSelectedChats,
    confirmHideSelectedChats,
    cancelHideSelectedChats,
    clearSelectionError: () => setSelectionError(''),
    setSelectedPreference
  };
}
