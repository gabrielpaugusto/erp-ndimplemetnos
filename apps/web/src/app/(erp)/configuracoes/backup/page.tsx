'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/api';

interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'manual' | 'auto';
}

interface BackupStats {
  total: number;
  totalSize: string;
  lastBackup: string | null;
  backupDir: string;
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [backupList, backupStats] = await Promise.all([
        api<BackupInfo[]>('/backup'),
        api<BackupStats>('/backup/stats'),
      ]);
      setBackups(backupList);
      setStats(backupStats);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const result = await api<BackupInfo>('/backup', { method: 'POST' });
      setSuccess(`Backup criado com sucesso: ${result.filename} (${result.sizeFormatted})`);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao criar backup');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Excluir o backup "${filename}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingFile(filename);
    setError('');
    try {
      await api(`/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setSuccess('Backup excluído.');
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao excluir backup');
    } finally {
      setDeletingFile(null);
    }
  }

  function handleDownload(filename: string) {
    const token = localStorage.getItem('accessToken');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    const url = `${apiUrl}/backup/download/${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    // Pass auth header via a temporary fetch + blob URL
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Backup do Banco de Dados</h1>
            <p className="text-sm text-slate-500">Gerencie os backups do PostgreSQL</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Plus className="w-4 h-4" /> Criar Backup Agora</>
            }
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total de Backups</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Espaço Utilizado</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalSize}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Último Backup</p>
              <p className="text-sm font-semibold text-slate-900">
                {stats.lastBackup ? formatDate(stats.lastBackup) : 'Nenhum'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <CalendarClock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">Backup Automático Configurado</p>
          <p className="text-sm text-blue-700 mt-1">
            Backups automáticos são gerados todo dia às <strong>02:00</strong>. Os 7 backups automáticos mais recentes são mantidos e os anteriores são excluídos automaticamente.
          </p>
        </div>
      </div>

      {/* Backup list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Arquivos de Backup</h2>
          <span className="ml-auto text-xs text-slate-400">{backups.length} arquivo{backups.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Nenhum backup encontrado.</p>
            <p className="text-slate-400 text-xs mt-1">Clique em "Criar Backup Agora" para gerar o primeiro backup.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <div key={backup.filename} className="flex items-center px-4 py-3 hover:bg-slate-50 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-slate-800 truncate">{backup.filename}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      backup.type === 'auto'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {backup.type === 'auto' ? 'Automático' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(backup.createdAt)} · {backup.sizeFormatted}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(backup.filename)}
                    title="Baixar backup"
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(backup.filename)}
                    disabled={deletingFile === backup.filename}
                    title="Excluir backup"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingFile === backup.filename
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage path */}
      {stats && (
        <p className="text-xs text-slate-400 text-center">
          Arquivos salvos em: <code className="bg-slate-100 px-1 rounded">{stats.backupDir}</code>
        </p>
      )}
    </div>
  );
}
