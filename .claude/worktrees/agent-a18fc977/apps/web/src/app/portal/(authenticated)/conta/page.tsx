'use client';

import { useState } from 'react';
import { User, Lock, Shield, Clock } from 'lucide-react';

export default function PortalContaPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Minha Conta</h1>
        <p className="text-slate-500 mt-1 text-sm">Gerencie suas informacoes pessoais e seguranca.</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Informacoes do Perfil</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome / Razao Social</label>
            <p className="text-sm font-medium text-slate-900">Logistica Express S/A</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">CNPJ</label>
            <p className="text-sm font-medium text-slate-900">45.678.901/0001-23</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label>
            <p className="text-sm font-medium text-slate-900">contato@logisticaexpress.com.br</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Telefone</label>
            <p className="text-sm font-medium text-slate-900">(54) 3221-4500</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Endereco</label>
            <p className="text-sm font-medium text-slate-900">Rua dos Transportadores, 800 — Caxias do Sul/RS — CEP 95040-120</p>
          </div>
        </div>
      </div>

      {/* Access level */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Nivel de Acesso</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Acesso</label>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
              Cliente Premium
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Permissoes</label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Documentos</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Chamados</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Financeiro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last login */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Historico de Acesso</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Ultimo acesso</p>
              <p className="text-xs text-slate-400">IP: 189.44.xxx.xxx</p>
            </div>
            <p className="text-sm text-slate-600">15/03/2026 08:32</p>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Acesso anterior</p>
              <p className="text-xs text-slate-400">IP: 189.44.xxx.xxx</p>
            </div>
            <p className="text-sm text-slate-600">14/03/2026 16:15</p>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Conta criada em</p>
            </div>
            <p className="text-sm text-slate-600">01/01/2026</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Alterar Senha</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert('Senha alterada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }}
          className="space-y-4 max-w-md"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Alterar Senha
          </button>
        </form>
      </div>
    </div>
  );
}
