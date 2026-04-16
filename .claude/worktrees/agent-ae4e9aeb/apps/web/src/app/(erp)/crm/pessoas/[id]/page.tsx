'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Plus, Trash2, Save, X } from 'lucide-react';
import AddressBlock from '@/components/address/address-block';
import { type AddressValue } from '@/lib/address';
import { maskCpfCnpj, maskPhone } from '@/lib/masks';
import { apiFetch } from '@/lib/api';

interface PersonAddress extends AddressValue {
  id: string;
  type: string;
  main: boolean;
}

interface Contact {
  id: string;
  type: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  main: boolean;
}

interface PersonForm {
  type: 'PF' | 'PJ';
  document: string;
  name: string;
  tradeName: string;
  rgIe: string;
  municipalRegistration: string;
  roles: string[];
  creditLimit: string;
  paymentCondition: string;
  notes: string;
  active: boolean;
}

const emptyAddress = (): PersonAddress => ({
  id: crypto.randomUUID(),
  type: 'COMERCIAL',
  main: false,
  cep: '',
  uf: '',
  municipio: '',
  codigoIbge: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
});

const emptyContact = (): Contact => ({
  id: crypto.randomUUID(),
  type: 'TELEFONE',
  name: '',
  phone: '',
  email: '',
  role: '',
  main: false,
});

const tabs = [
  { key: 'geral', label: 'Dados Gerais' },
  { key: 'enderecos', label: 'Endereços' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'bancarios', label: 'Dados Bancários' },
];


export default function EditarPessoaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState('geral');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState<PersonForm>({
    type: 'PJ',
    document: '',
    name: '',
    tradeName: '',
    rgIe: '',
    municipalRegistration: '',
    roles: ['CLIENTE'],
    creditLimit: '',
    paymentCondition: '',
    notes: '',
    active: true,
  });

  const [addresses, setAddresses] = useState<PersonAddress[]>([emptyAddress()]);
  const [contacts, setContacts] = useState<Contact[]>([emptyContact()]);

  useEffect(() => {
    apiFetch(`/api/persons/${id}`)
      .then(r => r.json())
      .then(p => {
        setForm({
          type: p.type,
          document: p.cpfCnpj,
          name: p.razaoSocial,
          tradeName: p.nomeFantasia ?? '',
          rgIe: p.rgIe ?? '',
          municipalRegistration: p.inscricaoMunicipal ?? '',
          roles: Array.isArray(p.roles) ? p.roles : [],
          creditLimit: p.limiteCredito ? String(p.limiteCredito) : '',
          paymentCondition: p.condicaoPagamento ?? '',
          notes: p.observacoes ?? '',
          active: p.active ?? true,
        });
        if (p.addresses?.length) {
          setAddresses(p.addresses.map((a: any) => ({
            id: a.id,
            type: a.type,
            main: a.principal,
            cep: a.cep,
            uf: a.uf,
            municipio: a.municipio,
            codigoIbge: a.codigoMunicipioIbge ?? '',
            logradouro: a.logradouro,
            numero: a.numero,
            complemento: a.complemento ?? '',
            bairro: a.bairro,
          })));
        }
        if (p.contacts?.length) {
          setContacts(p.contacts.map((c: any) => ({
            id: c.id,
            type: c.type,
            name: c.name ?? '',
            phone: c.value ?? '',
            email: '',
            role: c.department ?? '',
            main: c.principal,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const updateForm = (field: keyof PersonForm, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRole = (role: string) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const updateAddress = (addrId: string, v: AddressValue) => {
    setAddresses((prev) => prev.map((a) => (a.id === addrId ? { ...a, ...v } : a)));
  };
  const updateAddressField = (addrId: string, field: keyof PersonAddress, value: unknown) => {
    setAddresses((prev) => prev.map((a) => (a.id === addrId ? { ...a, [field]: value } : a)));
  };

  const addAddress = () => setAddresses((prev) => [...prev, emptyAddress()]);
  const removeAddress = (addrId: string) =>
    setAddresses((prev) => prev.filter((a) => a.id !== addrId));

  const updateContact = (contId: string, field: keyof Contact, value: unknown) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contId ? { ...c, [field]: value } : c))
    );
  };

  const addContact = () => setContacts((prev) => [...prev, emptyContact()]);
  const removeContact = (contId: string) =>
    setContacts((prev) => prev.filter((c) => c.id !== contId));

  const handleSave = async () => {
    setSaveError('');

    if (!form.name.trim()) {
      setSaveError('Razão Social / Nome é obrigatório.');
      setActiveTab('geral');
      return;
    }
    if (form.roles.length === 0) {
      setSaveError('Selecione ao menos um papel (Cliente, Fornecedor, etc).');
      setActiveTab('geral');
      return;
    }

    setSaving(true);
    try {
      const body = {
        type: form.type,
        cpfCnpj: form.document || undefined,
        razaoSocial: form.name.trim(),
        nomeFantasia: form.tradeName || undefined,
        rgIe: form.rgIe || undefined,
        inscricaoMunicipal: form.municipalRegistration || undefined,
        roles: form.roles,
        limiteCredito: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
        condicaoPagamento: form.paymentCondition || undefined,
        observacoes: form.notes || undefined,
        active: form.active,
        addresses: addresses
          .filter(a => a.logradouro.trim())
          .map(a => ({
            type: a.type,
            logradouro: a.logradouro,
            numero: a.numero || 'S/N',
            complemento: a.complemento || undefined,
            bairro: a.bairro || undefined,
            codigoMunicipioIbge: a.codigoIbge || undefined,
            municipio: a.municipio || undefined,
            uf: a.uf || undefined,
            cep: a.cep.replace(/\D/g, '') || undefined,
            principal: a.main,
          })),
        contacts: contacts
          .filter(c => c.phone.trim() || c.email.trim() || c.name.trim())
          .map(c => ({
            type: c.type,
            value: c.phone || c.email || c.name,
            name: c.name || undefined,
            department: c.role || undefined,
            principal: c.main,
          })),
      };
      const res = await apiFetch(`/api/persons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message)
          ? err.message.join(' | ')
          : (err.message || `Erro ${res.status}`);
        throw new Error(msg);
      }
      router.push('/crm/pessoas');
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao atualizar pessoa. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/pessoas"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar Pessoa</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {form.name || 'Carregando...'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Dados Gerais */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Pessoa
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="PF"
                      checked={form.type === 'PF'}
                      onChange={() => updateForm('type', 'PF')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Pessoa Física (PF)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="PJ"
                      checked={form.type === 'PJ'}
                      onChange={() => updateForm('type', 'PJ')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Pessoa Jurídica (PJ)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {form.type === 'PF' ? 'CPF' : 'CNPJ'}
                  </label>
                  <input
                    type="text"
                    value={maskCpfCnpj(form.document)}
                    onChange={(e) => updateForm('document', e.target.value.replace(/\D/g, ''))}
                    placeholder={form.type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {form.type === 'PF' ? 'RG' : 'Inscrição Estadual'}
                  </label>
                  <input
                    type="text"
                    value={form.rgIe}
                    onChange={(e) => updateForm('rgIe', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {form.type === 'PF' ? 'Nome Completo' : 'Razão Social'}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {form.type === 'PJ' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={form.tradeName}
                      onChange={(e) => updateForm('tradeName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {form.type === 'PJ' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Inscrição Municipal
                    </label>
                    <input
                      type="text"
                      value={form.municipalRegistration}
                      onChange={(e) => updateForm('municipalRegistration', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Papel */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Papel</label>
                <div className="flex items-center gap-6">
                  {['CLIENTE', 'FORNECEDOR', 'TRANSPORTADORA'].map((role) => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">
                        {role.toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Limite de Crédito (R$)
                  </label>
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => updateForm('creditLimit', e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Condição de Pagamento
                  </label>
                  <input
                    type="text"
                    value={form.paymentCondition}
                    onChange={(e) => updateForm('paymentCondition', e.target.value)}
                    placeholder="Ex: 30/60/90 dias"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateForm('active', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Pessoa ativa</span>
                </label>
              </div>
            </div>
          )}

          {/* Endereços */}
          {activeTab === 'enderecos' && (
            <div className="space-y-6">
              {addresses.map((addr, idx) => (
                <div key={addr.id} className="border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">Endereço {idx + 1}</h3>
                    {addresses.length > 1 && (
                      <button
                        onClick={() => removeAddress(addr.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <AddressBlock
                    value={addr}
                    onChange={(v) => updateAddress(addr.id, v)}
                    showType
                    type={addr.type}
                    onTypeChange={(t) => updateAddressField(addr.id, 'type', t)}
                    main={addr.main}
                    onMainChange={(m) => updateAddressField(addr.id, 'main', m)}
                  />
                </div>
              ))}
              <button
                onClick={addAddress}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Endereço
              </button>
            </div>
          )}

          {/* Contatos */}
          {activeTab === 'contatos' && (
            <div className="space-y-6">
              {contacts.map((contact, idx) => (
                <div key={contact.id} className="border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">Contato {idx + 1}</h3>
                    {contacts.length > 1 && (
                      <button
                        onClick={() => removeContact(contact.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                      <select
                        value={contact.type}
                        onChange={(e) => updateContact(contact.id, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="TELEFONE">Telefone</option>
                        <option value="CELULAR">Celular</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="WHATSAPP">WhatsApp</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={contact.main}
                          onChange={(e) => updateContact(contact.id, 'main', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Contato principal</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                      <input
                        type="text"
                        value={maskPhone(contact.phone)}
                        onChange={(e) => updateContact(contact.id, 'phone', e.target.value.replace(/\D/g, ''))}
                        placeholder="(00) 0000-0000 OU (00) 00000-0000"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cargo / Função</label>
                      <input
                        type="text"
                        value={contact.role}
                        onChange={(e) => updateContact(contact.id, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addContact}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Contato
              </button>
            </div>
          )}

          {/* Dados Bancários */}
          {activeTab === 'bancarios' && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="text-sm">Dados bancários serão implementados na próxima sprint.</p>
            </div>
          )}
        </div>
      </div>

      {/* Erro de salvamento */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <span className="font-semibold shrink-0">Erro:</span>
          <span className="flex-1">{saveError}</span>
          <button
            onClick={() => setSaveError('')}
            className="shrink-0 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/crm/pessoas"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
